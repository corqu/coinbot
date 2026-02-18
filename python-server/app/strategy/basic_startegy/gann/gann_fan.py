from dataclasses import dataclass

from app.strategy.basic_startegy.gann.gann_box import GannAnchor, _normalize_anchor


@dataclass(frozen=True)
class GannFanRay:
    ratio: float
    price: float


def gann_fan_rays_at(
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    x_index: int,
    ratios: list[float] | None = None,
) -> list[GannFanRay]:
    a = _normalize_anchor(start)
    b = _normalize_anchor(end)
    ray_ratios = ratios or [0.25, 0.5, 1.0, 2.0, 4.0]

    dx = b.index - a.index
    if dx == 0:
        return []
    base_slope = (b.price - a.price) / dx
    delta_x = x_index - a.index

    rays: list[GannFanRay] = []
    for ratio in ray_ratios:
        if ratio <= 0:
            continue
        rays.append(GannFanRay(ratio=ratio, price=a.price + (base_slope * ratio * delta_x)))
    return rays


def gann_fan_breakout_signal(
    bars: list[dict],
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    prev_rays = gann_fan_rays_at(start=start, end=end, x_index=len(bars) - 2, ratios=ratios)
    curr_rays = gann_fan_rays_at(start=start, end=end, x_index=len(bars) - 1, ratios=ratios)
    if not prev_rays or not curr_rays:
        return "HOLD"

    prev_prices = [ray.price for ray in prev_rays]
    curr_prices = [ray.price for ray in curr_rays]
    prev_upper = max(prev_prices) * (1.0 + breakout_buffer)
    prev_lower = min(prev_prices) * (1.0 - breakout_buffer)
    curr_upper = max(curr_prices) * (1.0 + breakout_buffer)
    curr_lower = min(curr_prices) * (1.0 - breakout_buffer)

    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    if prev_close <= prev_upper and curr_close > curr_upper:
        return "BUY"
    if prev_close >= prev_lower and curr_close < curr_lower:
        return "SELL"
    return "HOLD"
