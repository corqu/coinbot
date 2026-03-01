package corque.backend.signal.repo;

import corque.backend.signal.domain.SignalEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignalEventRepository extends JpaRepository<SignalEvent, Long> {
}
