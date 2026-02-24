def directional_movement_index(bars: list[dict], period: int = 14) -> dict:
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(bars)
    plus_di: list[float | None] = [None] * n
    minus_di: list[float | None] = [None] * n
    adx: list[float | None] = [None] * n
    if n <= period:
        return {"+di": plus_di, "-di": minus_di, "adx": adx}

    trs: list[float] = [0.0] * n
    plus_dm: list[float] = [0.0] * n
    minus_dm: list[float] = [0.0] * n

    for i in range(1, n):
        high = float(bars[i]["high"])
        low = float(bars[i]["low"])
        prev_high = float(bars[i - 1]["high"])
        prev_low = float(bars[i - 1]["low"])
        prev_close = float(bars[i - 1]["close"])
        up_move = high - prev_high
        down_move = prev_low - low
        plus_dm[i] = up_move if up_move > down_move and up_move > 0 else 0.0
        minus_dm[i] = down_move if down_move > up_move and down_move > 0 else 0.0
        tr1 = high - low
        tr2 = abs(high - prev_close)
        tr3 = abs(low - prev_close)
        trs[i] = max(tr1, tr2, tr3)

    tr_smooth = sum(trs[1 : period + 1])
    plus_smooth = sum(plus_dm[1 : period + 1])
    minus_smooth = sum(minus_dm[1 : period + 1])

    dx_values: list[float | None] = [None] * n
    for i in range(period + 1, n):
        tr_smooth = tr_smooth - (tr_smooth / period) + trs[i]
        plus_smooth = plus_smooth - (plus_smooth / period) + plus_dm[i]
        minus_smooth = minus_smooth - (minus_smooth / period) + minus_dm[i]
        if tr_smooth == 0:
            continue
        pdi = (plus_smooth / tr_smooth) * 100.0
        mdi = (minus_smooth / tr_smooth) * 100.0
        plus_di[i] = pdi
        minus_di[i] = mdi
        denom = pdi + mdi
        dx_values[i] = 0.0 if denom == 0 else (abs(pdi - mdi) / denom) * 100.0

    start = period * 2
    if start < n:
        seed = [x for x in dx_values[period + 1 : start + 1] if x is not None]
        if seed:
            adx_val = sum(seed) / len(seed)
            adx[start] = adx_val
            for i in range(start + 1, n):
                if dx_values[i] is None:
                    continue
                adx_val = ((adx_val * (period - 1)) + dx_values[i]) / period
                adx[i] = adx_val

    return {"+di": plus_di, "-di": minus_di, "adx": adx}

