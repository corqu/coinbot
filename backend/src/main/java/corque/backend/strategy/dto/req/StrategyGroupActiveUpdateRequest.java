package corque.backend.strategy.dto.req;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class StrategyGroupActiveUpdateRequest {

    @NotNull
    private Boolean isActive;
}
