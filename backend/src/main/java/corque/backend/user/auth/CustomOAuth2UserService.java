package corque.backend.user.auth;

import corque.backend.user.auth.oauth2.OAuth2UserInfo;
import corque.backend.user.auth.oauth2.OAuth2UserInfoFactory;
import corque.backend.user.domain.User;
import corque.backend.user.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String provider = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attributes = oAuth2User.getAttributes();

        OAuth2UserInfo oAuth2UserInfo = OAuth2UserInfoFactory.of(provider, attributes);

        String providerId = oAuth2UserInfo.getProviderId();
        String email = oAuth2UserInfo.getEmail();
        String nickname = oAuth2UserInfo.getNickname();

        User user = userRepository.findByEmail(email).orElse(null);

        if (user != null) {
            if (provider.equalsIgnoreCase(user.getProvider())) {
                return new PrincipalDetails(user.getId(), email, user.getRole(), attributes);
            }

            if (user.getProvider() == null || user.getProvider().isBlank()) {
                String message = "ACCOUNT_LINK_REQUIRED|" + email + "|" + provider + "|" + providerId;
                throw new OAuth2AuthenticationException(message);
            }

            log.warn("OAuth2 login blocked: email {} is already linked with {}", email, user.getProvider());
            throw new OAuth2AuthenticationException("ALREADY_LINKED_WITH_OTHER_PROVIDER");
        }

        user = User.builder()
                .email(email)
                .provider(provider)
                .providerId(providerId)
                .nickname(nickname)
                .build();

        user = userRepository.save(user);
        return new PrincipalDetails(user.getId(), email, user.getRole(), attributes);
    }
}
