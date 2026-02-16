def moving_average(values: list[float], window: int) -> list[float | None]:
    if window <= 0:
        raise ValueError("window must be positive")
    result: list[float | None] = [None] * len(values)
    if len(values) < window:
        return result

    running_sum = sum(values[:window])
    result[window - 1] = running_sum / window
    for i in range(window, len(values)):
        running_sum += values[i] - values[i - window]
        result[i] = running_sum / window
    return result
