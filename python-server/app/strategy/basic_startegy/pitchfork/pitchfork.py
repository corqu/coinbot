from dataclasses import dataclass


@dataclass(frozen=True)
class PivotPoint:
    index: int
    kind: str  # "high" | "low"
    price: float


@dataclass(frozen=True)
class PitchforkLines:
    median: float
    upper: float
    lower: float


def find_pivots(bars: list[dict], window: int = 3) -> list[PivotPoint]:
    if window < 2:
        raise ValueError("window must be >= 2")
    if len(bars) < (window * 2) + 1:
        return []

    highs = [float(item["high"]) for item in bars]
    lows = [float(item["low"]) for item in bars]
    pivots: list[PivotPoint] = []

    for idx in range(window, len(bars) - window):
        left_h = highs[idx - window : idx]
        right_h = highs[idx + 1 : idx + 1 + window]
        left_l = lows[idx - window : idx]
        right_l = lows[idx + 1 : idx + 1 + window]

        is_high = highs[idx] > max(left_h) and highs[idx] >= max(right_h)
        is_low = lows[idx] < min(left_l) and lows[idx] <= min(right_l)

        if is_high:
            pivots.append(PivotPoint(index=idx, kind="high", price=highs[idx]))
        elif is_low:
            pivots.append(PivotPoint(index=idx, kind="low", price=lows[idx]))

    return pivots


def latest_pitchfork_points(
    bars: list[dict], pivot_window: int = 3, lookback: int = 150
) -> tuple[PivotPoint, PivotPoint, PivotPoint] | None:
    if lookback < (pivot_window * 2) + 5:
        raise ValueError("lookback is too small for the selected pivot_window")

    scoped = bars[-lookback:] if len(bars) > lookback else bars
    offset = len(bars) - len(scoped)
    pivots = find_pivots(scoped, window=pivot_window)
    if len(pivots) < 3:
        return None

    for i in range(len(pivots) - 1, 1, -1):
        a = pivots[i - 2]
        b = pivots[i - 1]
        c = pivots[i]
        if a.kind == c.kind and a.kind != b.kind:
            return (
                PivotPoint(index=a.index + offset, kind=a.kind, price=a.price),
                PivotPoint(index=b.index + offset, kind=b.kind, price=b.price),
                PivotPoint(index=c.index + offset, kind=c.kind, price=c.price),
            )
    return None


def pitchfork_lines_at(
    points: tuple[PivotPoint, PivotPoint, PivotPoint], x_index: int
) -> PitchforkLines | None:
    a, b, c = points

    midpoint_x = (b.index + c.index) / 2.0
    midpoint_y = (b.price + c.price) / 2.0
    dx = midpoint_x - a.index
    if dx == 0:
        return None

    slope = (midpoint_y - a.price) / dx
    median = a.price + slope * (x_index - a.index)

    high_anchor = b if b.kind == "high" else c
    low_anchor = b if b.kind == "low" else c
    upper = high_anchor.price + slope * (x_index - high_anchor.index)
    lower = low_anchor.price + slope * (x_index - low_anchor.index)
    return PitchforkLines(median=median, upper=upper, lower=lower)


def andrews_pitchfork_signal(
    bars: list[dict],
    pivot_window: int = 3,
    lookback: int = 150,
    breakout_buffer: float = 0.001,
) -> str:
    if breakout_buffer < 0:
        raise ValueError("breakout_buffer must be >= 0")
    if len(bars) < (pivot_window * 2) + 6:
        return "HOLD"

    points = latest_pitchfork_points(bars, pivot_window=pivot_window, lookback=lookback)
    if points is None:
        return "HOLD"

    curr_x = len(bars) - 1
    prev_x = len(bars) - 2
    curr_lines = pitchfork_lines_at(points, curr_x)
    prev_lines = pitchfork_lines_at(points, prev_x)
    if curr_lines is None or prev_lines is None:
        return "HOLD"

    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    upper_trigger = curr_lines.upper * (1.0 + breakout_buffer)
    lower_trigger = curr_lines.lower * (1.0 - breakout_buffer)
    prev_upper_trigger = prev_lines.upper * (1.0 + breakout_buffer)
    prev_lower_trigger = prev_lines.lower * (1.0 - breakout_buffer)

    if prev_close <= prev_upper_trigger and curr_close > upper_trigger:
        return "BUY"
    if prev_close >= prev_lower_trigger and curr_close < lower_trigger:
        return "SELL"
    return "HOLD"
