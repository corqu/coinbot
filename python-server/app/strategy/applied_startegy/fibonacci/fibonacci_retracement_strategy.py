from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_retracement import (
    fibonacci_retracement_levels,
    fibonacci_retracement_signal,
)


def snapshot(bars: list[dict], start: dict, end: dict, ratios: list[float] | None = None) -> dict | None:
    if not bars:
        return None
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    levels = fibonacci_retracement_levels(start=a, end=b, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "start": asdict(a),
        "end": asdict(b),
        "ratios": levels.ratios,
        "prices": levels.prices,
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], start: dict, end: dict, target_ratio: float = 0.5, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_retracement_signal(
        bars=bars, start=start, end=end, target_ratio=target_ratio, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict], start: dict, end: dict, qty: float, target_ratio: float = 0.5, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={
            "start": start,
            "end": end,
            "target_ratio": target_ratio,
            "breakout_buffer": breakout_buffer,
        },
    )

