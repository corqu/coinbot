from dataclasses import dataclass

from app.strategy.basic_startegy.pitchfork.pitchfork import PivotPoint


@dataclass(frozen=True)
class FanBand:
    level: float
    upper: float
    lower: float


def _normalize_pivot(pivot: PivotPoint | dict) -> PivotPoint:
    if isinstance(pivot, PivotPoint):
        return pivot
    kind = str(pivot["kind"]).lower()
    if kind not in ("high", "low"):
        raise ValueError("pivot kind must be 'high' or 'low'")
    return PivotPoint(
        index=int(pivot["index"]),
        kind=kind,
        price=float(pivot["price"]),
    )


def pitchfork_fan_bands_at(
    points: tuple[PivotPoint, PivotPoint, PivotPoint], x_index: int, levels: list[float] | None = None
) -> list[FanBand]:
    a, b, c = points
    fan_levels = levels or [0.5, 1.0, 1.5]
    if not fan_levels:
        return []

    upper_base_dx = b.index - a.index
    lower_base_dx = c.index - a.index
    if upper_base_dx == 0 or lower_base_dx == 0:
        return []

    upper_base_slope = (b.price - a.price) / upper_base_dx
    lower_base_slope = (c.price - a.price) / lower_base_dx
    dx = x_index - a.index

    bands: list[FanBand] = []
    for level in fan_levels:
        if level <= 0:
            continue
        upper = a.price + (upper_base_slope * level * dx)
        lower = a.price + (lower_base_slope * level * dx)
        if upper < lower:
            upper, lower = lower, upper
        bands.append(FanBand(level=level, upper=upper, lower=lower))
    return bands


def pitchfork_fan_breakout_signal(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    levels: list[float] | None = None,
    breakout_buffer: float = 0.001,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    a = _normalize_pivot(pivot_a)
    b = _normalize_pivot(pivot_b)
    c = _normalize_pivot(pivot_c)

    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    prev_bands = pitchfork_fan_bands_at((a, b, c), prev_x, levels=levels)
    curr_bands = pitchfork_fan_bands_at((a, b, c), curr_x, levels=levels)
    if not prev_bands or not curr_bands:
        return "HOLD"

    prev_outer = max(prev_bands, key=lambda item: item.level)
    curr_outer = max(curr_bands, key=lambda item: item.level)

    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_upper_trigger = prev_outer.upper * (1.0 + breakout_buffer)
    curr_upper_trigger = curr_outer.upper * (1.0 + breakout_buffer)
    prev_lower_trigger = prev_outer.lower * (1.0 - breakout_buffer)
    curr_lower_trigger = curr_outer.lower * (1.0 - breakout_buffer)

    if prev_close <= prev_upper_trigger and curr_close > curr_upper_trigger:
        return "BUY"
    if prev_close >= prev_lower_trigger and curr_close < curr_lower_trigger:
        return "SELL"
    return "HOLD"
