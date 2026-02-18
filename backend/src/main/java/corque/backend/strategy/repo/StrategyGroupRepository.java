package corque.backend.strategy.repo;

import corque.backend.strategy.domain.StrategyGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StrategyGroupRepository extends JpaRepository<StrategyGroup, Long> {
    List<StrategyGroup> findByUserIdOrderByCreatedAtDesc(Long userId);
}

