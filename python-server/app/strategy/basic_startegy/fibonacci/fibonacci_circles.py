from dataclasses import dataclass
from math import sqrt

from app.strategy.basic_startegy.fibonacci.common import FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciCircle:
    ratio: float
    radius: float


def _base_axis_scale(center: FibAnchor, edge: FibAnchor) -> tuple[float, float] | None:
    base_dx = abs(float(edge.index - center.index))
    base_dy = abs(float(edge.price - center.price))
    if base_dx <= 0.0 or base_dy <= 0.0:
        return None
    return base_dx, base_dy


def _normalized_distance(center: FibAnchor, x_index: int, price: float, base_dx: float, base_dy: float) -> float:
    nx = (float(x_index) - float(center.index)) / base_dx
    ny = (float(price) - float(center.price)) / base_dy
    return sqrt((nx * nx) + (ny * ny))


def fibonacci_circles(
    center: FibAnchor | dict,
    edge: FibAnchor | dict,
    ratios: list[float] | None = None,
) -> list[FibonacciCircle]:
    c = normalize_anchor(center)
    e = normalize_anchor(edge)
    fib = ratios or [0.382, 0.5, 0.618, 1.0, 1.618]
    base_scale = _base_axis_scale(c, e)
    if base_scale is None:
        return []
    # In normalized distance space, the edge point is always distance 1 from center.
    base_radius = 1.0
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
    e = normalize_anchor(edge)
    base_scale = _base_axis_scale(c, e)
    if base_scale is None:
        return "HOLD"
    base_dx, base_dy = base_scale
    circles = fibonacci_circles(center=center, edge=edge, ratios=ratios)
    if not circles:
        return "HOLD"
    outer = max(circle.radius for circle in circles)

    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_dist = _normalized_distance(c, prev_x, prev_close, base_dx, base_dy)
    curr_dist = _normalized_distance(c, curr_x, curr_close, base_dx, base_dy)
    upper = outer * (1.0 + breakout_buffer)
    lower = outer * (1.0 - breakout_buffer)
    if prev_dist <= upper and curr_dist > upper:
        return "BUY"
    if prev_dist >= lower and curr_dist < lower:
        return "SELL"
    return "HOLD"

