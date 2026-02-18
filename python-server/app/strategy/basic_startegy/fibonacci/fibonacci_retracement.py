from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import DEFAULT_PRICE_RATIOS, FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciRetracementLevels:
    ratios: list[float]
    prices: list[float]


def fibonacci_retracement_levels(
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> FibonacciRetracementLevels:
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    fib = ratios or DEFAULT_PRICE_RATIOS
    delta = b.price - a.price
    prices = [b.price - (delta * ratio) for ratio in fib]
    return FibonacciRetracementLevels(ratios=fib, prices=prices)


def fibonacci_retracement_signal(
    bars: list[dict],
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    target_ratio: float = 0.5,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    level = fibonacci_retracement_levels(start=start, end=end, ratios=[target_ratio]).prices[0]
    upper = level * (1.0 + breakout_buffer)
    lower = level * (1.0 - breakout_buffer)
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    if prev_close <= upper and curr_close > upper:
        return "BUY"
    if prev_close >= lower and curr_close < lower:
        return "SELL"
    return "HOLD"

