def donchian_channel(
    bars: list[dict],
    window: int = 20,
) -> dict:
    if window <= 0:
        raise ValueError("window must be positive")
    upper: list[float | None] = [None] * len(bars)
    lower: list[float | None] = [None] * len(bars)
    mid: list[float | None] = [None] * len(bars)
    highs = [float(item["high"]) for item in bars]
    lows = [float(item["low"]) for item in bars]
    for i in range(window - 1, len(bars)):
        h = max(highs[i - window + 1 : i + 1])
        l = min(lows[i - window + 1 : i + 1])
        upper[i] = h
        lower[i] = l
        mid[i] = (h + l) / 2.0
    return {"upper": upper, "lower": lower, "middle": mid}

