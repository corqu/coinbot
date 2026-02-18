from app.strategy.basic_startegy.indicators.common import simple_moving_average


def rate_of_change(values: list[float], period: int) -> list[float | None]:
    if period <= 0:
        raise ValueError("period must be positive")
    out: list[float | None] = [None] * len(values)
    for i in range(period, len(values)):
        prev = values[i - period]
        if prev == 0:
            out[i] = 0.0
        else:
            out[i] = ((values[i] - prev) / prev) * 100.0
    return out


def know_sure_thing(
    closes: list[float],
    roc_periods: tuple[int, int, int, int] = (10, 15, 20, 30),
    sma_periods: tuple[int, int, int, int] = (10, 10, 10, 15),
    signal_period: int = 9,
) -> dict:
    r1 = rate_of_change(closes, roc_periods[0])
    r2 = rate_of_change(closes, roc_periods[1])
    r3 = rate_of_change(closes, roc_periods[2])
    r4 = rate_of_change(closes, roc_periods[3])

    s1 = simple_moving_average([0.0 if v is None else v for v in r1], sma_periods[0])
    s2 = simple_moving_average([0.0 if v is None else v for v in r2], sma_periods[1])
    s3 = simple_moving_average([0.0 if v is None else v for v in r3], sma_periods[2])
    s4 = simple_moving_average([0.0 if v is None else v for v in r4], sma_periods[3])

    kst: list[float | None] = [None] * len(closes)
    for i in range(len(closes)):
        if None in (s1[i], s2[i], s3[i], s4[i]):
            continue
        kst[i] = (s1[i] * 1.0) + (s2[i] * 2.0) + (s3[i] * 3.0) + (s4[i] * 4.0)

    signal = simple_moving_average([0.0 if v is None else v for v in kst], signal_period)
    return {"kst": kst, "signal": signal}

