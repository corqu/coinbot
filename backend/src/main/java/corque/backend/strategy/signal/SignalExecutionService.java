package corque.backend.strategy.signal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import corque.backend.strategy.domain.Strategy;
import corque.backend.strategy.domain.StrategyGroup;
import corque.backend.strategy.domain.StrategyGroupItem;
import corque.backend.strategy.order.BybitOrderClient;
import corque.backend.strategy.order.BybitOrderResult;
import corque.backend.strategy.repo.StrategyGroupItemRepository;
import corque.backend.strategy.repo.StrategyGroupRepository;
import corque.backend.strategy.repo.StrategyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SignalExecutionService {

    private final StrategyRepository strategyRepository;
    private final StrategyGroupRepository strategyGroupRepository;
    private final StrategyGroupItemRepository strategyGroupItemRepository;
    private final BybitOrderClient bybitOrderClient;
    private final ObjectMapper objectMapper;

    private final Set<String> processedSignals = ConcurrentHashMap.newKeySet();

    @Transactional(readOnly = true)
    public void executeSignal(TradeSignalMessage message) {
        if (message == null || !"signal".equalsIgnoreCase(message.getType())) {
            return;
        }
        if (message.getSignalId() != null && !processedSignals.add(message.getSignalId())) {
            log.info("Skip duplicated signal: {}", message.getSignalId());
            return;
        }
        if (!"BUY".equalsIgnoreCase(message.getSignal()) && !"SELL".equalsIgnoreCase(message.getSignal())) {
            return;
        }
        if (message.getGroupId() != null) {
            executeGroupSignal(message);
            return;
        }

        Strategy strategy = strategyRepository.findByCodeAndIsActiveTrue(message.getStrategyId())
                .orElse(null);
        if (strategy == null) {
            log.info("No active strategy found for code={}", message.getStrategyId());
            return;
        }

        var items = strategyGroupItemRepository
                .findByStrategyIdAndEnabledTrueAndStrategyGroupIsActiveTrueOrderBySortOrderAscIdAsc(strategy.getId());
        if (items.isEmpty()) {
            log.info("No enabled group items for strategyId={}", strategy.getId());
            return;
        }

        for (StrategyGroupItem item : items) {
            Map<String, Object> params = parseParams(item.getParamsJson());
            if (!matchesFilter(params, message)) {
                continue;
            }

            double qty = resolveQty(params);
            if (qty <= 0) {
                log.warn("Skip order due to invalid qty. itemId={}", item.getId());
                continue;
            }
            String side = "BUY".equalsIgnoreCase(message.getSignal()) ? "Buy" : "Sell";
            try {
                Double orderPrice = resolveOrderPrice(message);
                BybitOrderResult result = bybitOrderClient.placeOrder(message.getSymbol(), side, qty, orderPrice);
                log.info("Order sent. signalId={}, itemId={}, orderType={}, price={}, retCode={}, retMsg={}",
                        message.getSignalId(),
                        item.getId(),
                        orderPrice != null ? "Limit" : "Market",
                        orderPrice,
                        result.getRetCode(),
                        result.getRetMsg());
            } catch (Exception e) {
                log.error("Order failed. signalId={}, itemId={}", message.getSignalId(), item.getId(), e);
            }
        }
    }

    private void executeGroupSignal(TradeSignalMessage message) {
        StrategyGroup group = strategyGroupRepository.findById(message.getGroupId()).orElse(null);
        if (group == null || !Boolean.TRUE.equals(group.getIsActive())) {
            log.info("No active strategy group found for groupId={}", message.getGroupId());
            return;
        }

        var items = strategyGroupItemRepository.findByStrategyGroupIdOrderBySortOrderAscIdAsc(group.getId())
                .stream()
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .toList();
        if (items.isEmpty()) {
            log.info("No enabled items for groupId={}", message.getGroupId());
            return;
        }

        StrategyGroupItem chosenItem = null;
        double qty = 0.0;
        for (StrategyGroupItem item : items) {
            Map<String, Object> params = parseParams(item.getParamsJson());
            if (!matchesFilter(params, message)) {
                continue;
            }
            double resolvedQty = resolveQty(params);
            if (resolvedQty > 0) {
                chosenItem = item;
                qty = resolvedQty;
                break;
            }
        }

        if (chosenItem == null || qty <= 0) {
            log.warn("Skip group order due to missing qty/filter mismatch. groupId={}", group.getId());
            return;
        }

        String side = "BUY".equalsIgnoreCase(message.getSignal()) ? "Buy" : "Sell";
        try {
            Double orderPrice = resolveOrderPrice(message);
            BybitOrderResult result = bybitOrderClient.placeOrder(message.getSymbol(), side, qty, orderPrice);
            log.info("Group order sent. signalId={}, groupId={}, itemId={}, orderType={}, price={}, retCode={}, retMsg={}",
                    message.getSignalId(),
                    group.getId(),
                    chosenItem.getId(),
                    orderPrice != null ? "Limit" : "Market",
                    orderPrice,
                    result.getRetCode(),
                    result.getRetMsg());
        } catch (Exception e) {
            log.error("Group order failed. signalId={}, groupId={}", message.getSignalId(), group.getId(), e);
        }
    }

    private Map<String, Object> parseParams(String paramsJson) {
        if (paramsJson == null || paramsJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(paramsJson, new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Invalid params_json: {}", paramsJson);
            return Map.of();
        }
    }

    private boolean matchesFilter(Map<String, Object> params, TradeSignalMessage message) {
        Object symbol = params.get("symbol");
        if (symbol instanceof String s && !s.isBlank() && !s.equalsIgnoreCase(message.getSymbol())) {
            return false;
        }
        Object interval = params.get("interval");
        if (interval instanceof String i && !i.isBlank() && !i.equalsIgnoreCase(message.getInterval())) {
            return false;
        }
        return true;
    }

    private double resolveQty(Map<String, Object> params) {
        Object qty = params.get("trade_qty");
        if (qty == null) {
            qty = params.get("qty");
        }
        if (qty instanceof Number n) {
            return n.doubleValue();
        }
        if (qty instanceof String s) {
            try {
                return Double.parseDouble(s);
            } catch (Exception ignored) {
                return 0.0;
            }
        }
        return 0.0;
    }

    private Double resolveOrderPrice(TradeSignalMessage message) {
        if (message == null || message.getPrice() == null || message.getPrice() <= 0) {
            return null;
        }
        return message.getPrice();
    }
}
