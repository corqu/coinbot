from dataclasses import dataclass

from app.strategy.basic_startegy.fibonacci.common import FibAnchor, normalize_anchor


@dataclass(frozen=True)
class FibonacciWedgeBand:
    upper: float
    lower: float
    center: float


def fibonacci_wedge_band_at(
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    x_index: int,
    narrow_ratio: float = 0.382,
) -> FibonacciWedgeBand | None:
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    dx = b.index - a.index
    if dx == 0:
        return None
    base_slope = (b.price - a.price) / dx
    center = a.price + (base_slope * (x_index - a.index))
    base_spread = abs(b.price - a.price)
    wedge_end = b.index + abs(dx)
    if wedge_end == a.index:
        return None
    progress = max(0.0, min(1.0, (x_index - a.index) / (wedge_end - a.index)))
    spread = base_spread * (1.0 - ((1.0 - narrow_ratio) * progress))
    half = spread / 2.0
    return FibonacciWedgeBand(upper=center + half, lower=center - half, center=center)


def fibonacci_wedge_signal(
    bars: list[dict],
    start: FibAnchor | dict,
    end: FibAnchor | dict,
    narrow_ratio: float = 0.382,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"
    prev_band = fibonacci_wedge_band_at(start=start, end=end, x_index=len(bars) - 2, narrow_ratio=narrow_ratio)
    curr_band = fibonacci_wedge_band_at(start=start, end=end, x_index=len(bars) - 1, narrow_ratio=narrow_ratio)
    if prev_band is None or curr_band is None:
        return "HOLD"
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_upper = prev_band.upper * (1.0 + breakout_buffer)
    curr_upper = curr_band.upper * (1.0 + breakout_buffer)
    prev_lower = prev_band.lower * (1.0 - breakout_buffer)
    curr_lower = curr_band.lower * (1.0 - breakout_buffer)
    if prev_close <= prev_upper and curr_close > curr_upper:
        return "BUY"
    if prev_close >= prev_lower and curr_close < curr_lower:
        return "SELL"
    return "HOLD"

