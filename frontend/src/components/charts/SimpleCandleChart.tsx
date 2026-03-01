import { createChart, type IChartApi, type ISeriesApi, type CandlestickData } from "lightweight-charts";
import { useEffect, useRef } from "react";

const sampleData: CandlestickData[] = [
  { time: "2026-02-20", open: 120, high: 130, low: 115, close: 128 },
  { time: "2026-02-21", open: 128, high: 135, low: 121, close: 124 },
  { time: "2026-02-24", open: 124, high: 140, low: 123, close: 138 },
  { time: "2026-02-25", open: 138, high: 145, low: 132, close: 141 },
  { time: "2026-02-26", open: 141, high: 149, low: 136, close: 139 },
  { time: "2026-02-27", open: 139, high: 152, low: 137, close: 150 },
];

export function SimpleCandleChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: 340,
      layout: {
        background: { color: "#0b1220" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      timeScale: {
        borderColor: "#334155",
      },
      rightPriceScale: {
        borderColor: "#334155",
      },
    });

    const series: ISeriesApi<"Candlestick"> = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    series.setData(sampleData);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  return <div ref={containerRef} className="w-full" />;
}
