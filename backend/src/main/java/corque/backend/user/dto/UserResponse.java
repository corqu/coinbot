package corque.backend.user.dto;

import corque.backend.user.domain.User;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class UserResponse {

    private final Long id;
    private final String email;
    private final String nickname;
    private final LocalDateTime createdAt;

    public UserResponse(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.nickname = user.getNickname();
        this.createdAt = user.getCreatedAt();
    }
}
