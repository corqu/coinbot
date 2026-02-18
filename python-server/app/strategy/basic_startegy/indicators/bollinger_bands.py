from app.strategy.basic_startegy.indicators.common import rolling_std, simple_moving_average


def bollinger_bands(
    values: list[float],
    window: int = 20,
    num_std: float = 2.0,
) -> dict:
    if window <= 1:
        raise ValueError("window must be greater than 1")
    if num_std < 0:
        raise ValueError("num_std must be >= 0")
    mid = simple_moving_average(values, window)
    std = rolling_std(values, window)
    upper: list[float | None] = [None] * len(values)
    lower: list[float | None] = [None] * len(values)
    for i in range(len(values)):
        if mid[i] is None or std[i] is None:
            continue
        upper[i] = mid[i] + (num_std * std[i])
        lower[i] = mid[i] - (num_std * std[i])
    return {"upper": upper, "middle": mid, "lower": lower}

