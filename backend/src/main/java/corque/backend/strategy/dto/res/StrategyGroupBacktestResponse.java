package corque.backend.strategy.dto.res;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class StrategyGroupBacktestResponse {
    private Long strategyGroupId;
    private Long userId;
    private String symbol;
    private String interval;
    private Integer bars;
    private Double tradeQty;
    private Integer totalTrades;
    private Integer winTrades;
    private Integer lossTrades;
    private Double winRate;
    private Double realizedPnl;
    private List<StrategyBacktestItemResultResponse> items;
}
