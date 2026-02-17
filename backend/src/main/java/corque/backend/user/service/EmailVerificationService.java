package corque.backend.user.service;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;
import corque.backend.user.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration VERIFIED_TTL = Duration.ofHours(1);
    private static final Duration RESEND_COOLDOWN_TTL = Duration.ofSeconds(60);
    private static final Duration ATTEMPT_TTL = Duration.ofMinutes(5);
    private static final long MAX_ATTEMPTS = 5L;

    private final RedisTemplate<String, String> redisTemplate;
    private final JavaMailSender mailSender;
    private final UserRepository userRepository;

    public void sendCode(String email) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ApiException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }

        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey(email)))) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        String code = generateCode();
        redisTemplate.opsForValue().set(codeKey(email), code, CODE_TTL);
        redisTemplate.opsForValue().set(cooldownKey(email), "1", RESEND_COOLDOWN_TTL);
        redisTemplate.delete(verifiedKey(email));
        redisTemplate.delete(attemptKey(email));

        sendVerificationEmail(email, code);
    }

    public void verifyCode(String email, String code) {
        String savedCode = redisTemplate.opsForValue().get(codeKey(email));
        if (savedCode == null) {
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        if (!savedCode.equals(code)) {
            Long attempts = redisTemplate.opsForValue().increment(attemptKey(email));
            redisTemplate.expire(attemptKey(email), ATTEMPT_TTL);
            if (attempts != null && attempts >= MAX_ATTEMPTS) {
                redisTemplate.delete(codeKey(email));
                redisTemplate.delete(attemptKey(email));
            }
            throw new ApiException(ErrorCode.INVALID_INPUT_VALUE);
        }

        redisTemplate.opsForValue().set(verifiedKey(email), "true", VERIFIED_TTL);
        redisTemplate.delete(codeKey(email));
        redisTemplate.delete(attemptKey(email));
    }

    public boolean isVerified(String email) {
        return "true".equals(redisTemplate.opsForValue().get(verifiedKey(email)));
    }

    public void clearVerification(String email) {
        redisTemplate.delete(verifiedKey(email));
        redisTemplate.delete(cooldownKey(email));
        redisTemplate.delete(codeKey(email));
        redisTemplate.delete(attemptKey(email));
    }

    private void sendVerificationEmail(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);
        message.setSubject("[autoTrading] Email verification code");
        message.setText("Verification code: " + code + "\nThis code expires in 5 minutes.");

        try {
            mailSender.send(message);
        } catch (MailException e) {
            redisTemplate.delete(codeKey(email));
            redisTemplate.delete(cooldownKey(email));
            redisTemplate.delete(attemptKey(email));
            throw new ApiException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private String generateCode() {
        int value = 100000 + new SecureRandom().nextInt(900000);
        return String.valueOf(value);
    }

    private String codeKey(String email) {
        return "email:verify:code:" + email;
    }

    private String verifiedKey(String email) {
        return "email:verify:verified:" + email;
    }

    private String cooldownKey(String email) {
        return "email:verify:cooldown:" + email;
    }

    private String attemptKey(String email) {
        return "email:verify:attempt:" + email;
    }
}
