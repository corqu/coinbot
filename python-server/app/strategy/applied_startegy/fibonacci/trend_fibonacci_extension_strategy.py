from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.trend_fibonacci_extension import (
    trend_fibonacci_extension_levels,
    trend_fibonacci_extension_signal,
)


def snapshot(bars: list[dict], a: dict, b: dict, c: dict, ratios: list[float] | None = None) -> dict | None:
    if not bars:
        return None
    p1 = normalize_anchor(a)
    p2 = normalize_anchor(b)
    p3 = normalize_anchor(c)
    levels = trend_fibonacci_extension_levels(a=p1, b=p2, c=p3, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "a": asdict(p1),
        "b": asdict(p2),
        "c": asdict(p3),
        "ratios": levels.ratios,
        "prices": levels.prices,
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], a: dict, b: dict, c: dict, trigger_ratio: float = 1.0, breakout_buffer: float = 0.0
) -> str:
    return trend_fibonacci_extension_signal(
        bars=bars, a=a, b=b, c=c, trigger_ratio=trigger_ratio, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict], a: dict, b: dict, c: dict, qty: float, trigger_ratio: float = 1.0, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={"a": a, "b": b, "c": c, "trigger_ratio": trigger_ratio, "breakout_buffer": breakout_buffer},
    )

