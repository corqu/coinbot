from app.strategy.basic_startegy.pitchfork.pitchfork import PivotPoint, pitchfork_lines_at


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


def inside_pitchfork_position(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    check_index: int | None = None,
    band_buffer: float = 0.0,
) -> str:
    if not bars:
        return "UNKNOWN"
    if band_buffer < 0:
        raise ValueError("band_buffer must be >= 0")

    a = _normalize_pivot(pivot_a)
    b = _normalize_pivot(pivot_b)
    c = _normalize_pivot(pivot_c)

    x = len(bars) - 1 if check_index is None else check_index
    lines = pitchfork_lines_at((a, b, c), x)
    if lines is None:
        return "UNKNOWN"

    close = float(bars[x]["close"])
    upper = lines.upper * (1.0 + band_buffer)
    lower = lines.lower * (1.0 - band_buffer)

    if close > upper:
        return "ABOVE"
    if close < lower:
        return "BELOW"
    return "INSIDE"


def inside_pitchfork_reentry_signal(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    reentry_buffer: float = 0.0,
) -> str:
    if len(bars) < 2:
        return "HOLD"
    if reentry_buffer < 0:
        raise ValueError("reentry_buffer must be >= 0")

    prev_pos = inside_pitchfork_position(
        bars=bars,
        pivot_a=pivot_a,
        pivot_b=pivot_b,
        pivot_c=pivot_c,
        check_index=len(bars) - 2,
        band_buffer=reentry_buffer,
    )
    curr_pos = inside_pitchfork_position(
        bars=bars,
        pivot_a=pivot_a,
        pivot_b=pivot_b,
        pivot_c=pivot_c,
        check_index=len(bars) - 1,
        band_buffer=reentry_buffer,
    )

    if prev_pos == "BELOW" and curr_pos == "INSIDE":
        return "BUY"
    if prev_pos == "ABOVE" and curr_pos == "INSIDE":
        return "SELL"
    return "HOLD"
