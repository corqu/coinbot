from dataclasses import dataclass

from app.strategy.basic_startegy.pitchfork.pitchfork import PivotPoint


@dataclass(frozen=True)
class ModifiedSchiffPitchforkLines:
    median: float
    upper: float
    lower: float


def modified_schiff_pitchfork_lines_at(
    points: tuple[PivotPoint, PivotPoint, PivotPoint], x_index: int
) -> ModifiedSchiffPitchforkLines | None:
    a, b, c = points

    # Modified Schiff: shift anchor half in time toward B, keep A price.
    anchor_x = (a.index + b.index) / 2.0
    anchor_y = a.price

    midpoint_bc_x = (b.index + c.index) / 2.0
    midpoint_bc_y = (b.price + c.price) / 2.0

    dx = midpoint_bc_x - anchor_x
    if dx == 0:
        return None

    slope = (midpoint_bc_y - anchor_y) / dx
    median = anchor_y + slope * (x_index - anchor_x)
    upper = b.price + slope * (x_index - b.index)
    lower = c.price + slope * (x_index - c.index)
    return ModifiedSchiffPitchforkLines(median=median, upper=upper, lower=lower)


def modified_schiff_pitchfork_signal(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    breakout_buffer: float = 0.001,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < 2:
        return "HOLD"

    a = pivot_a if isinstance(pivot_a, PivotPoint) else PivotPoint(**pivot_a)
    b = pivot_b if isinstance(pivot_b, PivotPoint) else PivotPoint(**pivot_b)
    c = pivot_c if isinstance(pivot_c, PivotPoint) else PivotPoint(**pivot_c)

    prev_x = len(bars) - 2
    curr_x = len(bars) - 1
    prev_lines = modified_schiff_pitchfork_lines_at((a, b, c), prev_x)
    curr_lines = modified_schiff_pitchfork_lines_at((a, b, c), curr_x)
    if prev_lines is None or curr_lines is None:
        return "HOLD"

    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    prev_upper_trigger = prev_lines.upper * (1.0 + breakout_buffer)
    curr_upper_trigger = curr_lines.upper * (1.0 + breakout_buffer)
    prev_lower_trigger = prev_lines.lower * (1.0 - breakout_buffer)
    curr_lower_trigger = curr_lines.lower * (1.0 - breakout_buffer)

    if prev_close <= prev_upper_trigger and curr_close > curr_upper_trigger:
        return "BUY"
    if prev_close >= prev_lower_trigger and curr_close < curr_lower_trigger:
        return "SELL"
    return "HOLD"
