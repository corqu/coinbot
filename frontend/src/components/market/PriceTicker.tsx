import { useMemo } from "react";

type PriceTickerProps = {
  symbol: string;
  price: number;
  changeRate: number;
};

export function PriceTicker({ symbol, price, changeRate }: PriceTickerProps) {
  const color = useMemo(
    () => (changeRate >= 0 ? "text-emerald-300" : "text-rose-300"),
    [changeRate],
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-sm text-slate-400">{symbol}</p>
      <p className="mt-1 text-2xl font-semibold">{price.toLocaleString()}</p>
      <p className={`mt-1 text-sm ${color}`}>{changeRate >= 0 ? "+" : ""}{changeRate.toFixed(2)}%</p>
    </div>
  );
}
