package corque.backend.user.auth.oauth2;

import corque.backend.global.utils.NanoIdUtil;

import java.util.Map;

public class GoogleUserInfo implements OAuth2UserInfo {

    private final Map<String, Object> attributes;

    public GoogleUserInfo(Map<String, Object> attributes) { this.attributes = attributes; }

    private String nickname;

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
        if(attributes.get("name")==null || attributes.get("name").toString().isEmpty()){
            nickname = "User_" + NanoIdUtil.generateNanoId(8);
        } else {
            nickname = attributes.get("name").toString();
        }
        return nickname;
    }
}
