def accumulation_distribution_line(bars: list[dict]) -> list[float]:
    adl: list[float] = []
    cumulative = 0.0
    for item in bars:
        high = float(item["high"])
        low = float(item["low"])
        close = float(item["close"])
        volume = float(item.get("volume", 0.0))
        if high == low:
            mfm = 0.0
        else:
            mfm = ((close - low) - (high - close)) / (high - low)
        mfv = mfm * volume
        cumulative += mfv
        adl.append(cumulative)
    return adl

