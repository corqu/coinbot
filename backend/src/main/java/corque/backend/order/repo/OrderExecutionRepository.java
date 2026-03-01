package corque.backend.order.repo;

import corque.backend.order.domain.OrderExecution;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderExecutionRepository extends JpaRepository<OrderExecution, Long> {
}
