package corque.backend.user.repo;

import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByUser(User user);
    Optional<RefreshToken> findByToken(String token);
}
