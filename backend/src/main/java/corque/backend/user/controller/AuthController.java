package corque.backend.user.controller;

import corque.backend.global.config.jwt.JwtTokenProvider;
import corque.backend.global.dto.ApiResponse;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.dto.SignInRequest;
import corque.backend.user.dto.SignUpRequest;
import corque.backend.user.dto.TokenInfo;
import corque.backend.user.dto.UserResponse;
import corque.backend.user.service.UserAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import java.security.Principal;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserAuthService userAuthService;
    private final JwtTokenProvider jwtTokenProvider;

    @PostMapping("/sign-up")
    public ResponseEntity<ApiResponse<UserResponse>> signUp(@Valid @RequestBody SignUpRequest request) {
        UserResponse response = userAuthService.signUp(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("회원가입에 성공했습니다.", response));
    }

    @PostMapping("/sign-in")
    public ResponseEntity<ApiResponse<Void>> signIn(@Valid @RequestBody SignInRequest request, HttpServletResponse response) {
        TokenInfo tokenInfo = userAuthService.signIn(request);

        Cookie accessTokenCookie = new Cookie("accessToken", tokenInfo.getAccessToken());
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setPath("/");
        accessTokenCookie.setMaxAge((int) jwtTokenProvider.getAccessTokenValidityInSeconds());
        accessTokenCookie.setSecure(false); // HTTPS 환경에서는 true로 설정
        response.addCookie(accessTokenCookie);

        Cookie refreshTokenCookie = new Cookie("refreshToken", tokenInfo.getRefreshToken());
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setMaxAge((int) jwtTokenProvider.getRefreshTokenValidityInSeconds());
        refreshTokenCookie.setSecure(false); // HTTPS 환경에서는 true로 설정
        response.addCookie(refreshTokenCookie);

        return ResponseEntity.ok(ApiResponse.success("로그인에 성공했습니다."));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<Void>> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = null;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (cookie.getName().equals("refreshToken")) {
                    refreshToken = cookie.getValue();
                    break;
                }
            }
        }

        if (refreshToken == null) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }

        TokenInfo tokenInfo = userAuthService.refresh(refreshToken);

        Cookie accessTokenCookie = new Cookie("accessToken", tokenInfo.getAccessToken());
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setPath("/");
        accessTokenCookie.setMaxAge((int) jwtTokenProvider.getAccessTokenValidityInSeconds());
        accessTokenCookie.setSecure(false); // HTTPS 환경에서는 true로 설정
        response.addCookie(accessTokenCookie);

        Cookie refreshTokenCookie = new Cookie("refreshToken", tokenInfo.getRefreshToken());
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setMaxAge((int) jwtTokenProvider.getRefreshTokenValidityInSeconds());
        refreshTokenCookie.setSecure(false); // HTTPS 환경에서는 true로 설정
        response.addCookie(refreshTokenCookie);

        return ResponseEntity.ok(ApiResponse.success("토큰 재발급에 성공했습니다."));
    }

    @PostMapping("/sign-out")
    public ResponseEntity<ApiResponse<Void>> signOut(Principal principal, HttpServletResponse response) {
        if (principal == null) {
            throw new ApiException(ErrorCode.USER_NOT_FOUND);
        }
        userAuthService.signOut(principal.getName());

        // Expire cookies
        Cookie accessTokenCookie = new Cookie("accessToken", null);
        accessTokenCookie.setMaxAge(0);
        accessTokenCookie.setPath("/");
        response.addCookie(accessTokenCookie);

        Cookie refreshTokenCookie = new Cookie("refreshToken", null);
        refreshTokenCookie.setMaxAge(0);
        refreshTokenCookie.setPath("/");
        response.addCookie(refreshTokenCookie);

        return ResponseEntity.ok(ApiResponse.success("로그아웃에 성공했습니다."));
    }
}
