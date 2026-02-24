from pydantic import BaseModel, Field


class DynamicBacktestStrategyRequest(BaseModel):
    strategyId: str
    strategySource: str
    params: dict = Field(default_factory=dict)


class DynamicBacktestRequest(BaseModel):
    symbol: str = "BTCUSDT"
    interval: str = Field(default="15", pattern=r"^(1|3|5|15|30|60|120|240|360|720|D|W|M)$")
    tradeQty: float = Field(default=0.001, gt=0)
    bars: int = Field(default=500, ge=100, le=2000)
    strategies: list[DynamicBacktestStrategyRequest] = Field(default_factory=list, min_length=1)


class DynamicBacktestStrategyResultResponse(BaseModel):
    strategyId: str
    totalTrades: int
    winTrades: int
    lossTrades: int
    winRate: float
    realizedPnl: float


class DynamicBacktestResponse(BaseModel):
    symbol: str
    interval: str
    bars: int
    totalTrades: int
    winTrades: int
    lossTrades: int
    winRate: float
    realizedPnl: float
    items: list[DynamicBacktestStrategyResultResponse]
