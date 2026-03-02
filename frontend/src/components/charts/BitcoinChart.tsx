import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useCallback, useEffect, useRef, useState } from "react";

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

type CandleSummary = {
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartOverlay = {
  id: string;
  label: string;
  value: number;
  color?: string;
  enabled?: boolean;
};

type BitcoinChartProps = {
  overlays?: ChartOverlay[];
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

function toPct(base: number, value: number): string {
  if (!Number.isFinite(base) || base === 0) return "0.00%";
  const pct = ((value - base) / base) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatPrice(value: number): string {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function asCandleSummary(value: unknown): CandleSummary | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const open = Number(candidate.open);
  const high = Number(candidate.high);
  const low = Number(candidate.low);
  const close = Number(candidate.close);

  if (![open, high, low, close].every(Number.isFinite)) return null;
  return { open, high, low, close };
}

function toneByDelta(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-slate-200";
}

function toLineData(candles: CandlestickData[], value: number): LineData[] {
  return candles.map((candle) => ({ time: candle.time, value }));
}

export function BitcoinChart({ overlays = [] }: BitcoinChartProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const candlesRef = useRef<CandlestickData[]>(fallbackData);
  const overlaysRef = useRef<ChartOverlay[]>(overlays);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const destroyedRef = useRef(false);
  const [status, setStatus] = useState("Python WS 연결 대기 중...");
  const [candleSummary, setCandleSummary] = useState<CandleSummary | null>(null);
  const [fixedLayoutWidth, setFixedLayoutWidth] = useState<number | null>(null);

  const syncLineOverlays = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const activeOverlays = overlaysRef.current.filter(
      (overlay) => overlay.enabled !== false && Number.isFinite(overlay.value),
    );
    const overlayIds = new Set(activeOverlays.map((overlay) => overlay.id));

    for (const [id, lineSeries] of lineSeriesMapRef.current) {
      if (!overlayIds.has(id)) {
        chart.removeSeries(lineSeries);
        lineSeriesMapRef.current.delete(id);
      }
    }

    for (const overlay of activeOverlays) {
      const existing = lineSeriesMapRef.current.get(overlay.id);
      const lineSeries =
        existing ??
        chart.addLineSeries({
          color: overlay.color ?? "#38bdf8",
          lineWidth: 2,
          lineStyle: 2,
          title: overlay.label,
          lastValueVisible: false,
          priceLineVisible: true,
        });

      if (!existing) {
        lineSeriesMapRef.current.set(overlay.id, lineSeries);
      }

      lineSeries.setData(toLineData(candlesRef.current, overlay.value));
    }
  }, []);

  useEffect(() => {
    const updateLayoutMode = () => {
      const viewport = viewportRef.current;
      const overlay = overlayRef.current;
      if (!viewport || !overlay) return;

      const requiredWidth = Math.ceil(overlay.scrollWidth + 24);
      if (viewport.clientWidth < requiredWidth) {
        setFixedLayoutWidth(requiredWidth);
      } else {
        setFixedLayoutWidth(null);
      }
    };

    updateLayoutMode();

    const resizeObserver = new ResizeObserver(() => {
      updateLayoutMode();
    });

    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    if (overlayRef.current) resizeObserver.observe(overlayRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [candleSummary]);

  useEffect(() => {
    destroyedRef.current = false;

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
    candlesRef.current = fallbackData;
    syncLineOverlays();

    const lastFallback = fallbackData[fallbackData.length - 1];
    setCandleSummary({
      open: Number(lastFallback.open),
      high: Number(lastFallback.high),
      low: Number(lastFallback.low),
      close: Number(lastFallback.close),
    });

    const handleCrosshairMove = (param: { seriesData: Map<unknown, unknown> }) => {
      const hovered = Array.from(param.seriesData.values())
        .map((value) => asCandleSummary(value))
        .find((value): value is CandleSummary => value !== null);
      if (hovered) {
        setCandleSummary(hovered);
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

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
      for (const lineSeries of lineSeriesMapRef.current.values()) {
        chart.removeSeries(lineSeries);
      }
      lineSeriesMapRef.current.clear();
      wsRef.current?.close();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [syncLineOverlays]);

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
              candlesRef.current = candles;
              const latest = asCandleSummary(candles[candles.length - 1]);
              if (latest) setCandleSummary(latest);
              syncLineOverlays();
            }
            setStatus(`실시간 수신 중 · ${message.symbol} ${message.interval}m`);
            return;
          }

          if (message.type === "kline") {
            for (const bar of message.bars) {
              const candle = toChartCandle(bar);
              seriesRef.current.update(candle);

              const currentCandles = candlesRef.current;
              const last = currentCandles[currentCandles.length - 1];
              if (last && last.time === candle.time) {
                currentCandles[currentCandles.length - 1] = candle;
              } else {
                currentCandles.push(candle);
                if (currentCandles.length > 500) currentCandles.shift();
              }

              setCandleSummary({
                open: Number(bar.open),
                high: Number(bar.high),
                low: Number(bar.low),
                close: Number(bar.close),
              });
            }
            syncLineOverlays();
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
  }, [syncLineOverlays]);

  useEffect(() => {
    overlaysRef.current = overlays;
    syncLineOverlays();
  }, [overlays, syncLineOverlays]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Bitcoin Chart</h2>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
      <div ref={viewportRef}>
        <div className="relative" style={fixedLayoutWidth ? { minWidth: `${fixedLayoutWidth}px` } : undefined}>
          {candleSummary && (
            <div
              ref={overlayRef}
              className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-3 overflow-hidden whitespace-nowrap rounded-md border border-slate-700/70 bg-slate-950/80 px-3 py-2 text-xs backdrop-blur"
            >
              <div className={toneByDelta(candleSummary.close - candleSummary.open)}>
                O {formatPrice(candleSummary.open)}
              </div>
              <div className={toneByDelta(candleSummary.high - candleSummary.open)}>
                H {formatPrice(candleSummary.high)} ({toPct(candleSummary.open, candleSummary.high)})
              </div>
              <div className={toneByDelta(candleSummary.low - candleSummary.open)}>
                L {formatPrice(candleSummary.low)} ({toPct(candleSummary.open, candleSummary.low)})
              </div>
              <div className={toneByDelta(candleSummary.close - candleSummary.open)}>
                C {formatPrice(candleSummary.close)} ({toPct(candleSummary.open, candleSummary.close)})
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full" />
        </div>
      </div>
    </section>
  );
}
