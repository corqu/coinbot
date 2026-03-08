from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_channel import fibonacci_channel_bands_at, fibonacci_channel_signal


def snapshot(bars: list[dict], a: dict, b: dict, c: dict, ratios: list[float] | None = None) -> dict | None:
    if not bars:
        return None
    p1 = normalize_anchor(a)
    p2 = normalize_anchor(b)
    p3 = normalize_anchor(c)
    bands = fibonacci_channel_bands_at(a=p1, b=p2, c=p3, x_index=len(bars) - 1, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "a": asdict(p1),
        "b": asdict(p2),
        "c": asdict(p3),
        "bands": [
            {"ratio": band.ratio, "upper": band.upper, "lower": band.lower, "center": band.center} for band in bands
        ],
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], a: dict, b: dict, c: dict, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_channel_signal(bars=bars, a=a, b=b, c=c, ratios=ratios, breakout_buffer=breakout_buffer)


def run_backtest(
    bars: list[dict], a: dict, b: dict, c: dict, qty: float, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={"a": a, "b": b, "c": c, "ratios": ratios, "breakout_buffer": breakout_buffer},
    )

