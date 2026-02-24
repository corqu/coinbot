package corque.backend.strategy.dto.res;

import corque.backend.strategy.domain.StrategyGroup;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class StrategyGroupResponse {
    private Long id;
    private Long userId;
    private String name;
    private String description;
    private Boolean isActive;
    private LocalDateTime createdAt;
    private List<StrategyGroupItemResponse> items;

    public static StrategyGroupResponse of(StrategyGroup group, List<StrategyGroupItemResponse> items) {
        return StrategyGroupResponse.builder()
                .id(group.getId())
                .userId(group.getUserId())
                .name(group.getName())
                .description(group.getDescription())
                .isActive(group.getIsActive())
                .createdAt(group.getCreatedAt())
                .items(items)
                .build();
    }
}
