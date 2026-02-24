from math import sqrt


def simple_moving_average(values: list[float], window: int) -> list[float | None]:
    if window <= 0:
        raise ValueError("window must be positive")
    result: list[float | None] = [None] * len(values)
    if len(values) < window:
        return result
    run_sum = sum(values[:window])
    result[window - 1] = run_sum / window
    for i in range(window, len(values)):
        run_sum += values[i] - values[i - window]
        result[i] = run_sum / window
    return result


def exponential_moving_average(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError("period must be positive")
    result: list[float | None] = [None] * len(values)
    if len(values) < period:
        return result
    multiplier = 2.0 / (period + 1.0)
    seed = sum(values[:period]) / period
    result[period - 1] = seed
    ema = seed
    for i in range(period, len(values)):
        ema = ((values[i] - ema) * multiplier) + ema
        result[i] = ema
    return result


def rolling_std(values: list[float], window: int) -> list[float | None]:
    if window <= 1:
        raise ValueError("window must be greater than 1")
    result: list[float | None] = [None] * len(values)
    if len(values) < window:
        return result
    for i in range(window - 1, len(values)):
        chunk = values[i - window + 1 : i + 1]
        mean = sum(chunk) / window
        var = sum((x - mean) ** 2 for x in chunk) / window
        result[i] = sqrt(var)
    return result

