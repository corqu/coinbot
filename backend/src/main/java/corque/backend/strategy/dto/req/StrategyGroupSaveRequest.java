package corque.backend.strategy.dto.req;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class StrategyGroupSaveRequest {

    private Long strategyGroupId;

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private Boolean isActive = false;

    @Valid
    @NotEmpty
    private List<StrategyGroupItemUpsertRequest> items;
}
