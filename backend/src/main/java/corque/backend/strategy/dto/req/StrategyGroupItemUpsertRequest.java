package corque.backend.strategy.dto.req;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class StrategyGroupItemUpsertRequest {

    @NotNull
    private Long strategyId;

    private String paramsJson;

    @NotNull
    @Min(0)
    private Integer sortOrder = 0;

    @NotNull
    private Boolean enabled = true;
}
