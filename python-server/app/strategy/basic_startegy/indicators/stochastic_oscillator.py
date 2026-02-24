from app.strategy.basic_startegy.indicators.common import simple_moving_average


def stochastic_oscillator(
    bars: list[dict],
    k_period: int = 14,
    d_period: int = 3,
    smooth_k: int = 1,
) -> dict:
    if k_period <= 0:
        raise ValueError("k_period must be positive")
    if d_period <= 0:
        raise ValueError("d_period must be positive")
    if smooth_k <= 0:
        raise ValueError("smooth_k must be positive")

    highs = [float(item["high"]) for item in bars]
    lows = [float(item["low"]) for item in bars]
    closes = [float(item["close"]) for item in bars]
    raw_k: list[float | None] = [None] * len(bars)

    for i in range(k_period - 1, len(bars)):
        hh = max(highs[i - k_period + 1 : i + 1])
        ll = min(lows[i - k_period + 1 : i + 1])
        denom = hh - ll
        raw_k[i] = 0.0 if denom == 0 else ((closes[i] - ll) / denom) * 100.0

    k_series = simple_moving_average([0.0 if v is None else v for v in raw_k], smooth_k)
    d_series = simple_moving_average([0.0 if v is None else v for v in k_series], d_period)
    return {"%k": k_series, "%d": d_series}

