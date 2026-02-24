def weighted_moving_average(values: list[float], window: int) -> list[float | None]:
    if window <= 0:
        raise ValueError("window must be positive")
    result: list[float | None] = [None] * len(values)
    if len(values) < window:
        return result
    weights = list(range(1, window + 1))
    denom = sum(weights)
    for i in range(window - 1, len(values)):
        chunk = values[i - window + 1 : i + 1]
        result[i] = sum(v * w for v, w in zip(chunk, weights)) / denom
    return result

