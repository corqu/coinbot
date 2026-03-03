package corque.backend.strategy.service;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.strategy.domain.Strategy;
import corque.backend.strategy.domain.StrategyGroup;
import corque.backend.strategy.domain.StrategyGroupItem;
import corque.backend.strategy.dto.req.StrategyGroupBacktestRequest;
import corque.backend.strategy.dto.req.StrategyGroupItemUpsertRequest;
import corque.backend.strategy.dto.req.StrategyGroupSaveRequest;
import corque.backend.strategy.dto.res.StrategyBacktestItemResultResponse;
import corque.backend.strategy.dto.res.StrategyGroupBacktestResponse;
import corque.backend.strategy.dto.res.StrategyGroupItemResponse;
import corque.backend.strategy.dto.res.StrategyGroupResponse;
import corque.backend.strategy.dto.res.StrategySummaryResponse;
import corque.backend.strategy.infra.PythonBacktestClient;
import corque.backend.strategy.infra.PythonBacktestRequest;
import corque.backend.strategy.infra.PythonBacktestResponse;
import corque.backend.strategy.repo.StrategyGroupItemRepository;
import corque.backend.strategy.repo.StrategyGroupRepository;
import corque.backend.strategy.repo.StrategyRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StrategyService {

    private final StrategyRepository strategyRepository;
    private final StrategyGroupRepository strategyGroupRepository;
    private final StrategyGroupItemRepository strategyGroupItemRepository;
    private final StrategyAssignmentRedisSyncService strategyAssignmentRedisSyncService;
    private final PythonBacktestClient pythonBacktestClient;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<StrategySummaryResponse> getActiveStrategies() {
        return strategyRepository.findByIsActiveTrueOrderByIdAsc()
                .stream()
                .map(StrategySummaryResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StrategySummaryResponse> getStrategyCatalog() {
        return strategyRepository.findAllByOrderByIdAsc()
                .stream()
                .map(StrategySummaryResponse::new)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StrategyGroupResponse> getStrategyGroupsByUser(Long userId) {
        return strategyGroupRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::toGroupResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StrategyGroupResponse getStrategyGroup(Long userId, Long strategyGroupId) {
        StrategyGroup group = getOwnedGroup(userId, strategyGroupId);
        return toGroupResponse(group);
    }

    @Transactional
    public StrategyGroupResponse saveStrategyGroup(Long userId, StrategyGroupSaveRequest request) {
        StrategyGroup group;
        if (request.getStrategyGroupId() == null) {
            group = strategyGroupRepository.save(StrategyGroup.builder()
                    .userId(userId)
                    .name(request.getName())
                    .description(request.getDescription())
                    .isActive(request.getIsActive())
                    .build());
        } else {
            group = getOwnedGroup(userId, request.getStrategyGroupId());
            group.updateInfo(request.getName(), request.getDescription(), request.getIsActive());
            strategyGroupItemRepository.deleteByStrategyGroupId(group.getId());
        }

        List<StrategyGroupItem> items = request.getItems().stream()
                .map(itemRequest -> toStrategyGroupItem(group, itemRequest))
                .toList();
        strategyGroupItemRepository.saveAll(items);
        strategyAssignmentRedisSyncService.syncGroupAfterCommit(group.getId());
        return toGroupResponse(group);
    }

    @Transactional
    public StrategyGroupResponse updateGroupActive(Long userId, Long strategyGroupId, Boolean isActive) {
        StrategyGroup group = getOwnedGroup(userId, strategyGroupId);
        if (Boolean.TRUE.equals(isActive)) {
            group.activate();
        } else {
            group.deactivate();
        }
        strategyAssignmentRedisSyncService.syncGroupAfterCommit(group.getId());
        return toGroupResponse(group);
    }

    @Transactional(readOnly = true)
    public StrategyGroupBacktestResponse runGroupBacktest(
            Long userId,
            Long strategyGroupId,
            StrategyGroupBacktestRequest request
    ) {
        StrategyGroup group = getOwnedGroup(userId, strategyGroupId);

        List<StrategyGroupItem> allEnabledItems = strategyGroupItemRepository
                .findByStrategyGroupIdOrderBySortOrderAscIdAsc(group.getId())
                .stream()
                .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                .toList();

        if (allEnabledItems.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        List<StrategyGroupItem> enabledItems = filterByRequestedStrategies(allEnabledItems, request.getStrategyIds());
        if (enabledItems.isEmpty()) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        List<StrategyBacktestItemResultResponse> itemResults = new ArrayList<>();
        PythonBacktestRequest pythonRequest = buildPythonBacktestRequest(enabledItems, request);
        PythonBacktestResponse pythonResponse = pythonBacktestClient.runDynamicBacktest(pythonRequest);
        itemResults.addAll(buildItemResults(enabledItems, pythonResponse));

        int totalTrades = safeInt(pythonResponse.getTotalTrades());
        int winTrades = safeInt(pythonResponse.getWinTrades());
        int lossTrades = safeInt(pythonResponse.getLossTrades());
        double realizedPnl = safeDouble(pythonResponse.getRealizedPnl());
        if (totalTrades == 0 && winTrades == 0 && lossTrades == 0 && realizedPnl == 0.0 && !itemResults.isEmpty()) {
            totalTrades = itemResults.stream().mapToInt(r -> safeInt(r.getTotalTrades())).sum();
            winTrades = itemResults.stream().mapToInt(r -> safeInt(r.getWinTrades())).sum();
            lossTrades = itemResults.stream().mapToInt(r -> safeInt(r.getLossTrades())).sum();
            realizedPnl = itemResults.stream().mapToDouble(r -> safeDouble(r.getRealizedPnl())).sum();
        }

        double winRate = safeDouble(pythonResponse.getWinRate());
        if (winRate == 0.0 && totalTrades > 0) {
            winRate = winTrades * 100.0 / totalTrades;
        }
        return StrategyGroupBacktestResponse.builder()
                .strategyGroupId(group.getId())
                .userId(group.getUserId())
                .symbol(request.getSymbol())
                .interval(request.getInterval())
                .bars(request.getBars())
                .tradeQty(request.getTradeQty())
                .totalTrades(totalTrades)
                .winTrades(winTrades)
                .lossTrades(lossTrades)
                .winRate(round2(winRate))
                .realizedPnl(round6(realizedPnl))
                .items(itemResults)
                .build();
    }

    private StrategyGroup getOwnedGroup(Long userId, Long strategyGroupId) {
        StrategyGroup group = strategyGroupRepository.findById(strategyGroupId)
                .orElseThrow(() -> new ApiException(ErrorCode.ENTITY_NOT_FOUND));
        if (!group.getUserId().equals(userId)) {
            throw new ApiException(ErrorCode.HANDLE_ACCESS_DENIED);
        }
        return group;
    }

    private PythonBacktestRequest buildPythonBacktestRequest(
            List<StrategyGroupItem> enabledItems,
            StrategyGroupBacktestRequest request
    ) {
        List<PythonBacktestRequest.PythonBacktestStrategyRequest> strategies = enabledItems.stream()
                .map(item -> PythonBacktestRequest.PythonBacktestStrategyRequest.builder()
                        .strategyId(item.getStrategy().getCode())
                        .strategySource(item.getStrategy().getSource())
                        .params(parseParamsJson(item.getParamsJson()))
                        .build())
                .toList();

        return PythonBacktestRequest.builder()
                .symbol(request.getSymbol())
                .interval(request.getInterval())
                .bars(request.getBars())
                .tradeQty(request.getTradeQty())
                .strategies(strategies)
                .build();
    }

    private List<StrategyBacktestItemResultResponse> buildItemResults(
            List<StrategyGroupItem> enabledItems,
            PythonBacktestResponse pythonResponse
    ) {
        Map<String, PythonBacktestResponse.PythonBacktestStrategyResult> resultByStrategyCode =
                pythonResponse.getItems() == null ? Map.of() : pythonResponse.getItems().stream()
                        .filter(item -> item.getStrategyId() != null && !item.getStrategyId().isBlank())
                        .collect(Collectors.toMap(
                                PythonBacktestResponse.PythonBacktestStrategyResult::getStrategyId,
                                item -> item,
                                (first, second) -> first
                        ));

        return enabledItems.stream()
                .map(item -> {
                    PythonBacktestResponse.PythonBacktestStrategyResult result =
                            resultByStrategyCode.get(item.getStrategy().getCode());
                    return StrategyBacktestItemResultResponse.builder()
                            .strategyId(item.getStrategy().getId())
                            .strategyCode(item.getStrategy().getCode())
                            .strategyName(item.getStrategy().getName())
                            .strategySource(item.getStrategy().getSource())
                            .totalTrades(result == null ? 0 : safeInt(result.getTotalTrades()))
                            .winTrades(result == null ? 0 : safeInt(result.getWinTrades()))
                            .lossTrades(result == null ? 0 : safeInt(result.getLossTrades()))
                            .winRate(result == null ? 0.0 : safeDouble(result.getWinRate()))
                            .realizedPnl(result == null ? 0.0 : safeDouble(result.getRealizedPnl()))
                            .build();
                })
                .toList();
    }

    private List<StrategyGroupItem> filterByRequestedStrategies(
            List<StrategyGroupItem> enabledItems,
            List<Long> requestedStrategyIds
    ) {
        if (requestedStrategyIds == null || requestedStrategyIds.isEmpty()) {
            return enabledItems;
        }

        Set<Long> requested = new HashSet<>(requestedStrategyIds);
        List<StrategyGroupItem> filteredItems = enabledItems.stream()
                .filter(item -> requested.contains(item.getStrategy().getId()))
                .toList();

        Set<Long> found = filteredItems.stream()
                .map(item -> item.getStrategy().getId())
                .collect(Collectors.toSet());
        if (!found.containsAll(requested)) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        return filteredItems;
    }

    private StrategyGroupItem toStrategyGroupItem(StrategyGroup group, StrategyGroupItemUpsertRequest request) {
        Strategy strategy = strategyRepository.findById(request.getStrategyId())
                .orElseThrow(() -> new ApiException(ErrorCode.ENTITY_NOT_FOUND));

        return StrategyGroupItem.builder()
                .strategyGroup(group)
                .strategy(strategy)
                .paramsJson(request.getParamsJson())
                .sortOrder(request.getSortOrder())
                .enabled(request.getEnabled())
                .build();
    }

    private StrategyGroupResponse toGroupResponse(StrategyGroup group) {
        List<StrategyGroupItemResponse> items = strategyGroupItemRepository
                .findByStrategyGroupIdOrderBySortOrderAscIdAsc(group.getId())
                .stream()
                .map(StrategyGroupItemResponse::new)
                .toList();
        return StrategyGroupResponse.of(group, items);
    }

    private Map<String, Object> parseParamsJson(String paramsJson) {
        if (paramsJson == null || paramsJson.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(paramsJson, new TypeReference<>() {});
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }

    private double safeDouble(Double value) {
        return value == null ? 0.0 : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private double round6(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }
}
