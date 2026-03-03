export type StrategySummary = {
  id: number;
  code: string;
  name: string;
  alias?: string;
  source: string;
  parameterSchemaJson: string;
  isActive: boolean;
  version: string;
};

export type StrategyGroupItem = {
  id: number;
  strategyId: number;
  strategyCode: string;
  strategyName: string;
  paramsJson: string;
  sortOrder: number;
  enabled: boolean;
};

export type StrategyGroup = {
  id: number;
  userId: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  items: StrategyGroupItem[];
};

export type StrategyGroupItemUpsertPayload = {
  strategyId: number;
  paramsJson?: string;
  sortOrder: number;
  enabled: boolean;
};

export type StrategyGroupSavePayload = {
  strategyGroupId?: number;
  name: string;
  description?: string;
  isActive: boolean;
  items: StrategyGroupItemUpsertPayload[];
};

export type StrategyGroupActiveUpdatePayload = {
  isActive: boolean;
};

export type StrategyGroupBacktestPayload = {
  symbol: string;
  interval: string;
  bars: number;
  tradeQty: number;
  strategyIds: number[];
};

export type StrategyBacktestItemResult = {
  strategyId: number;
  strategyCode: string;
  strategyName: string;
  strategySource: string;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  realizedPnl: number;
};

export type StrategyGroupBacktestResponse = {
  strategyGroupId: number;
  userId: number;
  symbol: string;
  interval: string;
  bars: number;
  tradeQty: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  realizedPnl: number;
  items: StrategyBacktestItemResult[];
};
