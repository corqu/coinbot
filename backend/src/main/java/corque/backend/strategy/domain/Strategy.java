package corque.backend.strategy.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(
        name = "strategy",
        indexes = {
                @Index(name = "idx_strategy_code", columnList = "code"),
                @Index(name = "idx_strategy_is_active", columnList = "is_active")
        }
)
public class Strategy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 120)
    private String alias;

    @Column(nullable = false, length = 255)
    private String source;

    @Lob
    @Column(name = "parameter_schema_json", columnDefinition = "TEXT")
    private String parameterSchemaJson;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(nullable = false, length = 30)
    private String version;

    @Builder
    public Strategy(
            String code,
            String name,
            String alias,
            String source,
            String parameterSchemaJson,
            Boolean isActive,
            String version
    ) {
        this.code = code;
        this.name = name;
        this.alias = (alias == null || alias.isBlank()) ? name : alias;
        this.source = source;
        this.parameterSchemaJson = parameterSchemaJson;
        this.isActive = isActive != null && isActive;
        this.version = (version == null || version.isBlank()) ? "v1" : version;
    }

    public void updateInfo(String name, String alias, String source, String parameterSchemaJson, String version) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        if (alias != null && !alias.isBlank()) {
            this.alias = alias;
        }
        if (source != null && !source.isBlank()) {
            this.source = source;
        }
        if (parameterSchemaJson != null) {
            this.parameterSchemaJson = parameterSchemaJson;
        }
        if (version != null && !version.isBlank()) {
            this.version = version;
        }
    }

    public void activate() {
        this.isActive = true;
    }

    public void deactivate() {
        this.isActive = false;
    }
}

