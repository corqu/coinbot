package corque.backend.user.auth;

import corque.backend.global.security.jwt.JwtTokenProvider;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    @Transactional
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        String accessToken = jwtTokenProvider.createAccessToken(authentication);
        String refreshTokenValue = jwtTokenProvider.createRefreshToken(authentication);

        User user = resolveUser(authentication);
        refreshTokenRepository.findByUser(user)
                .ifPresentOrElse(
                        refreshToken -> refreshToken.updateToken(refreshTokenValue),
                        () -> refreshTokenRepository.save(new RefreshToken(user, refreshTokenValue))
                );

        addCookie(response, "accessToken", accessToken, (int) jwtTokenProvider.getAccessTokenValidityInSeconds());
        addCookie(response, "refreshToken", refreshTokenValue, (int) jwtTokenProvider.getRefreshTokenValidityInSeconds());

        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"OAuth2 login success\"}");
    }

    private User resolveUser(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof PrincipalDetails principalDetails) {
            return userRepository.findById(principalDetails.getUserId())
                    .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));
    }

    private void addCookie(HttpServletResponse response, String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        cookie.setSecure(false);
        response.addCookie(cookie);
    }
}
