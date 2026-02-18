package corque.backend.strategy.dto.res;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StrategyBacktestItemResultResponse {
    private Long strategyId;
    private String strategyCode;
    private String strategyName;
    private String strategySource;
    private Integer totalTrades;
    private Integer winTrades;
    private Integer lossTrades;
    private Double winRate;
    private Double realizedPnl;
}
