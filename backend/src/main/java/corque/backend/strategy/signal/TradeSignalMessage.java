package corque.backend.strategy.signal;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TradeSignalMessage {
    private String type;

    @JsonProperty("strategy_id")
    private String strategyId;

    private String symbol;
    private String interval;
    private String signal;
    private Double price;
    private Long ts;

    @JsonProperty("signal_id")
    private String signalId;
}
