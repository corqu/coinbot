import asyncio
import logging
import threading
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.bybit_client import BybitService
from app.config import settings


logger = logging.getLogger(__name__)


def _normalize_interval(interval: str) -> str:
    allowed = {"1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"}
    if interval in allowed:
        return interval
    return "15"


class MarketStreamService:
    def __init__(self) -> None:
        self._clients: dict[tuple[str, str], set[WebSocket]] = defaultdict(set)
        self._cache: dict[tuple[str, str], list[dict[str, Any]]] = {}
        self._lock = threading.Lock()
        self._ws = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._started = False

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        if self._started:
            return
        self._started = True
        self._loop = loop

        symbols = [s.strip().upper() for s in settings.symbols.split(",") if s.strip()]
        intervals = [_normalize_interval(s.strip()) for s in settings.intervals.split(",") if s.strip()]
        if not symbols:
            symbols = ["BTCUSDT"]
        if not intervals:
            intervals = ["15"]

        bybit = BybitService(
            api_key=settings.bybit_api_key or None,
            api_secret=settings.bybit_api_secret or None,
            testnet=settings.bybit_testnet,
        )

        for symbol in symbols:
            for interval in intervals:
                try:
                    bars = bybit.get_klines(symbol=symbol, interval=interval, limit=200)
                    with self._lock:
                        self._cache[(symbol, interval)] = bars
                except Exception:
                    logger.exception("Failed to preload kline cache. symbol=%s interval=%s", symbol, interval)

        try:
            from pybit.unified_trading import WebSocket
        except Exception:
            logger.exception("Failed to import Bybit WebSocket client for market stream.")
            return

        self._ws = WebSocket(testnet=settings.bybit_testnet, channel_type="linear")
        for symbol in symbols:
            for interval in intervals:
                self._ws.kline_stream(
                    interval=interval,
                    symbol=symbol,
                    callback=lambda msg, s=symbol, i=interval: self._on_kline(msg, s, i),
                )

    async def stop(self) -> None:
        if self._ws:
            try:
                self._ws.exit()
            except Exception:
                logger.exception("Failed to close market stream websocket.")
            self._ws = None

        self._started = False
        self._clients.clear()

    async def register(self, websocket: WebSocket, symbol: str, interval: str, limit: int = 200) -> None:
        key = (symbol.upper(), _normalize_interval(interval))
        with self._lock:
            self._clients[key].add(websocket)
            candles = list(self._cache.get(key, []))

        if not candles:
            bybit = BybitService(
                api_key=settings.bybit_api_key or None,
                api_secret=settings.bybit_api_secret or None,
                testnet=settings.bybit_testnet,
            )
            try:
                candles = bybit.get_klines(symbol=key[0], interval=key[1], limit=max(50, min(limit, 500)))
                with self._lock:
                    self._cache[key] = candles
            except Exception:
                logger.exception("Failed to load initial kline snapshot. symbol=%s interval=%s", key[0], key[1])
                candles = []

        await websocket.send_json(
            {
                "type": "snapshot",
                "symbol": key[0],
                "interval": key[1],
                "candles": candles[-limit:],
            }
        )

    def unregister(self, websocket: WebSocket, symbol: str, interval: str) -> None:
        key = (symbol.upper(), _normalize_interval(interval))
        with self._lock:
            clients = self._clients.get(key)
            if not clients:
                return
            clients.discard(websocket)
            if not clients:
                self._clients.pop(key, None)

    def _on_kline(self, message: dict[str, Any], symbol: str, interval: str) -> None:
        data = message.get("data")
        if not data:
            return

        candle_list = data if isinstance(data, list) else [data]
        key = (symbol.upper(), _normalize_interval(interval))
        outbound: list[dict[str, Any]] = []

        with self._lock:
            bars = self._cache.setdefault(key, [])
            for candle in candle_list:
                ts = int(candle.get("start", 0))
                if not ts:
                    continue
                bar = {
                    "ts": ts,
                    "open": float(candle.get("open", 0)),
                    "high": float(candle.get("high", 0)),
                    "low": float(candle.get("low", 0)),
                    "close": float(candle.get("close", 0)),
                    "volume": float(candle.get("volume", 0)),
                    "confirm": bool(candle.get("confirm", False)),
                }
                if bars and bars[-1]["ts"] == bar["ts"]:
                    bars[-1] = bar
                else:
                    bars.append(bar)
                if len(bars) > 600:
                    self._cache[key] = bars[-600:]
                    bars = self._cache[key]
                outbound.append(bar)

            clients = list(self._clients.get(key, set()))

        if not outbound or not clients:
            return

        if self._loop is None:
            return
        self._loop.call_soon_threadsafe(
            lambda: asyncio.create_task(self._broadcast_kline(key[0], key[1], clients, outbound))
        )

    async def _broadcast_kline(
        self, symbol: str, interval: str, clients: list[WebSocket], bars: list[dict[str, Any]]
    ) -> None:
        disconnected: list[WebSocket] = []
        for websocket in clients:
            try:
                await websocket.send_json(
                    {
                        "type": "kline",
                        "symbol": symbol,
                        "interval": interval,
                        "bars": bars,
                    }
                )
            except Exception:
                disconnected.append(websocket)

        if disconnected:
            with self._lock:
                key = (symbol, interval)
                for websocket in disconnected:
                    self._clients.get(key, set()).discard(websocket)


market_stream_service = MarketStreamService()

