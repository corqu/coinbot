package corque.backend.strategy.infra;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class PythonBacktestResponse {
    private String symbol;
    private String interval;
    private Integer bars;
    private Integer totalTrades;
    private Integer winTrades;
    private Integer lossTrades;
    private Double winRate;
    private Double realizedPnl;
    private List<PythonBacktestStrategyResult> items;

    @Getter
    @Setter
    @NoArgsConstructor
    public static class PythonBacktestStrategyResult {
        private String strategyId;
        private Integer totalTrades;
        private Integer winTrades;
        private Integer lossTrades;
        private Double winRate;
        private Double realizedPnl;
    }
}
