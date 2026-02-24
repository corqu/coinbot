package corque.backend.strategy.infra;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@Builder
public class PythonBacktestRequest {
    private String symbol;
    private String interval;
    private Integer bars;
    private Double tradeQty;
    private List<PythonBacktestStrategyRequest> strategies;

    @Getter
    @Builder
    public static class PythonBacktestStrategyRequest {
        private String strategyId;
        private String strategySource;
        private Map<String, Object> params;
    }
}
