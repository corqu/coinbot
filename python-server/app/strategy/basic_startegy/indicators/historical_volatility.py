from math import log, sqrt

from app.strategy.basic_startegy.indicators.common import rolling_std


def historical_volatility(
    closes: list[float],
    window: int = 20,
    annualization: int = 365,
) -> list[float | None]:
    if window <= 1:
        raise ValueError("window must be greater than 1")
    if annualization <= 0:
        raise ValueError("annualization must be positive")
    if len(closes) < 2:
        return [None] * len(closes)

    log_returns = [0.0]
    for i in range(1, len(closes)):
        prev = closes[i - 1]
        curr = closes[i]
        if prev <= 0 or curr <= 0:
            log_returns.append(0.0)
        else:
            log_returns.append(log(curr / prev))

    vol = rolling_std(log_returns, window=window)
    scale = sqrt(annualization)
    return [None if v is None else v * scale for v in vol]

