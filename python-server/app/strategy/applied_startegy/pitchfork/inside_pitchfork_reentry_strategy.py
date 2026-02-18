from dataclasses import asdict

from app.strategy.basic_startegy.pitchfork.inside_pitchfork import (
    inside_pitchfork_position,
    inside_pitchfork_reentry_signal,
)
from app.strategy.basic_startegy.pitchfork.pitchfork import PivotPoint, pitchfork_lines_at


def _normalize_pivot(pivot: PivotPoint | dict) -> PivotPoint:
    if isinstance(pivot, PivotPoint):
        return pivot
    kind = str(pivot["kind"]).lower()
    if kind not in ("high", "low"):
        raise ValueError("pivot kind must be 'high' or 'low'")
    return PivotPoint(
        index=int(pivot["index"]),
        kind=kind,
        price=float(pivot["price"]),
    )


def pitchfork_snapshot(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    reentry_buffer: float = 0.0,
) -> dict | None:
    if not bars:
        return None
    a = _normalize_pivot(pivot_a)
    b = _normalize_pivot(pivot_b)
    c = _normalize_pivot(pivot_c)

    x = len(bars) - 1
    lines = pitchfork_lines_at((a, b, c), x)
    if lines is None:
        return None

    return {
        "x_index": x,
        "pivot_a": asdict(a),
        "pivot_b": asdict(b),
        "pivot_c": asdict(c),
        "median": lines.median,
        "upper": lines.upper,
        "lower": lines.lower,
        "close": float(bars[-1]["close"]),
        "position": inside_pitchfork_position(
            bars=bars,
            pivot_a=a,
            pivot_b=b,
            pivot_c=c,
            band_buffer=reentry_buffer,
        ),
    }


def generate_signal(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    reentry_buffer: float = 0.0,
) -> str:
    return inside_pitchfork_reentry_signal(
        bars=bars,
        pivot_a=pivot_a,
        pivot_b=pivot_b,
        pivot_c=pivot_c,
        reentry_buffer=reentry_buffer,
    )


def run_backtest(
    bars: list[dict],
    pivot_a: PivotPoint | dict,
    pivot_b: PivotPoint | dict,
    pivot_c: PivotPoint | dict,
    qty: float,
    reentry_buffer: float = 0.0,
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
            pivot_a=pivot_a,
            pivot_b=pivot_b,
            pivot_c=pivot_c,
            reentry_buffer=reentry_buffer,
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
