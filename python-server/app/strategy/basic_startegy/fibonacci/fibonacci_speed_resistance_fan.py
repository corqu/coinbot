from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import (
    DEFAULT_SPEED_RESISTANCE_FAN_RATIOS,
    FibAnchor,
    normalize_anchor,
)


@dataclass(frozen=True)
class FibonacciFanRay:
    ratio: float
    price: float


def fibonacci_speed_resistance_fan_rays_at(
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    x_index: int,
    ratios: list[float] | None = None,
) -> list[FibonacciFanRay]:
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    fib = ratios or DEFAULT_SPEED_RESISTANCE_FAN_RATIOS
    dx = b.index - a.index
    if dx == 0:
        return []
    base_slope = (b.price - a.price) / dx
    delta_x = x_index - a.index
    return [
        FibonacciFanRay(ratio=ratio, price=a.price + (base_slope * ratio * delta_x))
        for ratio in fib
        if ratio > 0
    ]


def fibonacci_speed_resistance_fan_signal(
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

    prev_rays = fibonacci_speed_resistance_fan_rays_at(start=start, end=end, x_index=len(bars) - 2, ratios=ratios)
    curr_rays = fibonacci_speed_resistance_fan_rays_at(start=start, end=end, x_index=len(bars) - 1, ratios=ratios)
    if not prev_rays or not curr_rays:
        return "HOLD"

    prev_upper = max(ray.price for ray in prev_rays) * (1.0 + breakout_buffer)
    prev_lower = min(ray.price for ray in prev_rays) * (1.0 - breakout_buffer)
    curr_upper = max(ray.price for ray in curr_rays) * (1.0 + breakout_buffer)
    curr_lower = min(ray.price for ray in curr_rays) * (1.0 - breakout_buffer)
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    if prev_close <= prev_upper and curr_close > curr_upper:
        return "BUY"
    if prev_close >= prev_lower and curr_close < curr_lower:
        return "SELL"
    return "HOLD"

