from dataclasses import asdict
from math import pi

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_spiral import fibonacci_spiral_point, fibonacci_spiral_signal


def snapshot(bars: list[dict], center: dict, start: dict, theta_step: float = pi / 8.0) -> dict | None:
    if not bars:
        return None
    c = normalize_anchor(center)
    s = normalize_anchor(start)
    point = fibonacci_spiral_point(center=c, start=s, x_index=len(bars) - 1, theta_step=theta_step)
    return {
        "x_index": len(bars) - 1,
        "center": asdict(c),
        "start": asdict(s),
        "spiral_point": {"x_index": point.x_index, "y_price": point.y_price},
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict], center: dict, start: dict, theta_step: float = pi / 8.0, breakout_buffer: float = 0.0
) -> str:
    return fibonacci_spiral_signal(
        bars=bars, center=center, start=start, theta_step=theta_step, breakout_buffer=breakout_buffer
    )


def run_backtest(
    bars: list[dict],
    center: dict,
    start: dict,
    qty: float,
    theta_step: float = pi / 8.0,
    breakout_buffer: float = 0.0,
) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={
            "center": center,
            "start": start,
            "theta_step": theta_step,
            "breakout_buffer": breakout_buffer,
        },
    )

