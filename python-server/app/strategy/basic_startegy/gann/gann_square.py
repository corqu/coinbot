from dataclasses import dataclass

from app.strategy.basic_startegy.gann.gann_box import GannAnchor, _normalize_anchor, gann_box_levels


@dataclass(frozen=True)
class GannSquareLevels:
    quarter_ratio: float
    quarter_x: float
    quarter_y: float
    x_levels: list[float]
    y_levels: list[float]


def gann_square_levels(
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
    quarter_ratio: float = 0.25,
) -> GannSquareLevels:
    if not 0.0 <= quarter_ratio <= 1.0:
        raise ValueError("quarter_ratio must be between 0 and 1")

    levels = gann_box_levels(start=start, end=end, ratios=ratios)
    a = _normalize_anchor(start)
    b = _normalize_anchor(end)
    dx = b.index - a.index
    dy = b.price - a.price
    quarter_x = a.index + (dx * quarter_ratio)
    quarter_y = a.price + (dy * quarter_ratio)
    return GannSquareLevels(
        quarter_ratio=quarter_ratio,
        quarter_x=quarter_x,
        quarter_y=quarter_y,
        x_levels=levels.x_levels,
        y_levels=levels.y_levels,
    )


def gann_square_quarter_signal(
    bars: list[dict],
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
    quarter_ratio: float = 0.25,
    enforce_quarter_window: bool = True,
    breakout_buffer: float = 0.0,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    levels = gann_square_levels(start=start, end=end, ratios=ratios, quarter_ratio=quarter_ratio)
    curr_x = len(bars) - 1
    if enforce_quarter_window and curr_x > levels.quarter_x:
        return "HOLD"

    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    trigger = levels.quarter_y
    upper = trigger * (1.0 + breakout_buffer)
    lower = trigger * (1.0 - breakout_buffer)

    if prev_close <= upper and curr_close > upper:
        return "BUY"
    if prev_close >= lower and curr_close < lower:
        return "SELL"
    return "HOLD"
