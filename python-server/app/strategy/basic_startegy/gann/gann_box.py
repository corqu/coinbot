from dataclasses import dataclass


@dataclass(frozen=True)
class GannAnchor:
    index: int
    price: float


@dataclass(frozen=True)
class GannBoxLevels:
    ratios: list[float]
    x_levels: list[float]
    y_levels: list[float]
    min_price: float
    max_price: float


def _normalize_anchor(anchor: GannAnchor | dict) -> GannAnchor:
    if isinstance(anchor, GannAnchor):
        return anchor
    return GannAnchor(index=int(anchor["index"]), price=float(anchor["price"]))


def gann_box_levels(
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
) -> GannBoxLevels:
    a = _normalize_anchor(start)
    b = _normalize_anchor(end)
    fib = ratios or [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
    if not fib:
        raise ValueError("ratios must not be empty")

    dx = b.index - a.index
    dy = b.price - a.price
    x_levels = [a.index + (dx * ratio) for ratio in fib]
    y_levels = [a.price + (dy * ratio) for ratio in fib]
    low = min(a.price, b.price)
    high = max(a.price, b.price)
    return GannBoxLevels(ratios=fib, x_levels=x_levels, y_levels=y_levels, min_price=low, max_price=high)


def gann_box_breakout_signal(
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

    levels = gann_box_levels(start=start, end=end, ratios=ratios)
    prev_close = float(bars[-2]["close"])
    curr_close = float(bars[-1]["close"])
    upper = levels.max_price * (1.0 + breakout_buffer)
    lower = levels.min_price * (1.0 - breakout_buffer)

    if prev_close <= upper and curr_close > upper:
        return "BUY"
    if prev_close >= lower and curr_close < lower:
        return "SELL"
    return "HOLD"
