package corque.backend.global.security.jwt;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.auth.PrincipalDetails;
import corque.backend.user.domain.User;
import corque.backend.user.repo.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.UnsupportedJwtException;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private final UserRepository userRepository;

    @Value("${jwt.secret}")
    private String secretKeyString;

    private SecretKey secretKey;

    @Value("${jwt.access-token-validity-in-seconds}")
    private long accessTokenValidityInSeconds;

    @Value("${jwt.refresh-token-validity-in-seconds}")
    private long refreshTokenValidityInSeconds;

    public long getAccessTokenValidityInSeconds() {
        return accessTokenValidityInSeconds;
    }

    public long getRefreshTokenValidityInSeconds() {
        return refreshTokenValidityInSeconds;
    }

    public String createAccessToken(Authentication authentication) {
        return createToken(authentication, accessTokenValidityInSeconds, "auth");
    }

    public String createRefreshToken(Authentication authentication) {
        return createToken(authentication, refreshTokenValidityInSeconds, "refresh");
    }

    private String createToken(Authentication authentication, long validityInSeconds, String claimType) {
        Date now = new Date();
        Date validity = new Date(now.getTime() + validityInSeconds * 1000);

        Claims claims = Jwts.claims().setSubject(authentication.getName());
        if ("auth".equals(claimType)) {
            claims.put("roles", authentication.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.joining(",")));
        }

        return Jwts.builder()
                .setClaims(claims)
                .setIssuedAt(now)
                .setExpiration(validity)
                .signWith(getSecretKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public Authentication getAuthentication(String token) {
        Claims claims = getClaims(token);
        String email = claims.getSubject();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        Collection<? extends GrantedAuthority> authorities;
        if (claims.containsKey("roles")) {
            authorities = Arrays.stream(claims.get("roles").toString().split(","))
                    .map(SimpleGrantedAuthority::new)
                    .collect(Collectors.toList());
        } else {
            authorities = Collections.singletonList(new SimpleGrantedAuthority(user.getRole().name()));
        }

        PrincipalDetails principalDetails = new PrincipalDetails(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                Collections.emptyMap()
        );

        return new UsernamePasswordAuthenticationToken(principalDetails, "", authorities);
    }

    public Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSecretKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public String getSubject(String token) {
        return getClaims(token).getSubject();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder().setSigningKey(getSecretKey()).build().parseClaimsJws(token);
            return true;
        } catch (SignatureException | MalformedJwtException | UnsupportedJwtException e) {
            throw new ApiException(ErrorCode.INVALID_TOKEN);
        } catch (ExpiredJwtException e) {
            throw new ApiException(ErrorCode.EXPIRED_TOKEN);
        } catch (Exception e) {
            throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private SecretKey getSecretKey() {
        if (secretKey == null) {
            byte[] keyBytes = secretKeyString.getBytes();
            this.secretKey = Keys.hmacShaKeyFor(keyBytes);
        }
        return secretKey;
    }
}
