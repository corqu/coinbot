from app.strategy.basic_startegy.indicators.common import exponential_moving_average


def double_exponential_moving_average(values: list[float], period: int = 20) -> list[float | None]:
    ema1 = exponential_moving_average(values, period)
    ema2 = exponential_moving_average([0.0 if v is None else v for v in ema1], period)
    out: list[float | None] = [None] * len(values)
    for i in range(len(values)):
        if ema1[i] is None or ema2[i] is None:
            continue
        out[i] = (2.0 * ema1[i]) - ema2[i]
    return out

