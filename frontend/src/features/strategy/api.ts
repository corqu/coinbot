import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type {
  StrategyGroup,
  StrategyGroupActiveUpdatePayload,
  StrategyGroupBacktestPayload,
  StrategyGroupBacktestResponse,
  StrategyGroupSavePayload,
  StrategySummary,
} from "@/features/strategy/types";

export function getActiveStrategies(): Promise<StrategySummary[]> {
  return apiGet<StrategySummary[]>("/api/strategies/active");
}

export function getStrategyCatalog(): Promise<StrategySummary[]> {
  return apiGet<StrategySummary[]>("/api/strategies/catalog");
}

export function getStrategyGroup(strategyGroupId: number): Promise<StrategyGroup> {
  return apiGet<StrategyGroup>(`/api/strategies/groups/${strategyGroupId}`);
}

export function getMyStrategyGroups(): Promise<StrategyGroup[]> {
  return apiGet<StrategyGroup[]>("/api/strategies/groups/me");
}

export function saveStrategyGroup(payload: StrategyGroupSavePayload): Promise<StrategyGroup> {
  return apiPost<StrategyGroup, StrategyGroupSavePayload>("/api/strategies/groups/save", payload);
}

export function updateGroupActive(
  strategyGroupId: number,
  payload: StrategyGroupActiveUpdatePayload,
): Promise<StrategyGroup> {
  return apiPatch<StrategyGroup, StrategyGroupActiveUpdatePayload>(
    `/api/strategies/groups/${strategyGroupId}/active`,
    payload,
  );
}

export function runGroupBacktest(
  strategyGroupId: number,
  payload: StrategyGroupBacktestPayload,
): Promise<StrategyGroupBacktestResponse> {
  return apiPost<StrategyGroupBacktestResponse, StrategyGroupBacktestPayload>(
    `/api/strategies/groups/${strategyGroupId}/backtest`,
    payload,
  );
}
