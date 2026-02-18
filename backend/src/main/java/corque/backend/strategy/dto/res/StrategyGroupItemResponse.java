package corque.backend.strategy.dto.res;

import corque.backend.strategy.domain.StrategyGroupItem;
import lombok.Getter;

@Getter
public class StrategyGroupItemResponse {
    private final Long id;
    private final Long strategyId;
    private final String strategyCode;
    private final String strategyName;
    private final String paramsJson;
    private final Integer sortOrder;
    private final Boolean enabled;

    public StrategyGroupItemResponse(StrategyGroupItem item) {
        this.id = item.getId();
        this.strategyId = item.getStrategy().getId();
        this.strategyCode = item.getStrategy().getCode();
        this.strategyName = item.getStrategy().getName();
        this.paramsJson = item.getParamsJson();
        this.sortOrder = item.getSortOrder();
        this.enabled = item.getEnabled();
    }
}
