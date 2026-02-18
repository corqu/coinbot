from dataclasses import asdict

from app.strategy.basic_startegy.gann.gann_box import (
    GannAnchor,
    _normalize_anchor,
    gann_box_breakout_signal,
    gann_box_levels,
)


def box_snapshot(
    bars: list[dict],
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
) -> dict | None:
    if not bars:
        return None
    a = _normalize_anchor(start)
    b = _normalize_anchor(end)
    levels = gann_box_levels(start=a, end=b, ratios=ratios)
    return {
        "x_index": len(bars) - 1,
        "start": asdict(a),
        "end": asdict(b),
        "ratios": levels.ratios,
        "x_levels": levels.x_levels,
        "y_levels": levels.y_levels,
        "min_price": levels.min_price,
        "max_price": levels.max_price,
        "close": float(bars[-1]["close"]),
    }


def generate_signal(
    bars: list[dict],
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    ratios: list[float] | None = None,
    breakout_buffer: float = 0.0,
) -> str:
    return gann_box_breakout_signal(
        bars=bars,
        start=start,
        end=end,
        ratios=ratios,
        breakout_buffer=breakout_buffer,
    )


def run_backtest(
    bars: list[dict],
    start: GannAnchor | dict,
    end: GannAnchor | dict,
    qty: float,
    ratios: list[float] | None = None,
    breakout_buffer: float = 0.0,
) -> dict:
    if len(bars) < 2:
        raise ValueError("Not enough bars for backtest")
    if qty <= 0:
        raise ValueError("qty must be positive")

    position = 0
    entry_price = 0.0
    realized_pnl = 0.0
    win_trades = 0
    loss_trades = 0
    total_trades = 0
    equity_curve = []

    for idx in range(1, len(bars)):
        signal = generate_signal(
            bars=bars[: idx + 1],
            start=start,
            end=end,
            ratios=ratios,
            breakout_buffer=breakout_buffer,
        )
        price = float(bars[idx]["close"])

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
        equity_curve.append({"ts": int(bars[idx]["ts"]), "equity": realized_pnl + unrealized})

    if position != 0:
        last_price = float(bars[-1]["close"])
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
