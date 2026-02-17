package corque.backend.user.service;

import corque.backend.global.config.jwt.JwtTokenProvider;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import corque.backend.user.dto.LinkSocialAccountRequest;
import corque.backend.user.dto.SignUpRequest;
import corque.backend.user.dto.TokenInfo;
import corque.backend.user.dto.UserResponse;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private EmailVerificationService emailVerificationService;

    private UserAuthService userAuthService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        userAuthService = new UserAuthService(
                userRepository,
                refreshTokenRepository,
                passwordEncoder,
                authenticationManager,
                jwtTokenProvider,
                emailVerificationService
        );
    }

    @Test
    void linkSocialAccount_linksProviderAndIssuesTokens() {
        User user = User.builder()
                .email("user@test.com")
                .password("encoded")
                .nickname("tester")
                .build();
        ReflectionTestUtils.setField(user, "id", 1L);

        LinkSocialAccountRequest request = new LinkSocialAccountRequest();
        ReflectionTestUtils.setField(request, "email", "user@test.com");
        ReflectionTestUtils.setField(request, "password", "plain");
        ReflectionTestUtils.setField(request, "provider", "google");
        ReflectionTestUtils.setField(request, "providerId", "google-sub-1");

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("plain", "encoded")).thenReturn(true);
        when(jwtTokenProvider.createAccessToken(any())).thenReturn("access-token");
        when(jwtTokenProvider.createRefreshToken(any())).thenReturn("refresh-token");
        when(refreshTokenRepository.findByUser(user)).thenReturn(Optional.empty());
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TokenInfo tokenInfo = userAuthService.linkSocialAccount(request);

        assertThat(user.getProvider()).isEqualTo("google");
        assertThat(user.getProviderId()).isEqualTo("google-sub-1");
        assertThat(tokenInfo.getAccessToken()).isEqualTo("access-token");
        assertThat(tokenInfo.getRefreshToken()).isEqualTo("refresh-token");
    }

    @Test
    void linkSocialAccount_throwsWhenPasswordMismatch() {
        User user = User.builder()
                .email("user@test.com")
                .password("encoded")
                .nickname("tester")
                .build();

        LinkSocialAccountRequest request = new LinkSocialAccountRequest();
        ReflectionTestUtils.setField(request, "email", "user@test.com");
        ReflectionTestUtils.setField(request, "password", "wrong");
        ReflectionTestUtils.setField(request, "provider", "google");
        ReflectionTestUtils.setField(request, "providerId", "google-sub-1");

        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded")).thenReturn(false);

        assertThatThrownBy(() -> userAuthService.linkSocialAccount(request))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.LOGIN_FAILED);
    }

    @Test
    void signUp_throwsWhenEmailNotVerified() {
        SignUpRequest request = new SignUpRequest();
        ReflectionTestUtils.setField(request, "email", "new@test.com");
        ReflectionTestUtils.setField(request, "password", "pw");
        ReflectionTestUtils.setField(request, "nickname", "nick");

        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.empty());
        when(emailVerificationService.isVerified("new@test.com")).thenReturn(false);

        assertThatThrownBy(() -> userAuthService.signUp(request))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_INPUT_VALUE);
    }

    @Test
    void signUp_clearsVerificationOnSuccess() {
        SignUpRequest request = new SignUpRequest();
        ReflectionTestUtils.setField(request, "email", "new@test.com");
        ReflectionTestUtils.setField(request, "password", "pw");
        ReflectionTestUtils.setField(request, "nickname", "nick");

        User saved = User.builder()
                .email("new@test.com")
                .password("encoded")
                .nickname("nick")
                .build();

        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.empty());
        when(emailVerificationService.isVerified("new@test.com")).thenReturn(true);
        when(passwordEncoder.encode("pw")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenReturn(saved);

        UserResponse response = userAuthService.signUp(request);

        assertThat(response.getEmail()).isEqualTo("new@test.com");
        verify(emailVerificationService).clearVerification("new@test.com");
    }
}
