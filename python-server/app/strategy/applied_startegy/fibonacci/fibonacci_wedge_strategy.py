from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_wedge import fibonacci_wedge_band_at, fibonacci_wedge_signal


def snapshot(bars: list[dict], start: dict, end: dict, narrow_ratio: float = 0.382) -> dict | None:
    if not bars:
        return None
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    band = fibonacci_wedge_band_at(start=a, end=b, x_index=len(bars) - 1, narrow_ratio=narrow_ratio)
    if band is None:
        return None
    return {
        "x_index": len(bars) - 1,
        "start": asdict(a),
        "end": asdict(b),
        "upper": band.upper,
        "lower": band.lower,
        "center": band.center,
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], start: dict, end: dict, narrow_ratio: float = 0.382, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_wedge_signal(
        bars=bars, start=start, end=end, narrow_ratio=narrow_ratio, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict], start: dict, end: dict, qty: float, narrow_ratio: float = 0.382, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={
            "start": start,
            "end": end,
            "narrow_ratio": narrow_ratio,
            "breakout_buffer": breakout_buffer,
        },
    )

