from app.strategy.basic_startegy.indicators.common import simple_moving_average


def relative_vigor_index(bars: list[dict], period: int = 10, signal_period: int = 4) -> dict:
    if period <= 1:
        raise ValueError("period must be greater than 1")
    if signal_period <= 0:
        raise ValueError("signal_period must be positive")

    numerators: list[float] = []
    denominators: list[float] = []
    for item in bars:
        o = float(item["open"])
        h = float(item["high"])
        l = float(item["low"])
        c = float(item["close"])
        numerators.append(c - o)
        denominators.append(max(h - l, 1e-12))

    num_ma = simple_moving_average(numerators, period)
    den_ma = simple_moving_average(denominators, period)

    rvi: list[float | None] = [None] * len(bars)
    for i in range(len(bars)):
        if num_ma[i] is None or den_ma[i] is None:
            continue
        if den_ma[i] == 0:
            rvi[i] = 0.0
        else:
            rvi[i] = num_ma[i] / den_ma[i]

    signal = simple_moving_average([0.0 if v is None else v for v in rvi], signal_period)
    return {"rvi": rvi, "signal": signal}

