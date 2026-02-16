import asyncio
import logging
import threading
from dataclasses import dataclass

from app.bybit_client import BybitService
from app.config import settings
from app.event_bus import event_bus
from app.strategy.applied_startegy.ma_rsi_volume_strategy import generate_signal


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StrategySpec:
    strategy_id: str
    short_window: int
    long_window: int
    trade_qty: float


class SignalWorker:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._ws = None
        self._lock = threading.Lock()
        self._last_candle_ts: dict[tuple[str, str], int] = {}
        self._bars_cache: dict[tuple[str, str], list[dict]] = {}
        self._strategies: list[StrategySpec] = [
            StrategySpec(
                strategy_id="ma_rsi_volume_v1",
                short_window=settings.default_short_window,
                long_window=settings.default_long_window,
                trade_qty=settings.default_trade_qty,
            )
        ]

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        if settings.bybit_ws_enabled:
            self._start_ws()
            return
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if settings.bybit_ws_enabled:
            self._stop_ws()
            return
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        while True:
            try:
                self._tick()
            except Exception:
                logger.exception("Signal loop error")
            await asyncio.sleep(settings.market_poll_interval_sec)

    def _tick(self) -> None:
        symbols = [s.strip().upper() for s in settings.symbols.split(",") if s.strip()]
        intervals = [s.strip() for s in settings.intervals.split(",") if s.strip()]
        if not symbols or not intervals:
            return

        bybit = BybitService(
            api_key=settings.bybit_api_key or None,
            api_secret=settings.bybit_api_secret or None,
            testnet=settings.bybit_testnet,
        )

        for symbol in symbols:
            for interval in intervals:
                self._process_symbol_interval(bybit, symbol, interval)

    def _start_ws(self) -> None:
        symbols = [s.strip().upper() for s in settings.symbols.split(",") if s.strip()]
        intervals = [s.strip() for s in settings.intervals.split(",") if s.strip()]
        if not symbols or not intervals:
            return

        bybit = BybitService(
            api_key=settings.bybit_api_key or None,
            api_secret=settings.bybit_api_secret or None,
            testnet=settings.bybit_testnet,
        )
        max_window = max(spec.long_window for spec in self._strategies)

        for symbol in symbols:
            for interval in intervals:
                bars = bybit.get_klines(symbol=symbol, interval=interval, limit=max(max_window + 5, 50))
                if len(bars) > 1:
                    bars = bars[:-1]
                with self._lock:
                    self._bars_cache[(symbol, interval)] = bars
                    if bars:
                        self._last_candle_ts[(symbol, interval)] = bars[-1]["ts"]

        try:
            from pybit.unified_trading import WebSocket
        except Exception:
            logger.exception("WebSocket import failed, falling back to polling")
            self._task = asyncio.create_task(self._run_loop())
            return

        self._ws = WebSocket(testnet=settings.bybit_testnet, channel_type="linear")
        for symbol in symbols:
            for interval in intervals:
                self._ws.kline_stream(
                    interval=interval,
                    symbol=symbol,
                    callback=lambda msg, s=symbol, i=interval: self._on_kline(msg, s, i),
                )

    def _stop_ws(self) -> None:
        if self._ws:
            try:
                self._ws.exit()
            except Exception:
                logger.exception("WebSocket exit failed")
            self._ws = None

    def _on_kline(self, message: dict, symbol: str, interval: str) -> None:
        data = message.get("data")
        if not data:
            return

        candle_list = data if isinstance(data, list) else [data]
        for candle in candle_list:
            if not candle.get("confirm", False):
                continue
            closed_ts = int(candle.get("start", 0))
            if not closed_ts:
                continue
            bar = {
                "ts": closed_ts,
                "open": float(candle.get("open", 0)),
                "high": float(candle.get("high", 0)),
                "low": float(candle.get("low", 0)),
                "close": float(candle.get("close", 0)),
                "volume": float(candle.get("volume", 0)),
            }

            with self._lock:
                key = (symbol, interval)
                bars = self._bars_cache.setdefault(key, [])
                if bars and bars[-1]["ts"] == bar["ts"]:
                    bars[-1] = bar
                else:
                    bars.append(bar)
                max_len = max(spec.long_window for spec in self._strategies) + 10
                if len(bars) > max_len:
                    self._bars_cache[key] = bars[-max_len:]

            self._emit_signals(symbol, interval, bar["ts"], bar["close"])

    def _emit_signals(self, symbol: str, interval: str, candle_ts: int, price: float) -> None:
        key = (symbol, interval)
        with self._lock:
            bars = list(self._bars_cache.get(key, []))
        if not bars:
            return

        for spec in self._strategies:
            signal = generate_signal(bars, spec.short_window, spec.long_window)
            if signal == "HOLD":
                continue
            payload = {
                "type": "signal",
                "strategy_id": spec.strategy_id,
                "symbol": symbol,
                "interval": interval,
                "signal": signal,
                "price": price,
                "ts": candle_ts,
                "signal_id": f"{spec.strategy_id}|{symbol}|{interval}|{candle_ts}",
            }
            event_bus.publish(payload, key=f"{symbol}:{interval}")

    def _process_symbol_interval(self, bybit: BybitService, symbol: str, interval: str) -> None:
        max_window = max(spec.long_window for spec in self._strategies)
        bars = bybit.get_klines(symbol=symbol, interval=interval, limit=max(max_window + 5, 50))
        if not bars:
            return

        if len(bars) < 2:
            return
        latest_candle_ts = bars[-2]["ts"]
        key = (symbol, interval)
        if self._last_candle_ts.get(key) == latest_candle_ts:
            return
        self._last_candle_ts[key] = latest_candle_ts

        closed_bars = bars[:-1]
        last_price = closed_bars[-1]["close"]
        self._emit_signals(symbol, interval, latest_candle_ts, last_price)


signal_worker = SignalWorker()
