from dataclasses import dataclass
from math import pi, sin

from app.strategy.basic_startegy.fibonacci.common import FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciSpiralPoint:
    x_index: int
    y_price: float


def fibonacci_spiral_point(
    center: FibAnchor | dict,
    start: FibAnchor | dict,
    x_index: int,
    theta_step: float = pi / 8.0,
) -> FibonacciSpiralPoint:
    c = normalize_anchor(center)
    s = normalize_anchor(start)
    phi = 1.61803398875
    base_radius = abs(s.price - c.price) + 1e-9
    theta = max(0.0, (x_index - c.index) * theta_step)
    growth = phi ** (theta / (pi / 2.0))
    radius = base_radius * growth
    y_price = c.price + (radius * sin(theta))
    return FibonacciSpiralPoint(x_index=x_index, y_price=y_price)


def fibonacci_spiral_signal(
    bars: list[dict],
    center: FibAnchor | dict,
    start: FibAnchor | dict,
    theta_step: float = pi / 8.0,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    prev_point = fibonacci_spiral_point(center=center, start=start, x_index=prev_x, theta_step=theta_step)
    curr_point = fibonacci_spiral_point(center=center, start=start, x_index=curr_x, theta_step=theta_step)
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_upper = prev_point.y_price * (1.0 + breakout_buffer)
    curr_upper = curr_point.y_price * (1.0 + breakout_buffer)
    prev_lower = prev_point.y_price * (1.0 - breakout_buffer)
    curr_lower = curr_point.y_price * (1.0 - breakout_buffer)
    if prev_close <= prev_upper and curr_close > curr_upper:
        return "BUY"
    if prev_close >= prev_lower and curr_close < curr_lower:
        return "SELL"
    return "HOLD"

