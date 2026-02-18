from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_speed_resistance_arcs import (
    fibonacci_speed_resistance_arc_bands_at,
    fibonacci_speed_resistance_arcs_signal,
)


def snapshot(bars: list[dict], start: dict, end: dict, ratios: list[float] | None = None) -> dict | None:
    if not bars:
        return None
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    bands = fibonacci_speed_resistance_arc_bands_at(start=a, end=b, x_index=len(bars) - 1, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "start": asdict(a),
        "end": asdict(b),
        "bands": [{"ratio": item.ratio, "upper": item.upper, "lower": item.lower} for item in bands],
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], start: dict, end: dict, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_speed_resistance_arcs_signal(
        bars=bars, start=start, end=end, ratios=ratios, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict], start: dict, end: dict, qty: float, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={"start": start, "end": end, "ratios": ratios, "breakout_buffer": breakout_buffer},
    )

