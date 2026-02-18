package corque.backend.global.config.jwt;

import corque.backend.global.security.jwt.JwtTokenProvider;
import corque.backend.user.auth.PrincipalDetails;
import corque.backend.user.domain.User;
import corque.backend.user.repo.UserRepository;
import jdk.jfr.Name;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

class JwtTokenProviderTest {

    @Mock
    private UserRepository userRepository;

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        jwtTokenProvider = new JwtTokenProvider(userRepository);
        ReflectionTestUtils.setField(jwtTokenProvider, "secretKeyString",
                "c3ByaW5nYm9vdC1qd3Qtc2VjcmV0LWtleS1mb3ItYXV0aGVudGljYXRpb24tcHVycG9zZXM=");
        ReflectionTestUtils.setField(jwtTokenProvider, "accessTokenValidityInSeconds", 3600L);
        ReflectionTestUtils.setField(jwtTokenProvider, "refreshTokenValidityInSeconds", 604800L);
    }

    @Test
    @Name("refresh토큰의 인증 정보가 PrincipalDetails로 반환되는지, 권한이 잘 파싱되는지")
    void getAuthentication_returnsPrincipalDetailsForRefreshToken() {
        User user = User.builder()
                .email("user@test.com")
                .password("encoded")
                .nickname("tester")
                .build();
        when(userRepository.findByEmail("user@test.com")).thenReturn(Optional.of(user));

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com",
                "",
                List.of(new SimpleGrantedAuthority("USER"))
        );

        String refreshToken = jwtTokenProvider.createRefreshToken(authentication);
        Authentication parsed = jwtTokenProvider.getAuthentication(refreshToken);

        assertThat(parsed.getPrincipal()).isInstanceOf(PrincipalDetails.class);
        assertThat(parsed.getAuthorities()).extracting("authority").containsExactly("USER");
    }
}
