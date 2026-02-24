package corque.backend.strategy.repo;

import corque.backend.strategy.domain.Strategy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StrategyRepository extends JpaRepository<Strategy, Long> {
    Optional<Strategy> findByCode(String code);
    Optional<Strategy> findByCodeAndIsActiveTrue(String code);
    List<Strategy> findByIsActiveTrueOrderByIdAsc();
}
