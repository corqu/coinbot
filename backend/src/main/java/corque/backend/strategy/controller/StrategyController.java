package corque.backend.strategy.controller;

import corque.backend.global.dto.ApiResponse;
import corque.backend.strategy.dto.req.StrategyGroupActiveUpdateRequest;
import corque.backend.strategy.dto.req.StrategyGroupBacktestRequest;
import corque.backend.strategy.dto.req.StrategyGroupSaveRequest;
import corque.backend.strategy.dto.res.StrategyGroupBacktestResponse;
import corque.backend.strategy.dto.res.StrategyGroupResponse;
import corque.backend.strategy.dto.res.StrategySummaryResponse;
import corque.backend.strategy.service.StrategyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/strategies")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyService strategyService;

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<StrategySummaryResponse>>> getActiveStrategies() {
        return ResponseEntity.ok(ApiResponse.success("Active strategies fetched.", strategyService.getActiveStrategies()));
    }

    @GetMapping("/groups/{strategyGroupId}")
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> getStrategyGroup(@PathVariable Long strategyGroupId) {
        return ResponseEntity.ok(ApiResponse.success("Strategy group fetched.", strategyService.getStrategyGroup(strategyGroupId)));
    }

    @GetMapping("/groups/user/{userId}")
    public ResponseEntity<ApiResponse<List<StrategyGroupResponse>>> getStrategyGroupsByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(
                "User strategy groups fetched.",
                strategyService.getStrategyGroupsByUser(userId)
        ));
    }

    @PostMapping("/groups/save")
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> saveStrategyGroup(
            @Valid @RequestBody StrategyGroupSaveRequest request
    ) {
        StrategyGroupResponse response = strategyService.saveStrategyGroup(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Strategy group saved.", response));
    }

    @PatchMapping("/groups/{strategyGroupId}/active")
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> updateGroupActive(
            @PathVariable Long strategyGroupId,
            @Valid @RequestBody StrategyGroupActiveUpdateRequest request
    ) {
        StrategyGroupResponse response = strategyService.updateGroupActive(strategyGroupId, request.getIsActive());
        return ResponseEntity.ok(ApiResponse.success("Strategy group active status updated.", response));
    }

    @PostMapping("/groups/{strategyGroupId}/backtest")
    public ResponseEntity<ApiResponse<StrategyGroupBacktestResponse>> runGroupBacktest(
            @PathVariable Long strategyGroupId,
            @Valid @RequestBody StrategyGroupBacktestRequest request
    ) {
        StrategyGroupBacktestResponse response = strategyService.runGroupBacktest(strategyGroupId, request);
        return ResponseEntity.ok(ApiResponse.success("Strategy group backtest completed.", response));
    }
}
