from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_circles import fibonacci_circles, fibonacci_circles_signal


def snapshot(bars: list[dict], center: dict, edge: dict, ratios: list[float] | None = None) -> dict | None:
    if not bars:
        return None
    c = normalize_anchor(center)
    e = normalize_anchor(edge)
    circles = fibonacci_circles(center=c, edge=e, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "center": asdict(c),
        "edge": asdict(e),
        "circles": [{"ratio": item.ratio, "radius": item.radius} for item in circles],
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], center: dict, edge: dict, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_circles_signal(
        bars=bars, center=center, edge=edge, ratios=ratios, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict], center: dict, edge: dict, qty: float, ratios: list[float] | None = None, breakout_buffer: float = 0.0
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={"center": center, "edge": edge, "ratios": ratios, "breakout_buffer": breakout_buffer},
    )

