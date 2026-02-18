package corque.backend.global.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

@Configuration
public class SecurityBeanConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {return new BCryptPasswordEncoder();}

    @Bean
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        return builder.build();
    }
}
