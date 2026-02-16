from app.strategy.basic_startegy.moving_average import moving_average


def volume_sma(volumes: list[float], window: int = 20) -> list[float | None]:
    return moving_average(volumes, window)


def is_volume_confirmed(volumes: list[float], window: int = 20, multiplier: float = 1.0) -> bool:
    if len(volumes) < window or window <= 0:
        return False
    vol_ma = volume_sma(volumes, window)
    latest_ma = vol_ma[-1]
    if latest_ma is None:
        return False
    return volumes[-1] >= latest_ma * multiplier
