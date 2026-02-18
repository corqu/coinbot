from contextlib import asynccontextmanager
import importlib

from fastapi import FastAPI, HTTPException

from app.bybit_client import BybitService
from app.config import settings
from app.schemas import BacktestRequest, BacktestResponse, DynamicBacktestRequest
from app.signal_worker import signal_worker
from app.strategy.applied_startegy.ma_rsi_volume_strategy import run_backtest


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.kafka_enabled:
        signal_worker.start()
    yield
    if settings.kafka_enabled:
        await signal_worker.stop()


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


@app.post("/backtest", response_model=BacktestResponse)
def backtest(payload: BacktestRequest):
    if payload.short_window >= payload.long_window:
        raise HTTPException(status_code=400, detail="short_window must be less than long_window")

    bybit = BybitService(
        api_key=settings.bybit_api_key or None,
        api_secret=settings.bybit_api_secret or None,
        testnet=settings.bybit_testnet,
    )
    bars = bybit.get_klines(symbol=payload.symbol.upper(), interval=payload.interval, limit=payload.bars)
    if len(bars) > 1:
        bars = bars[:-1]
    result = run_backtest(
        bars=bars,
        short_window=payload.short_window,
        long_window=payload.long_window,
        qty=payload.trade_qty,
    )
    return BacktestResponse(
        strategy_id=payload.strategy_id,
        symbol=payload.symbol.upper(),
        interval=payload.interval,
        bars=len(bars),
        total_trades=result["total_trades"],
        win_trades=result["win_trades"],
        loss_trades=result["loss_trades"],
        win_rate=result["win_rate"],
        realized_pnl=result["realized_pnl"],
        equity_curve=result["equity_curve"],
    )


@app.post("/backtest/dynamic", response_model=BacktestResponse)
def backtest_dynamic(payload: DynamicBacktestRequest):
    if not payload.strategy_source.startswith("app.strategy.applied_startegy."):
        raise HTTPException(status_code=400, detail="strategy_source must start with app.strategy.applied_startegy.")

    bybit = BybitService(
        api_key=settings.bybit_api_key or None,
        api_secret=settings.bybit_api_secret or None,
        testnet=settings.bybit_testnet,
    )
    bars = bybit.get_klines(symbol=payload.symbol.upper(), interval=payload.interval, limit=payload.bars)
    if len(bars) > 1:
        bars = bars[:-1]

    try:
        strategy_module = importlib.import_module(payload.strategy_source)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"strategy_source import failed: {exc}") from exc

    run_backtest_func = getattr(strategy_module, "run_backtest", None)
    if run_backtest_func is None:
        raise HTTPException(status_code=400, detail="run_backtest function not found in strategy_source")

    kwargs = dict(payload.params or {})
    kwargs["bars"] = bars
    kwargs.setdefault("qty", payload.trade_qty)

    try:
        result = run_backtest_func(**kwargs)
    except TypeError as exc:
        raise HTTPException(status_code=400, detail=f"invalid params for run_backtest: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"backtest execution failed: {exc}") from exc

    return BacktestResponse(
        strategy_id=payload.strategy_id,
        symbol=payload.symbol.upper(),
        interval=payload.interval,
        bars=len(bars),
        total_trades=result["total_trades"],
        win_trades=result["win_trades"],
        loss_trades=result["loss_trades"],
        win_rate=result["win_rate"],
        realized_pnl=result["realized_pnl"],
        equity_curve=result["equity_curve"],
    )
