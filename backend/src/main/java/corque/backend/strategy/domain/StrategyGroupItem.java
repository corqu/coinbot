package corque.backend.strategy.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
@Entity
@Table(
        name = "strategy_group_item",
        indexes = {
                @Index(name = "idx_strategy_group_item_group_id", columnList = "strategy_group_id"),
                @Index(name = "idx_strategy_group_item_strategy_id", columnList = "strategy_id")
        }
)
public class StrategyGroupItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "strategy_group_id", nullable = false)
    private StrategyGroup strategyGroup;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "strategy_id", nullable = false)
    private Strategy strategy;

    @Lob
    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(nullable = false)
    private Boolean enabled;

    @Builder
    public StrategyGroupItem(
            StrategyGroup strategyGroup,
            Strategy strategy,
            String paramsJson,
            Integer sortOrder,
            Boolean enabled
    ) {
        this.strategyGroup = strategyGroup;
        this.strategy = strategy;
        this.paramsJson = paramsJson;
        this.sortOrder = sortOrder == null ? 0 : sortOrder;
        this.enabled = enabled == null || enabled;
    }

    public void updateConfig(String paramsJson, Integer sortOrder, Boolean enabled) {
        if (paramsJson != null) {
            this.paramsJson = paramsJson;
        }
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
    }
}

