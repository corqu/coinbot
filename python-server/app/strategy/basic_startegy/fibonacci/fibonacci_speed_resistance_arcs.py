from dataclasses import dataclass
from math import sqrt

from app.strategy.basic_startegy.fibonacci.common import (
    DEFAULT_SPEED_RESISTANCE_ARCS_RATIOS,
    FibAnchor,
    normalize_anchor,
)


@dataclass(frozen=True)
class FibonacciArcBand:
    ratio: float
    upper: float
    lower: float


def fibonacci_speed_resistance_arc_bands_at(
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    x_index: int,
    ratios: list[float] | None = None,
) -> list[FibonacciArcBand]:
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    fib = ratios or DEFAULT_SPEED_RESISTANCE_ARCS_RATIOS
    # Treat start as the circle center and end as a point on the base radius.
    base_dx = float(b.index - a.index)
    base_dy = float(b.price - a.price)
    base_radius = sqrt((base_dx**2) + (base_dy**2))
    dx = abs(float(x_index - a.index))
    bands: list[FibonacciArcBand] = []
    for ratio in fib:
        if ratio <= 0:
            continue
        radius = base_radius * ratio
        if dx > radius:
            continue
        y_delta = sqrt(max((radius**2) - (dx**2), 0.0))
        bands.append(FibonacciArcBand(ratio=ratio, upper=a.price + y_delta, lower=a.price - y_delta))
    return bands


def fibonacci_speed_resistance_arcs_signal(
    bars: list[dict],
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    ratios: list[float] | None = None,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"
    prev_bands = fibonacci_speed_resistance_arc_bands_at(
        start=start, end=end, x_index=len(bars) - 2, ratios=ratios
    )
    curr_bands = fibonacci_speed_resistance_arc_bands_at(
        start=start, end=end, x_index=len(bars) - 1, ratios=ratios
    )
    if not prev_bands or not curr_bands:
        return "HOLD"
    prev_outer = max(prev_bands, key=lambda item: item.ratio)
    curr_outer = max(curr_bands, key=lambda item: item.ratio)
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_upper = prev_outer.upper * (1.0 + breakout_buffer)
    curr_upper = curr_outer.upper * (1.0 + breakout_buffer)
    prev_lower = prev_outer.lower * (1.0 - breakout_buffer)
    curr_lower = curr_outer.lower * (1.0 - breakout_buffer)
    if prev_close <= prev_upper and curr_close > curr_upper:
        return "BUY"
    if prev_close >= prev_lower and curr_close < curr_lower:
        return "SELL"
    return "HOLD"

