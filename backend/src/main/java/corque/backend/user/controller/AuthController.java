package corque.backend.user.controller;

import corque.backend.global.security.jwt.JwtTokenProvider;
import corque.backend.global.dto.ApiResponse;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.dto.EmailVerificationConfirmRequest;
import corque.backend.user.dto.EmailVerificationSendRequest;
import corque.backend.user.dto.LinkSocialAccountRequest;
import corque.backend.user.dto.PasswordResetConfirmRequest;
import corque.backend.user.dto.PasswordResetSendRequest;
import corque.backend.user.dto.SignInRequest;
import corque.backend.user.dto.SignUpRequest;
import corque.backend.user.dto.TokenInfo;
import corque.backend.user.dto.UserResponse;
import corque.backend.user.service.EmailVerificationService;
import corque.backend.user.service.PasswordResetService;
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
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserAuthService userAuthService;
    private final JwtTokenProvider jwtTokenProvider;
    private final EmailVerificationService emailVerificationService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/email/send")
    public ResponseEntity<ApiResponse<Void>> sendVerificationEmail(@Valid @RequestBody EmailVerificationSendRequest request) {
        emailVerificationService.sendCode(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("Verification email sent."));
    }

    @PostMapping("/email/verify")
    public ResponseEntity<ApiResponse<Void>> verifyEmailCode(@Valid @RequestBody EmailVerificationConfirmRequest request) {
        emailVerificationService.verifyCode(request.getEmail(), request.getCode());
        return ResponseEntity.ok(ApiResponse.success("Email verification completed."));
    }

    @PostMapping("/password/reset/send")
    public ResponseEntity<ApiResponse<Void>> sendPasswordResetCode(@Valid @RequestBody PasswordResetSendRequest request) {
        passwordResetService.sendResetCode(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("Password reset email sent."));
    }

    @PostMapping("/password/reset/confirm")
    public ResponseEntity<ApiResponse<Void>> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmRequest request) {
        passwordResetService.resetPassword(request.getEmail(), request.getCode(), request.getNewPassword());
        return ResponseEntity.ok(ApiResponse.success("Password reset completed."));
    }

    @PostMapping("/sign-up")
    public ResponseEntity<ApiResponse<UserResponse>> signUp(@Valid @RequestBody SignUpRequest request) {
        UserResponse response = userAuthService.signUp(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Sign-up success.", response));
    }

    @PostMapping("/sign-in")
    public ResponseEntity<ApiResponse<Void>> signIn(@Valid @RequestBody SignInRequest request, HttpServletResponse response) {
        TokenInfo tokenInfo = userAuthService.signIn(request);
        setAuthCookies(response, tokenInfo);
        return ResponseEntity.ok(ApiResponse.success("Sign-in success."));
    }

    @PostMapping("/oauth2/link")
    public ResponseEntity<ApiResponse<Void>> linkSocialAccount(@Valid @RequestBody LinkSocialAccountRequest request,
                                                               HttpServletResponse response) {
        TokenInfo tokenInfo = userAuthService.linkSocialAccount(request);
        setAuthCookies(response, tokenInfo);
        return ResponseEntity.ok(ApiResponse.success("Social account linked successfully."));
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
        setAuthCookies(response, tokenInfo);

        return ResponseEntity.ok(ApiResponse.success("Token refresh success."));
    }

    @PostMapping("/sign-out")
    public ResponseEntity<ApiResponse<Void>> signOut(Principal principal, HttpServletResponse response) {
        if (principal == null) {
            throw new ApiException(ErrorCode.USER_NOT_FOUND);
        }
        userAuthService.signOut(principal.getName());

        Cookie accessTokenCookie = new Cookie("accessToken", null);
        accessTokenCookie.setMaxAge(0);
        accessTokenCookie.setPath("/");
        response.addCookie(accessTokenCookie);

        Cookie refreshTokenCookie = new Cookie("refreshToken", null);
        refreshTokenCookie.setMaxAge(0);
        refreshTokenCookie.setPath("/");
        response.addCookie(refreshTokenCookie);

        return ResponseEntity.ok(ApiResponse.success("Sign-out success."));
    }

    private void setAuthCookies(HttpServletResponse response, TokenInfo tokenInfo) {
        Cookie accessTokenCookie = new Cookie("accessToken", tokenInfo.getAccessToken());
        accessTokenCookie.setHttpOnly(true);
        accessTokenCookie.setPath("/");
        accessTokenCookie.setMaxAge((int) jwtTokenProvider.getAccessTokenValidityInSeconds());
        accessTokenCookie.setSecure(false);
        response.addCookie(accessTokenCookie);

        Cookie refreshTokenCookie = new Cookie("refreshToken", tokenInfo.getRefreshToken());
        refreshTokenCookie.setHttpOnly(true);
        refreshTokenCookie.setPath("/");
        refreshTokenCookie.setMaxAge((int) jwtTokenProvider.getRefreshTokenValidityInSeconds());
        refreshTokenCookie.setSecure(false);
        response.addCookie(refreshTokenCookie);
    }
}
