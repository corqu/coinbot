package corque.backend.strategy.repo;

import corque.backend.strategy.domain.StrategyGroupItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StrategyGroupItemRepository extends JpaRepository<StrategyGroupItem, Long> {
    List<StrategyGroupItem> findByStrategyGroupIdOrderBySortOrderAscIdAsc(Long strategyGroupId);
    List<StrategyGroupItem> findByStrategyIdAndEnabledTrueAndStrategyGroupIsActiveTrueOrderBySortOrderAscIdAsc(Long strategyId);
    void deleteByStrategyGroupId(Long strategyGroupId);
}
