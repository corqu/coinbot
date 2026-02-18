from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import DEFAULT_TIME_STEPS, FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciTimeZones:
    steps: list[int]
    zone_indexes: list[int]


def fibonacci_time_zones(
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    steps: list[int] | None = None,
) -> FibonacciTimeZones:
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    fib_steps = steps or DEFAULT_TIME_STEPS
    base = abs(b.index - a.index)
    if base == 0:
        base = 1
    zones = [a.index + (base * step) for step in fib_steps]
    return FibonacciTimeZones(steps=fib_steps, zone_indexes=zones)


def fibonacci_time_zones_signal(
    bars: list[dict],
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    steps: list[int] | None = None,
) -> str:
    if len(bars) < 2:
        return "HOLD"
    zones = fibonacci_time_zones(start=start, end=end, steps=steps).zone_indexes
    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    crossed = any(prev_x < zone <= curr_x for zone in zones)
    if not crossed:
        return "HOLD"
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    return "BUY" if curr_close >= prev_close else "SELL"

