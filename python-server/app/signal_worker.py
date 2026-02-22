import asyncio
import importlib
import inspect
import logging
import threading
from typing import Callable, Any

from app.bybit_client import BybitService
from app.config import settings
from app.event_bus import event_bus
from app.strategy_group_store import strategy_group_store, StrategyGroupConfig, StrategyGroupItemConfig


logger = logging.getLogger(__name__)

class SignalWorker:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._ws = None
        self._lock = threading.Lock()
        self._last_candle_ts: dict[tuple[str, str], int] = {}
        self._bars_cache: dict[tuple[str, str], list[dict]] = {}
        self._signal_function_cache: dict[str, Callable[..., str] | None] = {}

    def start(self) -> None:
        if self._task and not self._task.done():
            return
        strategy_group_store.refresh_now()
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
        strategy_group_store.refresh_if_needed()
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
        strategy_group_store.refresh_if_needed()
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
                bars = bybit.get_klines(symbol=symbol, interval=interval, limit=max(settings.signal_bars_limit, 50))
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
                if len(bars) > settings.signal_bars_limit + 10:
                    self._bars_cache[key] = bars[-(settings.signal_bars_limit + 10):]

            self._emit_signals(symbol, interval, bar["ts"], bar["close"])

    def _emit_signals(self, symbol: str, interval: str, candle_ts: int, price: float) -> None:
        key = (symbol, interval)
        with self._lock:
            bars = list(self._bars_cache.get(key, []))
        if not bars:
            return

        for group in strategy_group_store.groups().values():
            signal = self._evaluate_group_signal(group, bars, symbol, interval)
            if signal not in {"BUY", "SELL"}:
                continue
            payload = {
                "type": "signal",
                "group_id": group.group_id,
                "user_id": group.user_id,
                "symbol": symbol,
                "interval": interval,
                "signal": signal,
                "price": price,
                "ts": candle_ts,
                "signal_id": f"group:{group.group_id}|{symbol}|{interval}|{candle_ts}",
            }
            event_bus.publish(payload, key=f"group:{group.group_id}:{symbol}:{interval}")

    def _process_symbol_interval(self, bybit: BybitService, symbol: str, interval: str) -> None:
        bars = bybit.get_klines(symbol=symbol, interval=interval, limit=max(settings.signal_bars_limit, 50))
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

    def _evaluate_group_signal(
            self,
            group: StrategyGroupConfig,
            bars: list[dict],
            symbol: str,
            interval: str,
    ) -> str:
        all_signals: list[str] = []

        for item in group.items:
            if not self._matches_market(item.params, symbol, interval):
                return "HOLD"

            signal = self._evaluate_item_signal(item, bars)
            if signal not in {"BUY", "SELL"}:
                return "HOLD"
            all_signals.append(signal)

        if not all_signals:
            return "HOLD"
        first = all_signals[0]
        if any(s != first for s in all_signals):
            return "HOLD"
        return first

    def _evaluate_item_signal(self, item: StrategyGroupItemConfig, bars: list[dict]) -> str:
        signal_func = self._load_signal_function(item.strategy_source)
        if signal_func is None:
            return "HOLD"

        try:
            signature = inspect.signature(signal_func)
            kwargs: dict[str, Any] = {}
            for name, param in signature.parameters.items():
                if name == "bars":
                    continue
                if name in item.params:
                    kwargs[name] = item.params[name]
                    continue
                if param.default is inspect._empty:
                    return "HOLD"
            result = signal_func(bars=bars, **kwargs)
        except Exception:
            logger.exception("Signal evaluation failed. strategySource=%s itemId=%s", item.strategy_source, item.item_id)
            return "HOLD"

        if isinstance(result, str):
            upper = result.upper()
            if upper in {"BUY", "SELL", "HOLD"}:
                return upper
        return "HOLD"

    def _load_signal_function(self, strategy_source: str) -> Callable[..., str] | None:
        if strategy_source in self._signal_function_cache:
            return self._signal_function_cache[strategy_source]

        try:
            strategy_module = importlib.import_module(strategy_source)
            signal_func = getattr(strategy_module, "generate_signal", None)
            if not callable(signal_func):
                logger.warning("generate_signal not found. strategySource=%s", strategy_source)
                self._signal_function_cache[strategy_source] = None
                return None
            self._signal_function_cache[strategy_source] = signal_func
            return signal_func
        except Exception:
            logger.exception("Failed to import strategy module. strategySource=%s", strategy_source)
            self._signal_function_cache[strategy_source] = None
            return None

    def _matches_market(self, params: dict[str, Any], symbol: str, interval: str) -> bool:
        param_symbol = params.get("symbol")
        if isinstance(param_symbol, str) and param_symbol.strip() and param_symbol.upper() != symbol.upper():
            return False
        param_interval = params.get("interval")
        if isinstance(param_interval, str) and param_interval.strip() and param_interval != interval:
            return False
        return True


signal_worker = SignalWorker()
