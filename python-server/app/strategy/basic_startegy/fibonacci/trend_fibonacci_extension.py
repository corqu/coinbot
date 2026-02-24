from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import DEFAULT_EXT_RATIOS, FibAnchor, normalize_anchor


@dataclass(frozen=True)
class TrendFibonacciExtensionLevels:
    ratios: list[float]
    prices: list[float]


def trend_fibonacci_extension_levels(
    a: FibAnchor | dict,
    b: FibAnchor | dict,
    c: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> TrendFibonacciExtensionLevels:
    p1 = normalize_anchor(a)
    p2 = normalize_anchor(b)
    p3 = normalize_anchor(c)
    fib = ratios or DEFAULT_EXT_RATIOS
    move = p2.price - p1.price
    prices = [p3.price + (move * ratio) for ratio in fib]
    return TrendFibonacciExtensionLevels(ratios=fib, prices=prices)


def trend_fibonacci_extension_signal(
    bars: list[dict],
    a: FibAnchor | dict,
    b: FibAnchor | dict,
    c: FibAnchor | dict,
    trigger_ratio: float = 1.0,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    trigger = trend_fibonacci_extension_levels(a=a, b=b, c=c, ratios=[trigger_ratio]).prices[0]
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    upper = trigger * (1.0 + breakout_buffer)
    lower = trigger * (1.0 - breakout_buffer)
    if prev_close <= upper and curr_close > upper:
        return "BUY"
    if prev_close >= lower and curr_close < lower:
        return "SELL"
    return "HOLD"

