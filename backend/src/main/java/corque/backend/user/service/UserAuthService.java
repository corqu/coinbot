package corque.backend.user.service;

import corque.backend.global.config.jwt.JwtTokenProvider;
import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.auth.PrincipalDetails;
import corque.backend.user.domain.RefreshToken;
import corque.backend.user.domain.User;
import corque.backend.user.dto.LinkSocialAccountRequest;
import corque.backend.user.dto.SignInRequest;
import corque.backend.user.dto.SignUpRequest;
import corque.backend.user.dto.TokenInfo;
import corque.backend.user.dto.UserResponse;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.Locale;

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
    public TokenInfo linkSocialAccount(LinkSocialAccountRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        if (user.getProvider() != null && !user.getProvider().isBlank()) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (user.getPassword() == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new ApiException(ErrorCode.LOGIN_FAILED);
        }

        String provider = request.getProvider().toLowerCase(Locale.ROOT);
        user.linkProvider(provider, request.getProviderId());

        PrincipalDetails principalDetails = new PrincipalDetails(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                Collections.emptyMap()
        );

        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principalDetails,
                "",
                principalDetails.getAuthorities()
        );

        return issueTokens(user, authentication);
    }

    @Transactional
    public TokenInfo refresh(String refreshTokenValue) {
        if (!jwtTokenProvider.validateToken(refreshTokenValue)) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        }

        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_TOKEN));

        Authentication authentication = jwtTokenProvider.getAuthentication(refreshTokenValue);

        String newAccessToken = jwtTokenProvider.createAccessToken(authentication);
        String newRefreshTokenValue = jwtTokenProvider.createRefreshToken(authentication);

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

    private TokenInfo issueTokens(User user, Authentication authentication) {
        String accessToken = jwtTokenProvider.createAccessToken(authentication);
        String refreshTokenValue = jwtTokenProvider.createRefreshToken(authentication);

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
    }
}
