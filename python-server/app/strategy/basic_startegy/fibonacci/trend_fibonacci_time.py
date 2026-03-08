from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import DEFAULT_TREND_FIBONACCI_TIME_RATIOS, FibAnchor, normalize_anchor


@dataclass(frozen=True)
class TrendFibonacciTimeLevels:
    ratios: list[float]
    time_indexes: list[float]


def trend_fibonacci_time_levels(
    a: FibAnchor | dict,
    b: FibAnchor | dict,
    c: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> TrendFibonacciTimeLevels:
    p1 = normalize_anchor(a)
    p2 = normalize_anchor(b)
    p3 = normalize_anchor(c)
    fib = ratios or DEFAULT_TREND_FIBONACCI_TIME_RATIOS
    base = abs(p2.index - p1.index)
    if base == 0:
        base = 1
    indexes = [p3.index + (base * ratio) for ratio in fib]
    return TrendFibonacciTimeLevels(ratios=fib, time_indexes=indexes)


def trend_fibonacci_time_signal(
    bars: list[dict],
    a: FibAnchor | dict,
    b: FibAnchor | dict,
    c: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> str:
    if len(bars) < 2:
        return "HOLD"
    levels = trend_fibonacci_time_levels(a=a, b=b, c=c, ratios=ratios).time_indexes
    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    crossed = any(prev_x < level <= curr_x for level in levels)
    if not crossed:
        return "HOLD"
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    return "BUY" if curr_close >= prev_close else "SELL"

