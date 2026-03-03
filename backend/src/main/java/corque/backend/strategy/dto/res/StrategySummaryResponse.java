package corque.backend.strategy.dto.res;

import corque.backend.strategy.domain.Strategy;
import lombok.Getter;

@Getter
public class StrategySummaryResponse {
    private final Long id;
    private final String code;
    private final String name;
    private final String alias;
    private final String source;
    private final Long parentId;
    private final String parameterSchemaJson;
    private final Boolean isActive;
    private final String version;

    public StrategySummaryResponse(Strategy strategy) {
        this.id = strategy.getId();
        this.code = strategy.getCode();
        this.name = strategy.getName();
        this.alias = strategy.getAlias();
        this.source = strategy.getSource();
        this.parentId = strategy.getParentId();
        this.parameterSchemaJson = strategy.getParameterSchemaJson();
        this.isActive = strategy.getIsActive();
        this.version = strategy.getVersion();
    }
}
