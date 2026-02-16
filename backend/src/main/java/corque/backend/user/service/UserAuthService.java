package corque.backend.user.service;

import corque.backend.global.config.jwt.JwtTokenProvider;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import corque.backend.user.dto.SignInRequest;
import corque.backend.user.dto.SignUpRequest;
import corque.backend.user.dto.TokenInfo;
import corque.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserAuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;


    @Transactional
    public UserResponse signUp(SignUpRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ApiException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        User user = userRepository.save(request.toEntity(passwordEncoder.encode(request.getPassword())));
        return new UserResponse(user);
    }

    @Transactional
    public TokenInfo signIn(SignInRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );

            String accessToken = jwtTokenProvider.createAccessToken(authentication);
            String refreshTokenValue = jwtTokenProvider.createRefreshToken(authentication);

            User user = userRepository.findByEmail(authentication.getName())
                    .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

            refreshTokenRepository.findByUser(user)
                    .ifPresentOrElse(
                            refreshToken -> refreshToken.updateToken(refreshTokenValue),
                            () -> refreshTokenRepository.save(new RefreshToken(user, refreshTokenValue))
                    );

            return TokenInfo.builder()
                    .grantType("Bearer")
                    .accessToken(accessToken)
                    .refreshToken(refreshTokenValue)
                    .build();
        } catch (BadCredentialsException e) {
            throw new ApiException(ErrorCode.LOGIN_FAILED);
        }
    }

    @Transactional
    public TokenInfo refresh(String refreshTokenValue) {
        // 1. Refresh Token 유효성 검사
        if (!jwtTokenProvider.validateToken(refreshTokenValue)) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }

        // 2. DB에서 Refresh Token 조회
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_TOKEN));

        // 3. Refresh Token에서 얻은 정보로 Authentication 객체 생성
        Authentication authentication = jwtTokenProvider.getAuthentication(refreshTokenValue);

        // 4. 새로운 Access Token 및 Refresh Token 발급 (Rotate)
        String newAccessToken = jwtTokenProvider.createAccessToken(authentication);
        String newRefreshTokenValue = jwtTokenProvider.createRefreshToken(authentication);

        // 5. DB의 Refresh Token 업데이트
        refreshToken.updateToken(newRefreshTokenValue);

        return TokenInfo.builder()
                .grantType("Bearer")
                .accessToken(newAccessToken)
                .refreshToken(newRefreshTokenValue)
                .build();
    }

    @Transactional
    public void signOut(String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        refreshTokenRepository.findByUser(user)
                .ifPresent(refreshTokenRepository::delete);
    }
}
