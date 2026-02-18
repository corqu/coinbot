package corque.backend.strategy.dto.req;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class StrategyGroupBacktestRequest {

    @NotBlank
    private String symbol = "BTCUSDT";

    @NotBlank
    private String interval = "15";

    @Min(100)
    @Max(2000)
    private Integer bars = 500;

    @DecimalMin(value = "0.0000001", inclusive = true)
    private Double tradeQty = 0.001;

    @Size(min = 1)
    private List<Long> strategyIds;
}
