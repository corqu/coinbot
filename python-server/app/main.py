from contextlib import asynccontextmanager
import asyncio
import importlib

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.bybit_client import BybitService
from app.config import settings
from app.market_stream import market_stream_service
from app.schemas import DynamicBacktestRequest, DynamicBacktestResponse, DynamicBacktestStrategyResultResponse
from app.signal_worker import signal_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    market_stream_service.start(asyncio.get_running_loop())
    if settings.kafka_enabled:
        signal_worker.start()
    yield
    if settings.kafka_enabled:
        await signal_worker.stop()
    await market_stream_service.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "env": settings.app_env,
        "kafka_enabled": settings.kafka_enabled,
        "symbols": settings.symbols,
        "intervals": settings.intervals,
        "poll_interval_sec": settings.market_poll_interval_sec,
    }


@app.websocket("/ws/market")
async def ws_market(
    websocket: WebSocket,
    symbol: str = Query(default="BTCUSDT"),
    interval: str = Query(default="15"),
    limit: int = Query(default=200, ge=50, le=500),
):
    await websocket.accept()
    normalized_symbol = symbol.upper()
    await market_stream_service.register(websocket, normalized_symbol, interval, limit)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        market_stream_service.unregister(websocket, normalized_symbol, interval)


@app.post("/backtest/dynamic", response_model=DynamicBacktestResponse)
def backtest_dynamic(payload: DynamicBacktestRequest):
    bybit = BybitService(
        api_key=settings.bybit_api_key or None,
        api_secret=settings.bybit_api_secret or None,
        testnet=settings.bybit_testnet,
    )
    bars = bybit.get_klines(symbol=payload.symbol.upper(), interval=payload.interval, limit=payload.bars)
    if len(bars) > 1:
        bars = bars[:-1]

    total_trades = 0
    win_trades = 0
    loss_trades = 0
    realized_pnl = 0.0
    items: list[DynamicBacktestStrategyResultResponse] = []

    for strategy in payload.strategies:
        if not strategy.strategySource.startswith("app.strategy.applied_startegy."):
            raise HTTPException(status_code=400, detail="strategySource must start with app.strategy.applied_startegy.")

        try:
            strategy_module = importlib.import_module(strategy.strategySource)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"strategySource import failed for {strategy.strategyId}: {exc}",
            ) from exc

        run_backtest_func = getattr(strategy_module, "run_backtest", None)
        if run_backtest_func is None:
            raise HTTPException(
                status_code=400,
                detail=f"run_backtest function not found in strategySource for {strategy.strategyId}",
            )

        kwargs = dict(strategy.params or {})
        kwargs["bars"] = bars
        kwargs.setdefault("qty", payload.tradeQty)

        try:
            result = run_backtest_func(**kwargs)
        except TypeError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"invalid params for run_backtest in {strategy.strategyId}: {exc}",
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"backtest execution failed in {strategy.strategyId}: {exc}",
            ) from exc

        item_total = int(result.get("total_trades", 0))
        item_win = int(result.get("win_trades", 0))
        item_loss = int(result.get("loss_trades", 0))
        item_pnl = float(result.get("realized_pnl", 0.0))
        item_win_rate = float(result.get("win_rate", 0.0))

        total_trades += item_total
        win_trades += item_win
        loss_trades += item_loss
        realized_pnl += item_pnl

        items.append(
            DynamicBacktestStrategyResultResponse(
                strategyId=strategy.strategyId,
                totalTrades=item_total,
                winTrades=item_win,
                lossTrades=item_loss,
                winRate=item_win_rate,
                realizedPnl=item_pnl,
            )
        )

    group_win_rate = (win_trades * 100.0 / total_trades) if total_trades > 0 else 0.0

    return DynamicBacktestResponse(
        symbol=payload.symbol.upper(),
        interval=payload.interval,
        bars=len(bars),
        totalTrades=total_trades,
        winTrades=win_trades,
        lossTrades=loss_trades,
        winRate=group_win_rate,
        realizedPnl=realized_pnl,
        items=items,
    )
