package corque.backend.user.service;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.domain.User;
import corque.backend.user.repo.RefreshTokenRepository;
import corque.backend.user.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Duration RESET_CODE_TTL = Duration.ofMinutes(10);
    private static final Duration RESET_COOLDOWN_TTL = Duration.ofSeconds(60);
    private static final Duration RESET_ATTEMPT_TTL = Duration.ofMinutes(10);
    private static final long MAX_ATTEMPTS = 5L;

    private final RedisTemplate<String, String> redisTemplate;
    private final JavaMailSender mailSender;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    public void sendResetCode(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        if (user.getPassword() == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey(email)))) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        String code = generateCode();
        redisTemplate.opsForValue().set(codeKey(email), code, RESET_CODE_TTL);
        redisTemplate.opsForValue().set(cooldownKey(email), "1", RESET_COOLDOWN_TTL);
        redisTemplate.delete(attemptKey(email));

        sendPasswordResetEmail(email, code);
    }

    @Transactional
    public void resetPassword(String email, String code, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(ErrorCode.USER_NOT_FOUND));

        String savedCode = redisTemplate.opsForValue().get(codeKey(email));
        if (savedCode == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (!savedCode.equals(code)) {
            Long attempts = redisTemplate.opsForValue().increment(attemptKey(email));
            redisTemplate.expire(attemptKey(email), RESET_ATTEMPT_TTL);
            if (attempts != null && attempts >= MAX_ATTEMPTS) {
                clearResetData(email);
            }
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        user.changePassword(passwordEncoder.encode(newPassword));
        refreshTokenRepository.findByUser(user).ifPresent(refreshTokenRepository::delete);
        clearResetData(email);
    }

    private void sendPasswordResetEmail(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[autoTrading] Password reset code");
        message.setText("Password reset code: " + code + "\nThis code expires in 10 minutes.");

        try {
            mailSender.send(message);
        } catch (MailException e) {
            clearResetData(email);
            throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private void clearResetData(String email) {
        redisTemplate.delete(codeKey(email));
        redisTemplate.delete(cooldownKey(email));
        redisTemplate.delete(attemptKey(email));
    }

    private String generateCode() {
        int value = 100000 + new SecureRandom().nextInt(900000);
        return String.valueOf(value);
    }

    private String codeKey(String email) {
        return "password:reset:code:" + email;
    }

    private String cooldownKey(String email) {
        return "password:reset:cooldown:" + email;
    }

    private String attemptKey(String email) {
        return "password:reset:attempt:" + email;
    }
}
