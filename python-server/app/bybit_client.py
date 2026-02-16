from typing import Any

from pybit.unified_trading import HTTP


class BybitService:
    def __init__(self, api_key: str | None, api_secret: str | None, testnet: bool):
        kwargs: dict[str, Any] = {"testnet": testnet}
        if api_key and api_secret:
            kwargs["api_key"] = api_key
            kwargs["api_secret"] = api_secret
        self.client = HTTP(**kwargs)

    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> list[dict[str, Any]]:
        resp = self.client.get_kline(category="linear", symbol=symbol, interval=interval, limit=limit)
        data = resp.get("result", {}).get("list", [])
        # Bybit는 최신순 반환이므로 시간 오름차순으로 정렬
        data = sorted(data, key=lambda x: int(x[0]))
        return [
            {
                "ts": int(item[0]),
                "open": float(item[1]),
                "high": float(item[2]),
                "low": float(item[3]),
                "close": float(item[4]),
                "volume": float(item[5]),
            }
            for item in data
        ]

    def get_latest_price(self, symbol: str) -> float:
        resp = self.client.get_tickers(category="linear", symbol=symbol)
        data = resp.get("result", {}).get("list", [])
        if not data:
            raise ValueError(f"Ticker not found for symbol={symbol}")
        return float(data[0]["lastPrice"])

    def set_leverage(self, symbol: str, leverage: int) -> None:
        self.client.set_leverage(
            category="linear",
            symbol=symbol,
            buyLeverage=str(leverage),
            sellLeverage=str(leverage),
        )

    def place_market_order(self, symbol: str, side: str, qty: float) -> dict[str, Any]:
        return self.client.place_order(
            category="linear",
            symbol=symbol,
            side=side,
            orderType="Market",
            qty=str(qty),
            timeInForce="IOC",
        )
