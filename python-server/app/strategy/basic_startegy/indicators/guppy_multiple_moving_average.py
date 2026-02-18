from app.strategy.basic_startegy.indicators.common import exponential_moving_average


def guppy_multiple_moving_average(
    closes: list[float],
    short_periods: list[int] | None = None,
    long_periods: list[int] | None = None,
) -> dict:
    short_set = short_periods or [3, 5, 8, 10, 12, 15]
    long_set = long_periods or [30, 35, 40, 45, 50, 60]
    short_emas = {period: exponential_moving_average(closes, period) for period in short_set}
    long_emas = {period: exponential_moving_average(closes, period) for period in long_set}
    return {"short": short_emas, "long": long_emas}

