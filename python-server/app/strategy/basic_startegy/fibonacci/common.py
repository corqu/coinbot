from dataclasses import dataclass


@dataclass(frozen=True)
class FibAnchor:
    index: int
    price: float


DEFAULT_PRICE_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
DEFAULT_EXT_RATIOS = [1.0, 1.272, 1.618, 2.0, 2.618]
DEFAULT_TIME_STEPS = [1, 2, 3, 5, 8, 13, 21, 34]

# Strategy-specific defaults (centralized to avoid per-file hardcoding).
DEFAULT_CIRCLE_RATIOS = [0.382, 0.5, 0.618, 1.0, 1.618]
DEFAULT_SPEED_RESISTANCE_ARCS_RATIOS = [0.382, 0.5, 0.618, 1.0]
DEFAULT_SPEED_RESISTANCE_FAN_RATIOS = [0.382, 0.5, 0.618]
DEFAULT_TREND_FIBONACCI_TIME_RATIOS = [0.618, 1.0, 1.618, 2.618]


def normalize_anchor(anchor: FibAnchor | dict) -> FibAnchor:
    if isinstance(anchor, FibAnchor):
        return anchor
    return FibAnchor(index=int(anchor["index"]), price=float(anchor["price"]))

