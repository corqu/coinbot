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

export type ChartPickedPoint = {
  price: number;
  ts: number | null;
};

export type FibonacciCircleOverlay = {
  center?: ChartPickedPoint | null;
  edge?: ChartPickedPoint | null;
  ratios?: number[];
};

type BitcoinChartProps = {
  overlays?: ChartOverlay[];
  onPricePick?: (price: number) => void;
  onPointPick?: (point: ChartPickedPoint) => void;
  fibonacciCircleOverlay?: FibonacciCircleOverlay;
  onFibonacciOverlayClick?: () => void;
  overlaySelectionEnabled?: boolean;
  showFibonacciActions?: boolean;
  onFibonacciEdit?: () => void;
  onFibonacciDelete?: () => void;
};

const FIB_CIRCLE_DEFAULT_RATIOS = [0.236, 0.382, 0.5, 0.618, 1.0, 1.618, 2.0, 2.618];

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

function toUnixTs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }

  if (value && typeof value === "object") {
    const candidate = value as { year?: unknown; month?: unknown; day?: unknown };
    const year = Number(candidate.year);
    const month = Number(candidate.month);
    const day = Number(candidate.day);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      return Math.floor(Date.UTC(year, month - 1, day) / 1000);
    }
  }

  return null;
}

function rounded(value: number): number {
  return Number(value.toFixed(2));
}

export function BitcoinChart({
  overlays = [],
  onPricePick,
  onPointPick,
  fibonacciCircleOverlay,
  onFibonacciOverlayClick,
  overlaySelectionEnabled = true,
  showFibonacciActions = false,
  onFibonacciEdit,
  onFibonacciDelete,
}: BitcoinChartProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const summaryOverlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesMapRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const candlesRef = useRef<CandlestickData[]>(fallbackData);
  const overlaysRef = useRef<ChartOverlay[]>(overlays);
  const onPricePickRef = useRef<((price: number) => void) | undefined>(onPricePick);
  const onPointPickRef = useRef<((point: ChartPickedPoint) => void) | undefined>(onPointPick);
  const onFibonacciOverlayClickRef = useRef<(() => void) | undefined>(onFibonacciOverlayClick);
  const overlaySelectionEnabledRef = useRef<boolean>(overlaySelectionEnabled);
  const fibonacciCircleRef = useRef<FibonacciCircleOverlay | undefined>(fibonacciCircleOverlay);
  const fibSyncRafRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastPickAtRef = useRef<number>(0);
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

  const timeToXByTs = useCallback((ts: number): number | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const candles = candlesRef.current;
    if (candles.length === 0) return null;

    let nearestTime = candles[0].time;
    let minDiff = Number.POSITIVE_INFINITY;
    for (const candle of candles) {
      const candleTs = toUnixTs(candle.time);
      if (candleTs === null) continue;
      const diff = Math.abs(candleTs - ts);
      if (diff < minDiff) {
        minDiff = diff;
        nearestTime = candle.time;
      }
    }
    return chart.timeScale().timeToCoordinate(nearestTime);
  }, []);

  const syncFibonacciOverlay = useCallback(() => {
    const svg = svgOverlayRef.current;
    const container = containerRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciCircleRef.current;
    if (!svg || !container || !series) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (!overlay?.center || !overlay?.edge || overlay.center.ts === null || overlay.edge.ts === null) {
      svg.innerHTML = "";
      return;
    }

    const cx = timeToXByTs(overlay.center.ts);
    const cy = series.priceToCoordinate(overlay.center.price);
    const ex = timeToXByTs(overlay.edge.ts);
    const ey = series.priceToCoordinate(overlay.edge.price);
    if (cx === null || cy === null || ex === null || ey === null) {
      svg.innerHTML = "";
      return;
    }

    const baseRadius = Math.hypot(ex - cx, ey - cy);
    if (!Number.isFinite(baseRadius) || baseRadius <= 0) {
      svg.innerHTML = "";
      return;
    }

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0)
        : FIB_CIRCLE_DEFAULT_RATIOS;
    const circles = ratios
      .map((ratio, index) => {
        const radius = baseRadius * ratio;
        const strokeOpacity = Math.max(0.2, 0.85 - index * 0.08);
        return `<circle data-fib-overlay="true" cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="${strokeOpacity}" pointer-events="visibleStroke" />`;
      })
      .join("");

    svg.innerHTML = `
      ${circles}
      <circle data-fib-overlay="true" cx="${cx}" cy="${cy}" r="4" fill="#22c55e" pointer-events="visibleFill" />
      <circle data-fib-overlay="true" cx="${ex}" cy="${ey}" r="4" fill="#f97316" pointer-events="visibleFill" />
      <line data-fib-overlay="true" x1="${cx}" y1="${cy}" x2="${ex}" y2="${ey}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" pointer-events="visibleStroke" />
    `;
  }, [timeToXByTs]);

  const requestFibonacciSync = useCallback(() => {
    if (fibSyncRafRef.current !== null) return;
    fibSyncRafRef.current = window.requestAnimationFrame(() => {
      fibSyncRafRef.current = null;
      syncFibonacciOverlay();
    });
  }, [syncFibonacciOverlay]);

  const hitTestFibonacciOverlay = useCallback((x: number, y: number) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciCircleRef.current;
    if (!chart || !series || !overlay?.center || !overlay?.edge) return false;
    if (overlay.center.ts === null || overlay.edge.ts === null) return false;

    const cx = chart.timeScale().timeToCoordinate(overlay.center.ts as Time);
    const cy = series.priceToCoordinate(overlay.center.price);
    const ex = chart.timeScale().timeToCoordinate(overlay.edge.ts as Time);
    const ey = series.priceToCoordinate(overlay.edge.price);
    if (cx === null || cy === null || ex === null || ey === null) return false;

    const baseRadius = Math.hypot(ex - cx, ey - cy);
    if (!Number.isFinite(baseRadius) || baseRadius <= 0) return false;

    const dCenter = Math.hypot(x - cx, y - cy);
    const dEdge = Math.hypot(x - ex, y - ey);
    if (dCenter <= 8 || dEdge <= 8) return true;

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((r) => Number.isFinite(r) && r > 0)
        : FIB_CIRCLE_DEFAULT_RATIOS;
    const ringHit = ratios.some((ratio) => {
      const radius = baseRadius * ratio;
      return Math.abs(dCenter - radius) <= 6;
    });
    if (ringHit) return true;

    const vx = ex - cx;
    const vy = ey - cy;
    const wx = x - cx;
    const wy = y - cy;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    if (c2 <= 0) return false;
    const t = Math.max(0, Math.min(1, c1 / c2));
    const px = cx + t * vx;
    const py = cy + t * vy;
    return Math.hypot(x - px, y - py) <= 6;
  }, []);

  useEffect(() => {
    const updateLayoutMode = () => {
      const viewport = viewportRef.current;
      const overlay = summaryOverlayRef.current;
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
    if (summaryOverlayRef.current) resizeObserver.observe(summaryOverlayRef.current);

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
    requestFibonacciSync();

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

    const handleVisibleRangeChange = () => {
      requestFibonacciSync();
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const handleChartClick = (param: { point?: { x: number; y: number }; time?: unknown; seriesData: Map<unknown, unknown> }) => {
      const activeSeries = seriesRef.current;
      if (!activeSeries) return;

      const point = param.point;
      if (point) {
        const clickedPrice = activeSeries.coordinateToPrice(point.y);
        if (clickedPrice !== null && Number.isFinite(clickedPrice)) {
          const pickedPoint: ChartPickedPoint = {
            price: rounded(clickedPrice),
            ts: toUnixTs(param.time),
          };
          if (pickedPoint.ts === null) return;
          lastPickAtRef.current = Date.now();
          onPricePickRef.current?.(pickedPoint.price);
          onPointPickRef.current?.(pickedPoint);
          return;
        }
      }

      const clicked = Array.from(param.seriesData.values())
        .map((value) => asCandleSummary(value))
        .find((value): value is CandleSummary => value !== null);
      if (clicked) {
        const pickedPoint: ChartPickedPoint = {
          price: rounded(clicked.close),
          ts: toUnixTs(param.time),
        };
        if (pickedPoint.ts === null) return;
        lastPickAtRef.current = Date.now();
        onPricePickRef.current?.(pickedPoint.price);
        onPointPickRef.current?.(pickedPoint);
      }
    };
    chart.subscribeClick(handleChartClick);

    const handleContainerClick = (event: MouseEvent) => {
      const activeSeries = seriesRef.current;
      if (!activeSeries) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (overlaySelectionEnabledRef.current && hitTestFibonacciOverlay(x, y)) {
        onFibonacciOverlayClickRef.current?.();
        return;
      }

      // Prevent duplicate point-pick processing when lightweight-charts click already fired.
      if (Date.now() - lastPickAtRef.current < 40) return;

      const pickedPrice = activeSeries.coordinateToPrice(y);
      if (pickedPrice !== null && Number.isFinite(pickedPrice)) {
        const pickedTs = toUnixTs(chart.timeScale().coordinateToTime(x)) ?? toUnixTs(candlesRef.current[candlesRef.current.length - 1]?.time);
        if (pickedTs === null) return;
        const pickedPoint: ChartPickedPoint = {
          price: rounded(pickedPrice),
          ts: pickedTs,
        };
        lastPickAtRef.current = Date.now();
        onPricePickRef.current?.(pickedPoint.price);
        onPointPickRef.current?.(pickedPoint);
      }
    };
    container.addEventListener("click", handleContainerClick);

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
      requestFibonacciSync();
    });
    resizeObserver.observe(container);

    container.addEventListener("wheel", handleVisibleRangeChange, { passive: true });
    container.addEventListener("mousemove", handleVisibleRangeChange, { passive: true });
    container.addEventListener("touchmove", handleVisibleRangeChange, { passive: true });

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
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.unsubscribeClick(handleChartClick);
      container.removeEventListener("click", handleContainerClick);
      container.removeEventListener("wheel", handleVisibleRangeChange);
      container.removeEventListener("mousemove", handleVisibleRangeChange);
      container.removeEventListener("touchmove", handleVisibleRangeChange);
      if (fibSyncRafRef.current !== null) {
        window.cancelAnimationFrame(fibSyncRafRef.current);
        fibSyncRafRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [requestFibonacciSync, syncLineOverlays]);

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
              requestFibonacciSync();
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
            requestFibonacciSync();
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
        setStatus("WS 오류, 재시도 중...");
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, [requestFibonacciSync, syncLineOverlays]);

  useEffect(() => {
    overlaysRef.current = overlays;
    syncLineOverlays();
  }, [overlays, syncLineOverlays]);

  useEffect(() => {
    onPricePickRef.current = onPricePick;
  }, [onPricePick]);

  useEffect(() => {
    onPointPickRef.current = onPointPick;
  }, [onPointPick]);

  useEffect(() => {
    onFibonacciOverlayClickRef.current = onFibonacciOverlayClick;
  }, [onFibonacciOverlayClick]);

  useEffect(() => {
    overlaySelectionEnabledRef.current = overlaySelectionEnabled;
  }, [overlaySelectionEnabled]);

  useEffect(() => {
    fibonacciCircleRef.current = fibonacciCircleOverlay;
    requestFibonacciSync();
  }, [fibonacciCircleOverlay, requestFibonacciSync]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">비트코인 차트</h2>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
      <div ref={viewportRef}>
        <div className="relative" style={fixedLayoutWidth ? { minWidth: `${fixedLayoutWidth}px` } : undefined}>
          {showFibonacciActions && (
            <div className="absolute right-2 top-12 z-20 flex items-center gap-2">
              <button
                type="button"
                onClick={onFibonacciEdit}
                className="rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                도형 수정
              </button>
              <button
                type="button"
                onClick={onFibonacciDelete}
                className="rounded-md border border-red-700 bg-slate-950/80 px-2 py-1 text-[11px] text-red-300 hover:bg-red-900/30"
              >
                도형 지우기
              </button>
            </div>
          )}
          {candleSummary && (
            <div
              ref={summaryOverlayRef}
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
          <svg ref={svgOverlayRef} className="pointer-events-none absolute left-0 top-0 z-[5]" />
        </div>
      </div>
    </section>
  );
}
