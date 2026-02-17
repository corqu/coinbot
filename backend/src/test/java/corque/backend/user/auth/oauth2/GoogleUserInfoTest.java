package corque.backend.user.auth.oauth2;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GoogleUserInfoTest {

    @Test
    void getNickname_usesNameWhenPresent() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("name", "google-user");

        GoogleUserInfo googleUserInfo = new GoogleUserInfo(attributes);

        assertThat(googleUserInfo.getNickname()).isEqualTo("google-user");
    }

    @Test
    void getNickname_generatesFallbackWhenNameIsBlank() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("name", "   ");

        GoogleUserInfo googleUserInfo = new GoogleUserInfo(attributes);
        String nickname = googleUserInfo.getNickname();

        assertThat(nickname).startsWith("User_");
        assertThat(nickname.length()).isEqualTo(13);
    }
}
