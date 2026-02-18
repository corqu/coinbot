package corque.backend.user.auth.oauth2;

public interface OAuth2UserInfo {
    String getProviderId();
    String getEmail();
    String getNickname();
}
