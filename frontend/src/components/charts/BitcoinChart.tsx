import { createChart, type CandlestickData, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

type StreamCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  confirm?: boolean;
};

type SnapshotMessage = {
  type: "snapshot";
  symbol: string;
  interval: string;
  candles: StreamCandle[];
};

type KlineMessage = {
  type: "kline";
  symbol: string;
  interval: string;
  bars: StreamCandle[];
};

const fallbackData: CandlestickData[] = [
  { time: "2026-02-20", open: 94200, high: 95650, low: 93800, close: 95100 },
  { time: "2026-02-21", open: 95100, high: 96120, low: 94750, close: 95490 },
  { time: "2026-02-24", open: 95490, high: 97400, low: 95230, close: 96910 },
  { time: "2026-02-25", open: 96910, high: 98300, low: 96250, close: 97520 },
  { time: "2026-02-26", open: 97520, high: 98810, low: 96800, close: 97240 },
  { time: "2026-02-27", open: 97240, high: 99520, low: 97020, close: 99180 },
];

function toChartCandle(candle: StreamCandle): CandlestickData {
  return {
    time: Math.floor(candle.ts / 1000) as Time,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
}

function getMarketWsUrl(): string {
  const envBase = import.meta.env.VITE_PYTHON_WS_BASE as string | undefined;
  if (envBase && envBase.trim()) {
    return `${envBase.replace(/\/$/, "")}/ws/market?symbol=BTCUSDT&interval=15&limit=200`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${protocol}//${host}:8001/ws/market?symbol=BTCUSDT&interval=15&limit=200`;
}

export function BitcoinChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const destroyedRef = useRef(false);
  const [status, setStatus] = useState("Python WS 연결 대기 중...");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 460,
      layout: { background: { color: "#0b1220" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      timeScale: { borderColor: "#334155" },
      rightPriceScale: { borderColor: "#334155" },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    series.setData(fallbackData);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);

    return () => {
      destroyedRef.current = true;
      resizeObserver.disconnect();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const connect = () => {
      if (destroyedRef.current || !seriesRef.current) return;

      const ws = new WebSocket(getMarketWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(`Python WS 연결됨 · ${new Date().toLocaleTimeString()}`);
      };

      ws.onmessage = (event) => {
        if (!seriesRef.current) return;

        try {
          const message = JSON.parse(event.data) as SnapshotMessage | KlineMessage;
          if (message.type === "snapshot") {
            const candles = message.candles.map(toChartCandle);
            if (candles.length > 0) {
              seriesRef.current.setData(candles);
            }
            setStatus(`실시간 수신 중 · ${message.symbol} ${message.interval}m`);
            return;
          }

          if (message.type === "kline") {
            for (const bar of message.bars) {
              seriesRef.current.update(toChartCandle(bar));
            }
            setStatus(`마지막 업데이트 ${new Date().toLocaleTimeString()}`);
          }
        } catch {
          setStatus("메시지 파싱 오류");
        }
      };

      ws.onclose = () => {
        if (destroyedRef.current) return;
        setStatus("연결 끊김, 재연결 중...");
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        setStatus("Python WS 연결 실패, 재시도 중...");
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Bitcoin Chart</h2>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
      <div ref={containerRef} className="w-full" />
    </section>
  );
}
