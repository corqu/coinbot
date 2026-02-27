package corque.backend.strategy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import corque.backend.strategy.domain.StrategyGroup;
import corque.backend.strategy.domain.StrategyGroupItem;
import corque.backend.strategy.repo.StrategyGroupItemRepository;
import corque.backend.strategy.repo.StrategyGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class StrategyAssignmentRedisSyncService {

    private final StrategyGroupRepository strategyGroupRepository;
    private final StrategyGroupItemRepository strategyGroupItemRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${trading.redis.strategy-group-hash-key:trading:strategy-groups}")
    private String strategyGroupHashKey;

    @Value("${trading.redis.active-group-set-key:trading:strategy-groups:active}")
    private String activeGroupSetKey;

    @Value("${trading.redis.event-channel:trading:strategy-groups:events}")
    private String eventChannel;

    public void syncGroupAfterCommit(Long strategyGroupId) {
        if (strategyGroupId == null) {
            return;
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    syncGroupNow(strategyGroupId);
                }
            });
            return;
        }
        syncGroupNow(strategyGroupId);
    }

    @Transactional(readOnly = true)
    public void syncAllGroups() {
        strategyGroupRepository.findAll()
                .forEach(group -> syncGroupNow(group.getId()));
    }

    @Transactional(readOnly = true)
    public void syncGroupNow(Long strategyGroupId) {
        try {
            StrategyGroup group = strategyGroupRepository.findById(strategyGroupId).orElse(null);
            if (group == null) {
                removeGroup(strategyGroupId);
                publishEvent("GROUP_REMOVED", strategyGroupId, false);
                return;
            }

            List<StrategyGroupItem> items = strategyGroupItemRepository
                    .findByStrategyGroupIdOrderBySortOrderAscIdAsc(group.getId())
                    .stream()
                    .filter(item -> Boolean.TRUE.equals(item.getEnabled()))
                    .toList();

            boolean active = Boolean.TRUE.equals(group.getIsActive()) && !items.isEmpty();
            if (!active) {
                removeGroup(group.getId());
                publishEvent("GROUP_REMOVED", group.getId(), false);
                return;
            }

            Map<String, Object> groupPayload = new HashMap<>();
            groupPayload.put("groupId", group.getId());
            groupPayload.put("userId", group.getUserId());
            groupPayload.put("name", group.getName());
            groupPayload.put("description", group.getDescription());
            groupPayload.put("isActive", group.getIsActive());
            groupPayload.put("updatedAt", Instant.now().toString());
            groupPayload.put("items", items.stream().map(this::toItemPayload).toList());

            String payload = objectMapper.writeValueAsString(groupPayload);

            String groupIdKey = String.valueOf(group.getId());
            redisTemplate.opsForHash().put(strategyGroupHashKey, groupIdKey, payload);
            redisTemplate.opsForSet().add(activeGroupSetKey, groupIdKey);

            publishEvent("GROUP_UPSERTED", group.getId(), active);
        } catch (Exception e) {
            log.error("Failed to sync strategy group to redis. groupId={}", strategyGroupId, e);
        }
    }

    private Map<String, Object> toItemPayload(StrategyGroupItem item) {
        return Map.of(
                "itemId", item.getId(),
                "sortOrder", item.getSortOrder(),
                "strategyId", item.getStrategy().getId(),
                "strategyCode", item.getStrategy().getCode(),
                "strategyName", item.getStrategy().getName(),
                "strategySource", item.getStrategy().getSource(),
                "paramsJson", item.getParamsJson() == null ? "" : item.getParamsJson()
        );
    }

    private void removeGroup(Long strategyGroupId) {
        String groupIdKey = String.valueOf(strategyGroupId);
        redisTemplate.opsForHash().delete(strategyGroupHashKey, groupIdKey);
        redisTemplate.opsForSet().remove(activeGroupSetKey, groupIdKey);
    }

    private void publishEvent(String eventType, Long groupId, boolean active) {
        try {
            String eventPayload = objectMapper.writeValueAsString(Map.of(
                    "eventType", eventType,
                    "groupId", groupId,
                    "active", active,
                    "occurredAt", Instant.now().toString()
            ));
            redisTemplate.convertAndSend(eventChannel, eventPayload);
        } catch (Exception e) {
            log.warn("Failed to publish strategy redis event. groupId={}, eventType={}", groupId, eventType, e);
        }
    }
}
