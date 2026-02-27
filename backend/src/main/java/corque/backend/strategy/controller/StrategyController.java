package corque.backend.strategy.controller;

import corque.backend.global.dto.ApiResponse;
import corque.backend.strategy.dto.req.StrategyGroupActiveUpdateRequest;
import corque.backend.strategy.dto.req.StrategyGroupBacktestRequest;
import corque.backend.strategy.dto.req.StrategyGroupSaveRequest;
import corque.backend.strategy.dto.res.StrategyGroupBacktestResponse;
import corque.backend.strategy.dto.res.StrategyGroupResponse;
import corque.backend.strategy.dto.res.StrategySummaryResponse;
import corque.backend.strategy.service.StrategyService;
import corque.backend.user.auth.PrincipalDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> getStrategyGroup(
            @PathVariable Long strategyGroupId,
            @AuthenticationPrincipal PrincipalDetails principalDetails
    ) {
        Long userId = principalDetails.getUserId();
        return ResponseEntity.ok(ApiResponse.success("Strategy group fetched.", strategyService.getStrategyGroup(userId, strategyGroupId)));
    }

    @GetMapping("/groups/me")
    public ResponseEntity<ApiResponse<List<StrategyGroupResponse>>> getStrategyGroupsByUser(
            @AuthenticationPrincipal PrincipalDetails principalDetails
    ) {
        Long userId = principalDetails.getUserId();
        return ResponseEntity.ok(ApiResponse.success(
                "User strategy groups fetched.",
                strategyService.getStrategyGroupsByUser(userId)
        ));
    }

    @PostMapping("/groups/save")
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> saveStrategyGroup(
            @Valid @RequestBody StrategyGroupSaveRequest request,
            @AuthenticationPrincipal PrincipalDetails principalDetails
    ) {
        Long userId = principalDetails.getUserId();
        StrategyGroupResponse response = strategyService.saveStrategyGroup(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success("Strategy group saved.", response));
    }

    @PatchMapping("/groups/{strategyGroupId}/active")
    public ResponseEntity<ApiResponse<StrategyGroupResponse>> updateGroupActive(
            @PathVariable Long strategyGroupId,
            @Valid @RequestBody StrategyGroupActiveUpdateRequest request,
            @AuthenticationPrincipal PrincipalDetails principalDetails
    ) {
        Long userId = principalDetails.getUserId();
        StrategyGroupResponse response = strategyService.updateGroupActive(userId, strategyGroupId, request.getIsActive());
        return ResponseEntity.ok(ApiResponse.success("Strategy group active status updated.", response));
    }

    @PostMapping("/groups/{strategyGroupId}/backtest")
    public ResponseEntity<ApiResponse<StrategyGroupBacktestResponse>> runGroupBacktest(
            @PathVariable Long strategyGroupId,
            @Valid @RequestBody StrategyGroupBacktestRequest request,
            @AuthenticationPrincipal PrincipalDetails principalDetails
    ) {
        Long userId = principalDetails.getUserId();
        StrategyGroupBacktestResponse response = strategyService.runGroupBacktest(userId, strategyGroupId, request);
        return ResponseEntity.ok(ApiResponse.success("Strategy group backtest completed.", response));
    }
}
