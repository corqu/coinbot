package corque.backend.order.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import corque.backend.order.domain.OrderExecution;
import corque.backend.order.domain.OrderExecutionStatus;
import corque.backend.order.infra.BybitOrderResult;
import corque.backend.order.repo.OrderExecutionRepository;
import corque.backend.strategy.domain.Strategy;
import corque.backend.strategy.domain.StrategyGroupItem;
import corque.backend.signal.dto.TradeSignalMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrderExecutionService {

    private final OrderExecutionRepository orderExecutionRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public void recordSubmitted(
            Long signalEventId,
            TradeSignalMessage message,
            StrategyGroupItem item,
            String side,
            double qty,
            Double orderPrice,
            BybitOrderResult result
    ) {
        double executedQty = extractDouble(result, "cumExecQty", "executedQty");
        Double remainingQty = qty - executedQty;
        if (remainingQty < 0) {
            remainingQty = 0.0;
        }
        OrderExecutionStatus status;
        if (executedQty >= qty && qty > 0) {
            status = OrderExecutionStatus.FILLED;
        } else if (executedQty > 0) {
            status = OrderExecutionStatus.PARTIALLY_FILLED;
        } else {
            status = OrderExecutionStatus.SUBMITTED;
        }

        OrderExecution orderExecution = OrderExecution.builder()
                .signalEventId(signalEventId)
                .signalId(message != null ? message.getSignalId() : null)
                .userId(message != null ? message.getUserId() : null)
                .groupId(message != null ? message.getGroupId() : null)
                .strategyGroupItemId(item != null ? item.getId() : null)
                .strategyCode(resolveStrategyCode(item, message))
                .symbol(message != null ? message.getSymbol() : null)
                .intervalValue(message != null ? message.getInterval() : null)
                .signal(message != null ? message.getSignal() : null)
                .side(side)
                .requestQty(qty)
                .executedQty(executedQty)
                .remainingQty(remainingQty)
                .orderType(orderPrice != null && orderPrice > 0 ? "Limit" : "Market")
                .requestPrice(orderPrice)
                .status(status)
                .retCode(result != null ? result.getRetCode() : null)
                .retMsg(result != null ? result.getRetMsg() : null)
                .orderId(extractOrderId(result))
                .responseJson(toJson(result))
                .build();

        orderExecutionRepository.save(orderExecution);
    }

    @Transactional
    public void recordRejected(
            Long signalEventId,
            TradeSignalMessage message,
            StrategyGroupItem item,
            String side,
            double qty,
            Double orderPrice,
            BybitOrderResult result
    ) {
        OrderExecution orderExecution = OrderExecution.builder()
                .signalEventId(signalEventId)
                .signalId(message != null ? message.getSignalId() : null)
                .userId(message != null ? message.getUserId() : null)
                .groupId(message != null ? message.getGroupId() : null)
                .strategyGroupItemId(item != null ? item.getId() : null)
                .strategyCode(resolveStrategyCode(item, message))
                .symbol(message != null ? message.getSymbol() : null)
                .intervalValue(message != null ? message.getInterval() : null)
                .signal(message != null ? message.getSignal() : null)
                .side(side)
                .requestQty(qty)
                .executedQty(0.0)
                .remainingQty(qty)
                .orderType(orderPrice != null && orderPrice > 0 ? "Limit" : "Market")
                .requestPrice(orderPrice)
                .status(OrderExecutionStatus.FAILED)
                .retCode(result != null ? result.getRetCode() : null)
                .retMsg(result != null ? result.getRetMsg() : null)
                .orderId(extractOrderId(result))
                .responseJson(toJson(result))
                .errorMessage(result != null ? truncate(result.getRetMsg(), 2000) : null)
                .build();

        orderExecutionRepository.save(orderExecution);
    }

    @Transactional
    public void recordFailed(
            Long signalEventId,
            TradeSignalMessage message,
            StrategyGroupItem item,
            String side,
            double qty,
            Double orderPrice,
            Exception exception
    ) {
        OrderExecution orderExecution = OrderExecution.builder()
                .signalEventId(signalEventId)
                .signalId(message != null ? message.getSignalId() : null)
                .userId(message != null ? message.getUserId() : null)
                .groupId(message != null ? message.getGroupId() : null)
                .strategyGroupItemId(item != null ? item.getId() : null)
                .strategyCode(resolveStrategyCode(item, message))
                .symbol(message != null ? message.getSymbol() : null)
                .intervalValue(message != null ? message.getInterval() : null)
                .signal(message != null ? message.getSignal() : null)
                .side(side)
                .requestQty(qty)
                .executedQty(0.0)
                .remainingQty(qty)
                .orderType(orderPrice != null && orderPrice > 0 ? "Limit" : "Market")
                .requestPrice(orderPrice)
                .status(OrderExecutionStatus.FAILED)
                .errorMessage(truncate(exception != null ? exception.getMessage() : null, 2000))
                .build();

        orderExecutionRepository.save(orderExecution);
    }

    private String resolveStrategyCode(StrategyGroupItem item, TradeSignalMessage message) {
        Strategy strategy = item != null ? item.getStrategy() : null;
        if (strategy != null && strategy.getCode() != null) {
            return strategy.getCode();
        }
        return message != null ? message.getStrategyId() : null;
    }

    private String extractOrderId(BybitOrderResult result) {
        if (result == null || result.getResult() == null) {
            return null;
        }
        Object value = result.getResult().get("orderId");
        if (value == null) {
            value = result.getResult().get("order_id");
        }
        return value == null ? null : value.toString();
    }

    private double extractDouble(BybitOrderResult result, String... keys) {
        if (result == null || result.getResult() == null) {
            return 0.0;
        }
        Map<String, Object> map = result.getResult();
        for (String key : keys) {
            Object value = map.get(key);
            if (value instanceof Number number) {
                return number.doubleValue();
            }
            if (value instanceof String text) {
                try {
                    return Double.parseDouble(text);
                } catch (Exception ignored) {
                    // continue
                }
            }
        }
        return 0.0;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            log.warn("Failed to serialize order result", e);
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
