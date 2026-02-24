from dataclasses import dataclass
from math import sqrt

from app.strategy.basic_startegy.fibonacci.common import FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciCircle:
    ratio: float
    radius: float


def fibonacci_circles(
    center: FibAnchor | dict,
    edge: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> list[FibonacciCircle]:
    c = normalize_anchor(center)
    e = normalize_anchor(edge)
    fib = ratios or [0.382, 0.5, 0.618, 1.0, 1.618]
    base_radius = sqrt(((e.index - c.index) ** 2) + ((e.price - c.price) ** 2))
    return [FibonacciCircle(ratio=ratio, radius=base_radius * ratio) for ratio in fib if ratio > 0]


def fibonacci_circles_signal(
    bars: list[dict],
    center: FibAnchor | dict,
    edge: FibAnchor | dict,
    ratios: list[float] | None = None,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"
    c = normalize_anchor(center)
    circles = fibonacci_circles(center=center, edge=edge, ratios=ratios)
    if not circles:
        return "HOLD"
    outer = max(circle.radius for circle in circles)

    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_dist = sqrt(((prev_x - c.index) ** 2) + ((prev_close - c.price) ** 2))
    curr_dist = sqrt(((curr_x - c.index) ** 2) + ((curr_close - c.price) ** 2))
    upper = outer * (1.0 + breakout_buffer)
    lower = outer * (1.0 - breakout_buffer)
    if prev_dist <= upper and curr_dist > upper:
        return "BUY"
    if prev_dist >= lower and curr_dist < lower:
        return "SELL"
    return "HOLD"

