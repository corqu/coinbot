from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    strategy_id: str = "ma_rsi_volume_v1"
    symbol: str = "BTCUSDT"
    interval: str = Field(default="15", pattern=r"^(1|3|5|15|30|60|120|240|360|720|D|W|M)$")
    short_window: int = Field(default=9, ge=2, le=200)
    long_window: int = Field(default=21, ge=3, le=400)
    trade_qty: float = Field(default=0.001, gt=0)
    bars: int = Field(default=500, ge=100, le=1000)


class BacktestPoint(BaseModel):
    ts: int
    equity: float


class BacktestResponse(BaseModel):
    strategy_id: str
    symbol: str
    interval: str
    bars: int
    total_trades: int
    win_trades: int
    loss_trades: int
    win_rate: float
    realized_pnl: float
    equity_curve: list[BacktestPoint]


class DynamicBacktestRequest(BaseModel):
    strategy_id: str
    strategy_source: str
    symbol: str = "BTCUSDT"
    interval: str = Field(default="15", pattern=r"^(1|3|5|15|30|60|120|240|360|720|D|W|M)$")
    trade_qty: float = Field(default=0.001, gt=0)
    bars: int = Field(default=500, ge=100, le=2000)
    params: dict = Field(default_factory=dict)
