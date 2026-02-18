def rate_of_change(values: list[float], period: int = 12) -> list[float | None]:
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

