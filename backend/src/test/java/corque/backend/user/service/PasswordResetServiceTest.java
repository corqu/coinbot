package corque.backend.user.service;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordResetServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;
    @Mock
    private JavaMailSender mailSender;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;

    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        passwordResetService = new PasswordResetService(
                redisTemplate,
                mailSender,
                userRepository,
                refreshTokenRepository,
                passwordEncoder
        );
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void resetPassword_updatesPasswordAndDeletesRefreshToken() {
        User user = User.builder()
                .email("user@test.com")
                .password("old")
                .nickname("tester")
                .build();
        RefreshToken refreshToken = new RefreshToken(user, "rt");

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(valueOperations.get(anyString())).thenReturn("123456");
        when(passwordEncoder.encode("new-password")).thenReturn("encoded-new");
        when(refreshTokenRepository.findByUser(user)).thenReturn(Optional.of(refreshToken));

        passwordResetService.resetPassword("user@test.com", "123456", "new-password");

        assertThat(user.getPassword()).isEqualTo("encoded-new");
        verify(refreshTokenRepository).delete(refreshToken);
    }

    @Test
    void resetPassword_throwsWhenCodeMismatch() {
        User user = User.builder()
                .email("user@test.com")
                .password("old")
                .nickname("tester")
                .build();

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(valueOperations.get(anyString())).thenReturn("123456");
        when(valueOperations.increment(anyString())).thenReturn(1L);

        assertThatThrownBy(() -> passwordResetService.resetPassword("user@test.com", "654321", "new-password"))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
    }
}
