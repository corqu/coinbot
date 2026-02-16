from app.strategy.basic_startegy.moving_average import moving_average
from app.strategy.basic_startegy.rsi import relative_strength_index
from app.strategy.basic_startegy.volume import is_volume_confirmed


def generate_signal(
    bars: list[dict],
    short_window: int,
    long_window: int,
    rsi_period: int = 14,
    use_rsi: bool = True,
    rsi_buy_max: float = 70.0,
    rsi_sell_min: float = 30.0,
    use_volume_filter: bool = True,
    volume_window: int = 20,
    volume_multiplier: float = 1.0,
) -> str:
    if short_window >= long_window:
        raise ValueError("short_window must be less than long_window")

    closes = [item["close"] for item in bars]
    volumes = [item["volume"] for item in bars]

    min_bars = max(long_window + 2, rsi_period + 1, volume_window)
    if len(closes) < min_bars:
        return "HOLD"

    short_ma = moving_average(closes, short_window)
    long_ma = moving_average(closes, long_window)
    prev_short = short_ma[-2]
    prev_long = long_ma[-2]
    curr_short = short_ma[-1]
    curr_long = long_ma[-1]
    if None in (prev_short, prev_long, curr_short, curr_long):
        return "HOLD"

    ma_signal = "HOLD"
    if prev_short <= prev_long and curr_short > curr_long:
        ma_signal = "BUY"
    elif prev_short >= prev_long and curr_short < curr_long:
        ma_signal = "SELL"
    if ma_signal == "HOLD":
        return "HOLD"

    if use_rsi:
        rsi_values = relative_strength_index(closes, rsi_period)
        curr_rsi = rsi_values[-1]
        if curr_rsi is None:
            return "HOLD"
        if ma_signal == "BUY" and curr_rsi > rsi_buy_max:
            return "HOLD"
        if ma_signal == "SELL" and curr_rsi < rsi_sell_min:
            return "HOLD"

    if use_volume_filter and not is_volume_confirmed(volumes, volume_window, volume_multiplier):
        return "HOLD"

    return ma_signal


def run_backtest(
    bars: list[dict],
    short_window: int,
    long_window: int,
    qty: float,
) -> dict:
    closes = [item["close"] for item in bars]
    if len(closes) < long_window + 2:
        raise ValueError("Not enough bars for backtest")

    position = 0
    entry_price = 0.0
    realized_pnl = 0.0
    win_trades = 0
    loss_trades = 0
    total_trades = 0
    equity_curve = []

    for idx in range(long_window + 1, len(closes)):
        signal = generate_signal(bars[: idx + 1], short_window, long_window)
        price = closes[idx]

        if signal == "BUY" and position <= 0:
            if position == -1:
                pnl = (entry_price - price) * qty
                realized_pnl += pnl
                total_trades += 1
                if pnl >= 0:
                    win_trades += 1
                else:
                    loss_trades += 1
            position = 1
            entry_price = price
        elif signal == "SELL" and position >= 0:
            if position == 1:
                pnl = (price - entry_price) * qty
                realized_pnl += pnl
                total_trades += 1
                if pnl >= 0:
                    win_trades += 1
                else:
                    loss_trades += 1
            position = -1
            entry_price = price

        unrealized = 0.0
        if position == 1:
            unrealized = (price - entry_price) * qty
        elif position == -1:
            unrealized = (entry_price - price) * qty
        equity_curve.append({"ts": bars[idx]["ts"], "equity": realized_pnl + unrealized})

    if position != 0:
        last_price = closes[-1]
        pnl = (last_price - entry_price) * qty if position == 1 else (entry_price - last_price) * qty
        realized_pnl += pnl
        total_trades += 1
        if pnl >= 0:
            win_trades += 1
        else:
            loss_trades += 1

    win_rate = (win_trades / total_trades * 100.0) if total_trades > 0 else 0.0
    return {
        "total_trades": total_trades,
        "win_trades": win_trades,
        "loss_trades": loss_trades,
        "win_rate": round(win_rate, 2),
        "realized_pnl": round(realized_pnl, 6),
        "equity_curve": equity_curve,
    }
