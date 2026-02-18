from dataclasses import asdict

from app.strategy.applied_startegy.fibonacci.common import run_signal_backtest
from app.strategy.basic_startegy.fibonacci.common import normalize_anchor
from app.strategy.basic_startegy.fibonacci.fibonacci_time_zones import fibonacci_time_zones, fibonacci_time_zones_signal


def snapshot(bars: list[dict], start: dict, end: dict, steps: list[int] | None = None) -> dict | None:
    if not bars:
        return None
    a = normalize_anchor(start)
    b = normalize_anchor(end)
    zones = fibonacci_time_zones(start=a, end=b, steps=steps)
    return {
        "x_index": len(bars) - 1,
        "start": asdict(a),
        "end": asdict(b),
        "steps": zones.steps,
        "zone_indexes": zones.zone_indexes,
        "close": float(bars[-1]["close"]),
    }


def generate_signal(bars: list[dict], start: dict, end: dict, steps: list[int] | None = None) -> str:
    return fibonacci_time_zones_signal(bars=bars, start=start, end=end, steps=steps)


def run_backtest(bars: list[dict], start: dict, end: dict, qty: float, steps: list[int] | None = None) -> dict:
    return run_signal_backtest(
        bars=bars,
        qty=qty,
        signal_func=generate_signal,
        signal_kwargs={"start": start, "end": end, "steps": steps},
    )

