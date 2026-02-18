package corque.backend.user.auth.oauth2;

import corque.backend.global.exception.ApiException;
import corque.backend.global.exception.ErrorCode;

import java.util.Map;

public class OAuth2UserInfoFactory {

    public static OAuth2UserInfo of(String registrationId, Map<String, Object> attributes) {
        return switch (registrationId) {
            case "google" -> new GoogleUserInfo(attributes);
            default -> throw new ApiException(ErrorCode.UNSUPPORTED_OAUTH2_PROVIDER);
        };
    }
}
