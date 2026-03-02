package corque.backend.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // 400 Bad Request
    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "C001", "잘못된 입력 값입니다."),
    INVALID_TYPE_VALUE(HttpStatus.BAD_REQUEST, "C002", "잘못된 타입입니다."),
    EMAIL_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "U001", "이미 사용 중인 이메일입니다."),
    NICKNAME_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "U002", "이미 사용 중인 닉네임입니다."),
    EMAIL_NOT_VERIFIED(HttpStatus.BAD_REQUEST, "U004", "이메일 인증 완료 후 회원가입을 진행해 주세요."),

    // 401 Unauthorized
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "A001", "유효하지 않은 토큰입니다."),
    EXPIRED_TOKEN(HttpStatus.UNAUTHORIZED, "A002", "만료된 토큰입니다."),
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "A003", "이메일 또는 비밀번호가 일치하지 않습니다."),

    // 403 Forbidden
    HANDLE_ACCESS_DENIED(HttpStatus.FORBIDDEN, "C003", "접근이 거부되었습니다."),

    // 404 Not Found
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "U003", "사용자를 찾을 수 없습니다."),
    ENTITY_NOT_FOUND(HttpStatus.NOT_FOUND, "C004", "엔티티를 찾을 수 없습니다."),

    // 405 Method Not Allowed
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "C005", "허용되지 않은 HTTP 메서드입니다."),

    // 500 Internal Server Error
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "S001", "서버 내부 오류입니다."),

    // OAuth
    UNSUPPORTED_OAUTH2_PROVIDER(HttpStatus.BAD_REQUEST, "A004", "지원하지 않는 소셜 로그인 제공자입니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
