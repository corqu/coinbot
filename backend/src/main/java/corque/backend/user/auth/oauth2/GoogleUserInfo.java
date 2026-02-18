package corque.backend.user.auth.oauth2;

import corque.backend.global.utils.NanoIdUtil;

import java.util.Map;

public class GoogleUserInfo implements OAuth2UserInfo {

    private final Map<String, Object> attributes;

    public GoogleUserInfo(Map<String, Object> attributes) { this.attributes = attributes; }

    @Override
    public String getProviderId() {
        return attributes.get("sub").toString();
    }

    @Override
    public String getEmail() {
        return attributes.get("email").toString();
    }

    @Override
    public String getNickname() {
        Object name = attributes.get("name");
        if (name == null || name.toString().isBlank()) {
            return "User_" + NanoIdUtil.generateNanoId(8);
        }
        return name.toString();
    }
}
