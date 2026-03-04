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

type DrawingToolKind = "trendline" | "fibonacci" | "gann" | "pitchfork";

type UserLineDrawing = {
  id: string;
  tool: DrawingToolKind;
  variant: string;
  start: { price: number; ts: number | null };
  end: { price: number; ts: number | null };
};

type UserDrawingScreenGeometry = {
  id: string;
  start: ScreenPoint;
  end: ScreenPoint;
  line: ScreenPoint[];
};
type ScreenPoint = {
  x: number;
  y: number;
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

export type FibonacciChannelOverlay = {
  start?: ChartPickedPoint | null;
  end?: ChartPickedPoint | null;
  previewEnd?: ChartPickedPoint | null;
  ratios?: number[];
};

type BitcoinChartProps = {
  enableDrawingTools?: boolean;
  overlays?: ChartOverlay[];
  onPricePick?: (price: number) => void;
  onPointPick?: (point: ChartPickedPoint) => void;
  onHoverPointChange?: (point: ChartPickedPoint | null) => void;
  onFibonacciPointDrag?: (target: "center" | "edge", point: ChartPickedPoint) => void;
  onFibonacciChannelPointDrag?: (target: "start" | "end", point: ChartPickedPoint) => void;
  onFibonacciChannelMove?: (next: { start: ChartPickedPoint; end: ChartPickedPoint }) => void;
  fibonacciCircleOverlay?: FibonacciCircleOverlay;
  fibonacciChannelOverlay?: FibonacciChannelOverlay;
  onFibonacciOverlayClick?: () => void;
  overlaySelectionEnabled?: boolean;
  showFibonacciActions?: boolean;
  onFibonacciDelete?: () => void;
};

const FIB_CIRCLE_DEFAULT_RATIOS = [0.236, 0.382, 0.5, 0.618, 1.0, 1.618, 2.0, 2.618];
const FIB_CHANNEL_DEFAULT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_CHANNEL_DEFAULT_EXT_RATIOS = [0.618, 1.0, 1.272, 1.618, 2.0, 2.618];
const FIB_CHANNEL_FORWARD_BARS = 60;
const MAIN_CHART_HEIGHT = 330;
const INDICATOR_PANEL_HEIGHT = 130;
const TOOL_RAIL_WIDTH = 40;

const DRAWING_TOOLS = [
  { id: "trendline", label: "추세선" },
  {
    id: "fibonacci",
    label: "피보나치",
    children: ["채널", "되돌림", "확장", "스피드팬"],
  },
  {
    id: "gann",
    label: "간트",
    children: ["팬", "박스", "스퀘어"],
  },
  {
    id: "pitchfork",
    label: "쇠스랑",
    children: ["기본", "수정", "쉬프", "내부"],
  },
] as const;

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

function nearestCandleIndexByTs(candles: CandlestickData[], ts: number): number | null {
  if (candles.length === 0) return null;
  let nearestIndex = 0;
  let minDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < candles.length; i += 1) {
    const candleTs = toUnixTs(candles[i].time);
    if (candleTs === null) continue;
    const diff = Math.abs(candleTs - ts);
    if (diff < minDiff) {
      minDiff = diff;
      nearestIndex = i;
    }
  }
  return Number.isFinite(minDiff) ? nearestIndex : null;
}

function minDistanceToPolyline(points: ScreenPoint[], x: number, y: number): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = x - a.x;
    const wy = y - a.y;
    const c2 = vx * vx + vy * vy;
    if (c2 <= 0) continue;
    const t = Math.max(0, Math.min(1, (vx * wx + vy * wy) / c2));
    const px = a.x + t * vx;
    const py = a.y + t * vy;
    const distance = Math.hypot(x - px, y - py);
    if (distance < minDistance) minDistance = distance;
  }
  return minDistance;
}

function pointsToPath(points: ScreenPoint[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`;
}

function logicalToCoordinateSafe(chart: IChartApi, logicalIndex: number): number | null {
  const timeScale = chart.timeScale() as unknown as { logicalToCoordinate?: (logical: number) => number | null };
  if (!timeScale.logicalToCoordinate) return null;
  const value = timeScale.logicalToCoordinate(logicalIndex);
  return value === null || !Number.isFinite(value) ? null : value;
}

function coordinateToLogicalSafe(chart: IChartApi, x: number): number | null {
  const timeScale = chart.timeScale() as unknown as { coordinateToLogical?: (x: number) => number | null };
  if (!timeScale.coordinateToLogical) return null;
  const value = timeScale.coordinateToLogical(x);
  return value === null || !Number.isFinite(value) ? null : value;
}

function estimateBarIntervalSec(candles: CandlestickData[]): number {
  if (candles.length < 2) return 60 * 15;
  const diffs: number[] = [];
  for (let i = Math.max(1, candles.length - 20); i < candles.length; i += 1) {
    const prev = toUnixTs(candles[i - 1]?.time);
    const curr = toUnixTs(candles[i]?.time);
    if (prev === null || curr === null) continue;
    const diff = curr - prev;
    if (diff > 0 && Number.isFinite(diff)) diffs.push(diff);
  }
  if (diffs.length === 0) return 60 * 15;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] ?? 60 * 15;
}

function inferTsFromCoordinate(chart: IChartApi, candles: CandlestickData[], x: number): number | null {
  const direct = toUnixTs(chart.timeScale().coordinateToTime(x));
  if (direct !== null) return direct;
  if (candles.length === 0) return null;

  let logical = coordinateToLogicalSafe(chart, x);
  if (logical === null && candles.length >= 2) {
    const lastIndex = candles.length - 1;
    const prevIndex = candles.length - 2;
    const lastX = chart.timeScale().timeToCoordinate(candles[lastIndex]?.time);
    const prevX = chart.timeScale().timeToCoordinate(candles[prevIndex]?.time);
    if (lastX !== null && prevX !== null) {
      const spacing = lastX - prevX;
      if (Number.isFinite(spacing) && Math.abs(spacing) > 0.0001) {
        logical = lastIndex + (x - lastX) / spacing;
      }
    }
  }
  if (logical === null) return null;

  const lastIndex = candles.length - 1;
  const lastTs = toUnixTs(candles[lastIndex]?.time);
  if (lastTs === null) return null;

  const intervalSec = estimateBarIntervalSec(candles);
  const deltaBars = Math.round(logical - lastIndex);
  return Math.floor(lastTs + deltaBars * intervalSec);
}

function tsToLogicalIndex(candles: CandlestickData[], ts: number): number | null {
  if (candles.length === 0 || !Number.isFinite(ts)) return null;
  const lastIndex = candles.length - 1;
  const lastTs = toUnixTs(candles[lastIndex]?.time);
  if (lastTs === null) return null;
  const intervalSec = estimateBarIntervalSec(candles);
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) return null;
  return lastIndex + (ts - lastTs) / intervalSec;
}

function pointTsToXCoordinate(chart: IChartApi, candles: CandlestickData[], ts: number): number | null {
  const logical = tsToLogicalIndex(candles, ts);
  if (logical === null) return null;
  return logicalToCoordinateSafe(chart, logical);
}

function renderToolIcon(toolId: string) {
  if (toolId === "trendline") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 12L14 4" />
        <circle cx="2.5" cy="12" r="1.2" />
        <circle cx="13.5" cy="4" r="1.2" />
      </svg>
    );
  }
  if (toolId === "fibonacci") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 3.5H14M2 6.5H14M2 9.5H14M2 12.5H14" />
      </svg>
    );
  }
  if (toolId === "gann") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 13L13 2M2 13H13M13 2V13" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M2 13L5.5 3L8 10L10.5 6L14 13" />
    </svg>
  );
}

function toDrawingToolKind(selectedTool: string): DrawingToolKind | null {
  if (selectedTool === "trendline") return "trendline";
  if (selectedTool.startsWith("fibonacci")) return "fibonacci";
  if (selectedTool.startsWith("gann")) return "gann";
  if (selectedTool.startsWith("pitchfork")) return "pitchfork";
  return null;
}

function drawingColor(tool: DrawingToolKind): string {
  if (tool === "fibonacci") return "#38bdf8";
  if (tool === "gann") return "#f59e0b";
  if (tool === "pitchfork") return "#a78bfa";
  return "#22c55e";
}

export function BitcoinChart({
  enableDrawingTools = false,
  overlays = [],
  onPricePick,
  onPointPick,
  onHoverPointChange,
  onFibonacciPointDrag,
  onFibonacciChannelPointDrag,
  onFibonacciChannelMove,
  fibonacciCircleOverlay,
  fibonacciChannelOverlay,
  onFibonacciOverlayClick,
  overlaySelectionEnabled = true,
  showFibonacciActions = false,
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
  const onHoverPointChangeRef = useRef<((point: ChartPickedPoint | null) => void) | undefined>(onHoverPointChange);
  const onFibonacciPointDragRef = useRef<((target: "center" | "edge", point: ChartPickedPoint) => void) | undefined>(
    onFibonacciPointDrag,
  );
  const onFibonacciChannelPointDragRef = useRef<
    ((target: "start" | "end", point: ChartPickedPoint) => void) | undefined
  >(onFibonacciChannelPointDrag);
  const onFibonacciChannelMoveRef = useRef<((next: { start: ChartPickedPoint; end: ChartPickedPoint }) => void) | undefined>(
    onFibonacciChannelMove,
  );
  const onFibonacciOverlayClickRef = useRef<(() => void) | undefined>(onFibonacciOverlayClick);
  const overlaySelectionEnabledRef = useRef<boolean>(overlaySelectionEnabled);
  const fibonacciCircleRef = useRef<FibonacciCircleOverlay | undefined>(fibonacciCircleOverlay);
  const fibonacciChannelRef = useRef<FibonacciChannelOverlay | undefined>(fibonacciChannelOverlay);
  const fibSyncRafRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSvgMarkupRef = useRef<string>("");
  const lastPickAtRef = useRef<number>(0);
  const lastFibDragAtRef = useRef<number>(0);
  const fibDragTargetRef = useRef<
    "center" | "edge" | "channel-start" | "channel-end" | "channel-move" | "drawing-start" | "drawing-end" | null
  >(null);
  const fibDragMovedRef = useRef<boolean>(false);
  const channelMoveSessionRef = useRef<
    | {
        start: ChartPickedPoint;
        end: ChartPickedPoint;
        startIndex: number;
        endIndex: number;
        grabIndex: number;
        grabPrice: number;
      }
    | null
  >(null);
  const destroyedRef = useRef(false);
  const [status, setStatus] = useState("Python WS 연결 대기 중...");
  const [candleSummary, setCandleSummary] = useState<CandleSummary | null>(null);
  const [fixedLayoutWidth, setFixedLayoutWidth] = useState<number | null>(null);
  const [indicatorValues, setIndicatorValues] = useState<number[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");
  const [openToolMenu, setOpenToolMenu] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<"none" | "ad">("ad");
  const [userDrawings, setUserDrawings] = useState<UserLineDrawing[]>([]);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [selectedToolFibonacci, setSelectedToolFibonacci] = useState(false);
  const [pendingDrawingStart, setPendingDrawingStart] = useState<ChartPickedPoint | null>(null);
  const [pendingDrawingHover, setPendingDrawingHover] = useState<ChartPickedPoint | null>(null);
  const [toolFibonacciOverlay, setToolFibonacciOverlay] = useState<FibonacciChannelOverlay | undefined>(undefined);
  const activeToolKind = enableDrawingTools ? toDrawingToolKind(selectedTool) : null;
  const effectiveFibonacciChannelOverlay = toolFibonacciOverlay ?? fibonacciChannelOverlay;
  const activeToolKindRef = useRef<DrawingToolKind | null>(activeToolKind);
  const selectedToolRef = useRef<string>(selectedTool);
  const userDrawingsRef = useRef<UserLineDrawing[]>(userDrawings);
  const selectedDrawingIdRef = useRef<string | null>(selectedDrawingId);
  const drawingGeometriesRef = useRef<UserDrawingScreenGeometry[]>([]);
  const drawingDragIdRef = useRef<string | null>(null);
  const pendingDrawingStartRef = useRef<ChartPickedPoint | null>(pendingDrawingStart);
  const pendingDrawingHoverRef = useRef<ChartPickedPoint | null>(pendingDrawingHover);

  useEffect(() => {
    setPendingDrawingStart(null);
    setPendingDrawingHover(null);
    if (selectedTool !== "") {
      setSelectedToolFibonacci(false);
    }
  }, [selectedTool]);

  useEffect(() => {
    activeToolKindRef.current = activeToolKind;
  }, [activeToolKind]);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    userDrawingsRef.current = userDrawings;
  }, [userDrawings]);

  useEffect(() => {
    selectedDrawingIdRef.current = selectedDrawingId;
  }, [selectedDrawingId]);

  useEffect(() => {
    pendingDrawingStartRef.current = pendingDrawingStart;
  }, [pendingDrawingStart]);

  useEffect(() => {
    pendingDrawingHoverRef.current = pendingDrawingHover;
  }, [pendingDrawingHover]);

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

  const computeFibonacciScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciCircleRef.current;
    const candles = candlesRef.current;
    if (!chart || !series || !overlay?.center || !overlay?.edge) return null;
    if (overlay.center.ts === null || overlay.edge.ts === null) return null;
    if (candles.length < 2) return null;

    const center = overlay.center;
    const edge = overlay.edge;
    const centerTs = center.ts;
    const edgeTs = edge.ts;
    if (centerTs === null || edgeTs === null) return null;
    const centerIndex = nearestCandleIndexByTs(candles, centerTs);
    const edgeIndex = nearestCandleIndexByTs(candles, edgeTs);
    if (centerIndex === null || edgeIndex === null) return null;

    const centerTime = candles[centerIndex]?.time;
    const edgeTime = candles[edgeIndex]?.time;
    if (!centerTime || !edgeTime) return null;

    const cx = chart.timeScale().timeToCoordinate(centerTime);
    const cy = series.priceToCoordinate(center.price);
    const ex = chart.timeScale().timeToCoordinate(edgeTime);
    const ey = series.priceToCoordinate(edge.price);
    if (cx === null || cy === null || ex === null || ey === null) return null;

    const baseDx = edgeIndex - centerIndex;
    const baseDy = edge.price - center.price;
    if (!Number.isFinite(baseDx) || !Number.isFinite(baseDy)) return null;
    if (Math.abs(baseDx) < 1 || Math.abs(baseDy) < 1e-9) return null;

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0)
        : FIB_CIRCLE_DEFAULT_RATIOS;
    if (ratios.length === 0) return null;

    const absBaseDx = Math.abs(baseDx);
    const absBaseDy = Math.abs(baseDy);
    const rings = ratios
      .map((ratio, index) => {
        const minIndex = Math.max(0, Math.ceil(centerIndex - absBaseDx * ratio));
        const maxIndex = Math.min(candles.length - 1, Math.floor(centerIndex + absBaseDx * ratio));
        if (maxIndex - minIndex < 1) return null;

        const upper: ScreenPoint[] = [];
        const lower: ScreenPoint[] = [];
        for (let i = minIndex; i <= maxIndex; i += 1) {
          const normX = (i - centerIndex) / baseDx;
          const inside = ratio * ratio - normX * normX;
          if (inside < 0) continue;
          const yOffset = absBaseDy * Math.sqrt(inside);
          const x = chart.timeScale().timeToCoordinate(candles[i].time);
          if (x === null) continue;
          const upperY = series.priceToCoordinate(center.price + yOffset);
          const lowerY = series.priceToCoordinate(center.price - yOffset);
          if (upperY === null || lowerY === null) continue;
          upper.push({ x, y: upperY });
          lower.push({ x, y: lowerY });
        }

        if (upper.length < 2 || lower.length < 2) return null;
        const ringPoints = [...upper, ...lower.reverse(), upper[0]];
        const strokeOpacity = Math.max(0.2, 0.85 - index * 0.08);
        return {
          points: ringPoints,
          path: pointsToPath(ringPoints),
          strokeOpacity,
        };
      })
      .filter((ring): ring is { points: ScreenPoint[]; path: string; strokeOpacity: number } => ring !== null);

    if (rings.length === 0) return null;
    return { cx, cy, ex, ey, rings };
  }, []);

  const computeFibonacciChannelScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciChannelRef.current;
    const candles = candlesRef.current;
    if (!chart || !series || !overlay?.start) return null;
    if (candles.length < 2) return null;

    const start = overlay.start;
    const end = overlay.end ?? overlay.previewEnd;
    if (!end) {
      const startIndexOnly = start.ts === null ? null : nearestCandleIndexByTs(candles, start.ts);
      if (startIndexOnly === null) return null;
      const startTimeOnly = candles[startIndexOnly]?.time;
      if (!startTimeOnly) return null;
      const sxOnly = chart.timeScale().timeToCoordinate(startTimeOnly);
      const syOnly = series.priceToCoordinate(start.price);
      if (sxOnly === null || syOnly === null) return null;
      return {
        sx: sxOnly,
        sy: syOnly,
        ex: null,
        ey: null,
        bands: [],
        extBands: [],
        leftX: sxOnly,
        rightX: sxOnly,
        extensionRightX: sxOnly,
        y0: syOnly,
        y1: syOnly,
        preview: true,
      };
    }

    const startTs = start.ts;
    const endTs = end.ts;
    if (startTs === null || endTs === null) return null;
    const startLogical = tsToLogicalIndex(candles, startTs);
    const endLogical = tsToLogicalIndex(candles, endTs);
    if (startLogical === null || endLogical === null) return null;
    if (Math.abs(startLogical - endLogical) < 1e-6) return null;

    const sx = logicalToCoordinateSafe(chart, startLogical);
    const sy = series.priceToCoordinate(start.price);
    const ex = logicalToCoordinateSafe(chart, endLogical);
    const ey = series.priceToCoordinate(end.price);
    if (sx === null || sy === null || ex === null || ey === null) return null;

    const leftLogical = Math.min(startLogical, endLogical);
    const rightLogical = Math.max(startLogical, endLogical);
    const leftX = logicalToCoordinateSafe(chart, leftLogical);
    const rightX = logicalToCoordinateSafe(chart, rightLogical);
    if (leftX === null || rightX === null) return null;
    const projectedRightX = logicalToCoordinateSafe(
      chart,
      Math.max(rightLogical, candles.length - 1) + FIB_CHANNEL_FORWARD_BARS,
    ) ?? rightX;
    const extensionRightX = Math.max(rightX, projectedRightX);

    const price0 = start.price;
    const price1 = end.price;
    if (!Number.isFinite(price0) || !Number.isFinite(price1)) return null;
    const baseHeight = Math.abs(price1 - price0);

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio >= 0)
        : FIB_CHANNEL_DEFAULT_RATIOS;
    if (ratios.length === 0) return null;

    const bands = ratios
      .map((ratio, idx) => {
        // ratio 0 ~ 1 levels are split between start/end prices.
        const yPrice = price0 + (price1 - price0) * ratio;
        const y = series.priceToCoordinate(yPrice);
        if (y === null) return null;
        const line: ScreenPoint[] = [
          { x: leftX, y },
          { x: rightX, y },
        ];
        const extension: ScreenPoint[] =
          extensionRightX > rightX + 1
            ? [
                { x: rightX, y },
                { x: extensionRightX, y },
              ]
            : [];

        return {
          ratio,
          points: line,
          extensionPoints: extension,
          path: pointsToPath(line),
          extensionPath: pointsToPath(extension),
          strokeOpacity: Math.max(0.2, 0.9 - idx * 0.08),
        };
      })
      .filter(
        (
          band,
        ): band is {
          ratio: number;
          points: ScreenPoint[];
          extensionPoints: ScreenPoint[];
          path: string;
          extensionPath: string;
          strokeOpacity: number;
        } => band !== null,
      );

    if (bands.length === 0) return null;

    const y0 = series.priceToCoordinate(price0);
    const y1 = series.priceToCoordinate(price1);
    if (y0 === null || y1 === null) return null;

    const topPrice = Math.max(price0, price1);
    const extBands =
      baseHeight > 0
        ? FIB_CHANNEL_DEFAULT_EXT_RATIOS.map((ratio, idx) => {
            const yPrice = topPrice + baseHeight * ratio;
            const y = series.priceToCoordinate(yPrice);
            if (y === null) return null;
            const line: ScreenPoint[] = [
              { x: leftX, y },
              { x: rightX, y },
            ];
            const extension: ScreenPoint[] =
              extensionRightX > rightX + 1
                ? [
                    { x: rightX, y },
                    { x: extensionRightX, y },
                  ]
                : [];
            return {
              ratio,
              points: line,
              extensionPoints: extension,
              path: pointsToPath(line),
              extensionPath: pointsToPath(extension),
              strokeOpacity: Math.max(0.2, 0.75 - idx * 0.08),
            };
          }).filter(
            (
              band,
            ): band is {
              ratio: number;
              points: ScreenPoint[];
              extensionPoints: ScreenPoint[];
              path: string;
              extensionPath: string;
              strokeOpacity: number;
            } => band !== null,
          )
        : [];

    return {
      sx,
      sy,
      ex,
      ey,
      bands,
      extBands,
      leftX,
      rightX,
      extensionRightX,
      y0,
      y1,
      leftBorderPath: pointsToPath([
        { x: leftX, y: y0 },
        { x: leftX, y: y1 },
      ]),
      rightBorderPath: pointsToPath([
        { x: rightX, y: y0 },
        { x: rightX, y: y1 },
      ]),
      preview: overlay.end ? false : true,
    };
  }, []);

  const syncFibonacciOverlay = useCallback(() => {
    const svg = svgOverlayRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    // Exclude right price-scale strip so overlay stays inside the plot area.
    const priceScaleReserved = 56;
    const width = Math.max(0, container.clientWidth - priceScaleReserved);
    // Exclude bottom time-scale strip so overlay stays inside the plot area.
    const timeScaleReserved = 26;
    const height = Math.max(0, container.clientHeight - timeScaleReserved);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const circleGeometry = computeFibonacciScreenGeometry();
    const channelGeometry = computeFibonacciChannelScreenGeometry();

    const circlePaths = circleGeometry
      ? circleGeometry.rings
          .map((ring) => {
            return `<path data-fib-overlay="true" d="${ring.path}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-opacity="${ring.strokeOpacity}" pointer-events="visibleStroke" />`;
          })
          .join("")
      : "";

    const circleControls = circleGeometry
      ? `
      <circle data-fib-overlay="true" cx="${circleGeometry.cx}" cy="${circleGeometry.cy}" r="4" fill="#22c55e" pointer-events="visibleFill" />
      <circle data-fib-overlay="true" cx="${circleGeometry.ex}" cy="${circleGeometry.ey}" r="4" fill="#f97316" pointer-events="visibleFill" />
      <line data-fib-overlay="true" x1="${circleGeometry.cx}" y1="${circleGeometry.cy}" x2="${circleGeometry.ex}" y2="${circleGeometry.ey}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" pointer-events="visibleStroke" />
    `
      : "";

    const channelPaths = channelGeometry
      ? channelGeometry.bands
          .map((band) => {
            const isBoundary = Math.abs(band.ratio) < 1e-9 || Math.abs(band.ratio - 1.0) < 1e-9;
            const color = isBoundary ? "#f8fafc" : "#38bdf8";
            const widthStroke = isBoundary ? 1.8 : 1.2;
            const dash = isBoundary ? "" : ' stroke-dasharray="6 4"';
            const extension = band.extensionPath
              ? `<path d="${band.extensionPath}" fill="none" stroke="${color}" stroke-width="${Math.max(
                  1,
                  widthStroke - 0.2,
                )}" stroke-opacity="${Math.max(0.18, band.strokeOpacity - 0.15)}"${dash} />`
              : "";
            return `<path d="${band.path}" fill="none" stroke="${color}" stroke-width="${widthStroke}" stroke-opacity="${band.strokeOpacity}"${dash} />${extension}`;
          })
          .join("")
      : "";

    const channelExtPaths = channelGeometry
      ? channelGeometry.extBands
          .map((band) => {
            const dash = channelGeometry.preview ? ' stroke-dasharray="4 4"' : ' stroke-dasharray="6 4"';
            const extension = band.extensionPath
              ? `<path d="${band.extensionPath}" fill="none" stroke="#f97316" stroke-width="1" stroke-opacity="${Math.max(
                  0.16,
                  band.strokeOpacity - 0.15,
                )}" stroke-dasharray="6 4" />`
              : "";
            return `<path d="${band.path}" fill="none" stroke="#f97316" stroke-width="1.1" stroke-opacity="${band.strokeOpacity}"${dash} />${extension}`;
          })
          .join("")
      : "";

    const channelControls = channelGeometry
      ? `
      <circle cx="${channelGeometry.sx}" cy="${channelGeometry.sy}" r="4" fill="#22c55e" />
      ${
        channelGeometry.ex !== null && channelGeometry.ey !== null
          ? `<circle cx="${channelGeometry.ex}" cy="${channelGeometry.ey}" r="4" fill="#f97316" />
      <line x1="${channelGeometry.sx}" y1="${channelGeometry.sy}" x2="${channelGeometry.ex}" y2="${channelGeometry.ey}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" />`
          : ""
      }
    `
        : "";

    const chart = chartRef.current;
    const series = seriesRef.current;
    const candles = candlesRef.current;
    const currentDrawings = userDrawingsRef.current;
    const currentPendingStart = pendingDrawingStartRef.current;
    const currentPendingHover = pendingDrawingHoverRef.current;
    const currentToolKind = activeToolKindRef.current;

    const selectedId = selectedDrawingIdRef.current;
    const drawingGeometries: UserDrawingScreenGeometry[] = [];
    const linePaths =
      chart && series
        ? currentDrawings
            .map((drawing) => {
              if (drawing.start.ts === null || drawing.end.ts === null) return "";
              const sx = pointTsToXCoordinate(chart, candles, drawing.start.ts);
              const ex = pointTsToXCoordinate(chart, candles, drawing.end.ts);
              const sy = series.priceToCoordinate(drawing.start.price);
              const ey = series.priceToCoordinate(drawing.end.price);
              if (sx === null || ex === null || sy === null || ey === null) return "";
              drawingGeometries.push({
                id: drawing.id,
                start: { x: sx, y: sy },
                end: { x: ex, y: ey },
                line: [
                  { x: sx, y: sy },
                  { x: ex, y: ey },
                ],
              });
              const isSelected = selectedId === drawing.id;
              const baseStroke = drawingColor(drawing.tool);
              const baseWidth = isSelected ? 2.2 : 1.5;
              if (drawing.variant.startsWith("gann")) {
                return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${baseStroke}" stroke-width="${baseWidth}" stroke-opacity="${isSelected ? 1 : 0.9}" stroke-dasharray="6 4" />`;
              }
              if (drawing.variant.startsWith("pitchfork")) {
                const dx = ex - sx;
                const dy = ey - sy;
                const len = Math.hypot(dx, dy) || 1;
                const nx = (-dy / len) * 12;
                const ny = (dx / len) * 12;
                return `
                  <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${baseStroke}" stroke-width="${baseWidth}" stroke-opacity="${isSelected ? 1 : 0.9}" />
                  <line x1="${sx + nx}" y1="${sy + ny}" x2="${ex + nx}" y2="${ey + ny}" stroke="${baseStroke}" stroke-width="1.1" stroke-opacity="0.75" />
                  <line x1="${sx - nx}" y1="${sy - ny}" x2="${ex - nx}" y2="${ey - ny}" stroke="${baseStroke}" stroke-width="1.1" stroke-opacity="0.75" />
                `;
              }
              return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${baseStroke}" stroke-width="${baseWidth}" stroke-opacity="${isSelected ? 1 : 0.9}" />`;
            })
            .join("")
        : "";

    drawingGeometriesRef.current = drawingGeometries;

    const selectedDrawingHandles =
      selectedId && drawingGeometries.length > 0
        ? (() => {
            const geometry = drawingGeometries.find((item) => item.id === selectedId);
            if (!geometry) return "";
            return `
              <circle cx="${geometry.start.x}" cy="${geometry.start.y}" r="4.5" fill="#f8fafc" stroke="#0ea5e9" stroke-width="1.2" />
              <circle cx="${geometry.end.x}" cy="${geometry.end.y}" r="4.5" fill="#f8fafc" stroke="#0ea5e9" stroke-width="1.2" />
            `;
          })()
        : "";

    const pendingLinePath =
      chart &&
      series &&
      currentPendingStart &&
      currentPendingHover &&
      currentToolKind &&
      currentToolKind !== "fibonacci"
        ? (() => {
            if (currentPendingStart.ts === null || currentPendingHover.ts === null) return "";
            const sx = pointTsToXCoordinate(chart, candles, currentPendingStart.ts);
            const ex = pointTsToXCoordinate(chart, candles, currentPendingHover.ts);
            const sy = series.priceToCoordinate(currentPendingStart.price);
            const ey = series.priceToCoordinate(currentPendingHover.price);
            if (sx === null || ex === null || sy === null || ey === null) return "";
            return `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${drawingColor(currentToolKind)}" stroke-width="1.4" stroke-opacity="0.7" stroke-dasharray="5 4" />`;
          })()
        : "";

    const hasAnyOverlay =
      Boolean(circleGeometry) ||
      Boolean(channelGeometry) ||
      Boolean(linePaths) ||
      Boolean(pendingLinePath);
    if (!hasAnyOverlay) {
      if (lastSvgMarkupRef.current !== "") {
        svg.innerHTML = "";
        lastSvgMarkupRef.current = "";
      }
      return;
    }

    const nextMarkup = `
      ${channelPaths}
      ${channelExtPaths}
      ${linePaths}
      ${selectedDrawingHandles}
      ${pendingLinePath}
      ${circlePaths}
      ${channelControls}
      ${circleControls}
    `;
    if (nextMarkup === lastSvgMarkupRef.current) return;
    svg.innerHTML = nextMarkup;
    lastSvgMarkupRef.current = nextMarkup;
  }, [computeFibonacciChannelScreenGeometry, computeFibonacciScreenGeometry]);

  const requestFibonacciSync = useCallback(() => {
    if (fibSyncRafRef.current !== null) return;
    fibSyncRafRef.current = window.requestAnimationFrame(() => {
      fibSyncRafRef.current = null;
      syncFibonacciOverlay();
    });
  }, [syncFibonacciOverlay]);

  const getFibonacciControlPoints = useCallback(() => {
    const geometry = computeFibonacciScreenGeometry();
    if (!geometry) return null;
    return { cx: geometry.cx, cy: geometry.cy, ex: geometry.ex, ey: geometry.ey };
  }, [computeFibonacciScreenGeometry]);

  const getFibonacciChannelControlPoints = useCallback(() => {
    const geometry = computeFibonacciChannelScreenGeometry();
    if (!geometry || geometry.ex === null || geometry.ey === null) return null;
    return { sx: geometry.sx, sy: geometry.sy, ex: geometry.ex, ey: geometry.ey };
  }, [computeFibonacciChannelScreenGeometry]);

  const pickFibonacciHandle = useCallback((x: number, y: number): "center" | "edge" | null => {
    const control = getFibonacciControlPoints();
    if (!control) return null;

    const dCenter = Math.hypot(x - control.cx, y - control.cy);
    const dEdge = Math.hypot(x - control.ex, y - control.ey);
    const hitRadius = 10;
    if (dCenter > hitRadius && dEdge > hitRadius) return null;
    return dCenter <= dEdge ? "center" : "edge";
  }, [getFibonacciControlPoints]);

  const pickFibonacciChannelHandle = useCallback((x: number, y: number): "start" | "end" | null => {
    const control = getFibonacciChannelControlPoints();
    if (!control) return null;
    const dStart = Math.hypot(x - control.sx, y - control.sy);
    const dEnd = Math.hypot(x - control.ex, y - control.ey);
    const hitRadius = 10;
    if (dStart > hitRadius && dEnd > hitRadius) return null;
    return dStart <= dEnd ? "start" : "end";
  }, [getFibonacciChannelControlPoints]);

  const toPickedPointFromCoordinate = useCallback((x: number, y: number): ChartPickedPoint | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return null;

    const price = series.coordinateToPrice(y);
    const ts = inferTsFromCoordinate(chart, candlesRef.current, x);
    if (price === null || !Number.isFinite(price) || ts === null) return null;

    return { price: rounded(price), ts };
  }, []);

  const setChartInteractionEnabled = useCallback((enabled: boolean) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions({
      handleScroll: enabled,
      handleScale: enabled,
    });
  }, []);

  const hitTestFibonacciOverlay = useCallback((x: number, y: number) => {
    const geometry = computeFibonacciScreenGeometry();
    if (!geometry) return false;
    const { cx, cy, ex, ey } = geometry;

    const dCenter = Math.hypot(x - cx, y - cy);
    const dEdge = Math.hypot(x - ex, y - ey);
    if (dCenter <= 8 || dEdge <= 8) return true;
    const ringHit = geometry.rings.some((ring) => minDistanceToPolyline(ring.points, x, y) <= 6);
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
  }, [computeFibonacciScreenGeometry]);

  const hitTestFibonacciChannelOverlay = useCallback((x: number, y: number) => {
    const geometry = computeFibonacciChannelScreenGeometry();
    if (!geometry) return false;
    const handle = pickFibonacciChannelHandle(x, y);
    if (handle) return true;

    const xMin = Math.min(geometry.leftX, geometry.rightX);
    const xMax = Math.max(geometry.leftX, geometry.rightX);
    const yMin = Math.min(geometry.y0, geometry.y1);
    const yMax = Math.max(geometry.y0, geometry.y1);
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) return true;

    const anyBandHit = [...geometry.bands, ...geometry.extBands].some(
      (band) =>
        minDistanceToPolyline(band.points, x, y) <= 6 ||
        (band.extensionPoints.length > 1 && minDistanceToPolyline(band.extensionPoints, x, y) <= 6),
    );
    if (anyBandHit) return true;

    const leftHit = minDistanceToPolyline(
      [
        { x: geometry.leftX, y: geometry.y0 },
        { x: geometry.leftX, y: geometry.y1 },
      ],
      x,
      y,
    );
    const rightHit = minDistanceToPolyline(
      [
        { x: geometry.rightX, y: geometry.y0 },
        { x: geometry.rightX, y: geometry.y1 },
      ],
      x,
      y,
    );
    return leftHit <= 6 || rightHit <= 6;
  }, [computeFibonacciChannelScreenGeometry, pickFibonacciChannelHandle]);

  const computeMovedChannelPoints = useCallback(
    (x: number, y: number): { start: ChartPickedPoint; end: ChartPickedPoint } | null => {
      const session = channelMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = toUnixTs(chart.timeScale().coordinateToTime(x));
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;
      const currentIndex = nearestCandleIndexByTs(candles, currentTs);
      if (currentIndex === null) return null;

      const minDelta = -Math.min(session.startIndex, session.endIndex);
      const maxDelta = candles.length - 1 - Math.max(session.startIndex, session.endIndex);
      const rawDeltaIndex = currentIndex - session.grabIndex;
      const deltaIndex = Math.max(minDelta, Math.min(maxDelta, rawDeltaIndex));
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      const nextStartIndex = session.startIndex + deltaIndex;
      const nextEndIndex = session.endIndex + deltaIndex;
      const startTs = toUnixTs(candles[nextStartIndex]?.time);
      const endTs = toUnixTs(candles[nextEndIndex]?.time);
      if (startTs === null || endTs === null) return null;

      return {
        start: {
          ts: startTs,
          price: rounded(session.start.price + deltaPrice),
        },
        end: {
          ts: endTs,
          price: rounded(session.end.price + deltaPrice),
        },
      };
    },
    [],
  );

  const applyChannelPointUpdate = useCallback(
    (target: "start" | "end", point: ChartPickedPoint) => {
      if (onFibonacciChannelPointDragRef.current) {
        onFibonacciChannelPointDragRef.current(target, point);
        return;
      }
      setToolFibonacciOverlay((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [target]: point,
          previewEnd: undefined,
        };
      });
    },
    [],
  );

  const applyChannelMoveUpdate = useCallback((next: { start: ChartPickedPoint; end: ChartPickedPoint }) => {
    if (onFibonacciChannelMoveRef.current) {
      onFibonacciChannelMoveRef.current(next);
      return;
    }
    setToolFibonacciOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        start: next.start,
        end: next.end,
        previewEnd: undefined,
      };
    });
  }, []);

  const pickUserDrawingHit = useCallback((x: number, y: number): { id: string; target: "start" | "end" | "line" } | null => {
    const geometries = drawingGeometriesRef.current;
    const selectedId = selectedDrawingIdRef.current;
    if (geometries.length === 0) return null;

    const ordered = selectedId
      ? [...geometries].sort((a, b) => (a.id === selectedId ? -1 : b.id === selectedId ? 1 : 0))
      : geometries;

    for (const geometry of ordered) {
      const dStart = Math.hypot(x - geometry.start.x, y - geometry.start.y);
      if (dStart <= 9) return { id: geometry.id, target: "start" };
      const dEnd = Math.hypot(x - geometry.end.x, y - geometry.end.y);
      if (dEnd <= 9) return { id: geometry.id, target: "end" };
    }

    for (const geometry of ordered) {
      if (minDistanceToPolyline(geometry.line, x, y) <= 6) {
        return { id: geometry.id, target: "line" };
      }
    }

    return null;
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
      height: MAIN_CHART_HEIGHT,
      layout: { background: { color: "#0b1220" }, textColor: "#94a3b8" },
      grid: { vertLines: { color: "#1e293b" }, horzLines: { color: "#1e293b" } },
      timeScale: { borderColor: "#334155", rightOffset: 40 },
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
    setIndicatorValues(fallbackData.map((item) => Math.abs(Number(item.close) - Number(item.open))));
    syncLineOverlays();
    requestFibonacciSync();

    const lastFallback = fallbackData[fallbackData.length - 1];
    setCandleSummary({
      open: Number(lastFallback.open),
      high: Number(lastFallback.high),
      low: Number(lastFallback.low),
      close: Number(lastFallback.close),
    });

    const handleCrosshairMove = (param: { seriesData: Map<unknown, unknown>; point?: { x: number; y: number }; time?: unknown }) => {
      const hovered = Array.from(param.seriesData.values())
        .map((value) => asCandleSummary(value))
        .find((value): value is CandleSummary => value !== null);
      if (hovered) {
        setCandleSummary(hovered);
      }

      const activeSeries = seriesRef.current;
      if (!activeSeries || !param.point) {
        onHoverPointChangeRef.current?.(null);
        return;
      }

      const hoveredPrice = activeSeries.coordinateToPrice(param.point.y);
      const hoveredTs =
        toUnixTs(param.time) ??
        (param.point ? inferTsFromCoordinate(chart, candlesRef.current, param.point.x) : null);
      if (hoveredPrice === null || !Number.isFinite(hoveredPrice) || hoveredTs === null) {
        onHoverPointChangeRef.current?.(null);
        return;
      }

      onHoverPointChangeRef.current?.({
        price: rounded(hoveredPrice),
        ts: hoveredTs,
      });

      const currentToolKind = activeToolKindRef.current;
      const currentPendingStart = pendingDrawingStartRef.current;
      if (currentToolKind && currentPendingStart) {
        const hoveredPoint: ChartPickedPoint = {
          price: rounded(hoveredPrice),
          ts: hoveredTs,
        };
        setPendingDrawingHover(hoveredPoint);
        if (currentToolKind === "fibonacci") {
          setToolFibonacciOverlay({
            start: currentPendingStart,
            end: undefined,
            previewEnd: hoveredPoint,
            ratios: FIB_CHANNEL_DEFAULT_RATIOS,
          });
        }
      } else {
        setPendingDrawingHover(null);
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const handleVisibleRangeChange = () => {
      requestFibonacciSync();
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const handleChartClick = (param: { point?: { x: number; y: number }; time?: unknown; seriesData: Map<unknown, unknown> }) => {
      if (Date.now() - lastFibDragAtRef.current < 120) return;
      const activeSeries = seriesRef.current;
      if (!activeSeries) return;

      const point = param.point;
      if (point) {
        const clickedPrice = activeSeries.coordinateToPrice(point.y);
        if (clickedPrice !== null && Number.isFinite(clickedPrice)) {
          const pickedPoint: ChartPickedPoint = {
            price: rounded(clickedPrice),
            ts: toUnixTs(param.time) ?? inferTsFromCoordinate(chart, candlesRef.current, point.x),
          };
          if (pickedPoint.ts === null) return;

          const currentToolKind = activeToolKindRef.current;
          const currentPendingStart = pendingDrawingStartRef.current;
          if (currentToolKind) {
            if (!currentPendingStart) {
              lastPickAtRef.current = Date.now();
              setPendingDrawingStart(pickedPoint);
              if (currentToolKind === "fibonacci") {
                setToolFibonacciOverlay({
                  start: pickedPoint,
                  end: undefined,
                  previewEnd: undefined,
                  ratios: FIB_CHANNEL_DEFAULT_RATIOS,
                });
              }
              return;
            }

            if (currentToolKind === "fibonacci") {
              lastPickAtRef.current = Date.now();
              setToolFibonacciOverlay({
                start: currentPendingStart,
                end: pickedPoint,
                previewEnd: undefined,
                ratios: FIB_CHANNEL_DEFAULT_RATIOS,
              });
              setSelectedToolFibonacci(true);
              setSelectedDrawingId(null);
              setPendingDrawingStart(null);
              setPendingDrawingHover(null);
              setSelectedTool("");
              setOpenToolMenu(null);
              return;
            }

            setUserDrawings((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${prev.length}`,
                tool: currentToolKind,
                variant: selectedToolRef.current || currentToolKind,
                start: currentPendingStart,
                end: pickedPoint,
              },
            ]);
            lastPickAtRef.current = Date.now();
            setPendingDrawingStart(null);
            setPendingDrawingHover(null);
            setSelectedTool("");
            setOpenToolMenu(null);
            return;
          }

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
          ts: param.point
            ? toUnixTs(param.time) ?? inferTsFromCoordinate(chart, candlesRef.current, param.point.x)
            : toUnixTs(param.time),
        };
        if (pickedPoint.ts === null) return;
        lastPickAtRef.current = Date.now();
        onPricePickRef.current?.(pickedPoint.price);
        onPointPickRef.current?.(pickedPoint);
      }
    };
    chart.subscribeClick(handleChartClick);

    const handleContainerClick = (event: MouseEvent) => {
      if (Date.now() - lastFibDragAtRef.current < 120) return;
      const activeSeries = seriesRef.current;
      if (!activeSeries) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hasToolFibo = Boolean(enableDrawingTools && toolFibonacciOverlay?.start && toolFibonacciOverlay?.end);
      if (hasToolFibo && hitTestFibonacciChannelOverlay(x, y)) {
        setSelectedToolFibonacci(true);
        setSelectedDrawingId(null);
        return;
      }
      if (selectedToolFibonacci) {
        setSelectedToolFibonacci(false);
      }

      if (overlaySelectionEnabledRef.current && hitTestFibonacciOverlay(x, y)) {
        onFibonacciOverlayClickRef.current?.();
        return;
      }

      const drawingHit = pickUserDrawingHit(x, y);
      if (drawingHit) {
        setSelectedDrawingId(drawingHit.id);
        setSelectedToolFibonacci(false);
        return;
      }
      if (selectedDrawingIdRef.current) {
        setSelectedDrawingId(null);
      }

      // Prevent duplicate point-pick processing when lightweight-charts click already fired.
      if (Date.now() - lastPickAtRef.current < 40) return;

      const pickedPrice = activeSeries.coordinateToPrice(y);
      if (pickedPrice !== null && Number.isFinite(pickedPrice)) {
        const pickedTs = inferTsFromCoordinate(chart, candlesRef.current, x);
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

    const handleContainerMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const drawingToolActive = Boolean(activeToolKindRef.current);
      const drawingPlacementInProgress = Boolean(pendingDrawingStartRef.current);

      const drawingHit = pickUserDrawingHit(x, y);
      if (drawingHit) {
        setSelectedDrawingId(drawingHit.id);
        setSelectedToolFibonacci(false);
        if (drawingHit.target === "start" || drawingHit.target === "end") {
          fibDragTargetRef.current = drawingHit.target === "start" ? "drawing-start" : "drawing-end";
          drawingDragIdRef.current = drawingHit.id;
          fibDragMovedRef.current = false;
          setChartInteractionEnabled(false);
          container.style.cursor = "grabbing";
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // While placing the second point, keep click flow for point placement only.
      // Allow overlay drag/edit in all other states.
      if (drawingToolActive && drawingPlacementInProgress) return;

      const fibTarget = pickFibonacciHandle(x, y);
      const channelTarget = pickFibonacciChannelHandle(x, y);
      const channelHit = hitTestFibonacciChannelOverlay(x, y);
      if (!fibTarget && !channelTarget && !channelHit) return;

      if (fibTarget) {
        fibDragTargetRef.current = fibTarget;
      } else if (channelTarget) {
        setSelectedToolFibonacci(true);
        setSelectedDrawingId(null);
        fibDragTargetRef.current = channelTarget === "start" ? "channel-start" : "channel-end";
      } else {
        const channel = fibonacciChannelRef.current;
        const candles = candlesRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!channel?.start || !channel?.end || !point || point.ts === null || candles.length === 0) return;
        const startTs = channel.start.ts;
        const endTs = channel.end.ts;
        if (startTs === null || endTs === null) return;
        const startIndex = nearestCandleIndexByTs(candles, startTs);
        const endIndex = nearestCandleIndexByTs(candles, endTs);
        const grabIndex = nearestCandleIndexByTs(candles, point.ts);
        if (startIndex === null || endIndex === null || grabIndex === null) return;
        channelMoveSessionRef.current = {
          start: channel.start,
          end: channel.end,
          startIndex,
          endIndex,
          grabIndex,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "channel-move";
      }

      fibDragMovedRef.current = false;
      setChartInteractionEnabled(false);
      container.style.cursor = "grabbing";
      event.preventDefault();
      event.stopPropagation();
    };

    const stopFibDrag = () => {
      if (!fibDragTargetRef.current) return;
      if (fibDragMovedRef.current) {
        lastFibDragAtRef.current = Date.now();
      }
      fibDragTargetRef.current = null;
      channelMoveSessionRef.current = null;
      drawingDragIdRef.current = null;
      fibDragMovedRef.current = false;
      setChartInteractionEnabled(true);
      container.style.cursor = "";
    };

    const handleContainerMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const activeTarget = fibDragTargetRef.current;
      if (activeTarget) {
        if (activeTarget === "channel-move") {
          const moved = computeMovedChannelPoints(x, y);
          if (!moved) return;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          applyChannelMoveUpdate(moved);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const point = toPickedPointFromCoordinate(x, y);
        if (!point) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        if (activeTarget === "drawing-start" || activeTarget === "drawing-end") {
          const drawingId = drawingDragIdRef.current;
          if (!drawingId) return;
          setUserDrawings((prev) =>
            prev.map((item) =>
              item.id === drawingId
                ? {
                    ...item,
                    [activeTarget === "drawing-start" ? "start" : "end"]: point,
                  }
                : item,
            ),
          );
        } else if (activeTarget === "center" || activeTarget === "edge") {
          onFibonacciPointDragRef.current?.(activeTarget, point);
        } else {
          const target = activeTarget === "channel-start" ? "start" : "end";
          applyChannelPointUpdate(target, point);
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      handleVisibleRangeChange();
      const hoverDrawingHit = pickUserDrawingHit(x, y);
      if (hoverDrawingHit) {
        container.style.cursor = hoverDrawingHit.target === "line" ? "pointer" : "grab";
        return;
      }
      const hoverFibTarget = pickFibonacciHandle(x, y);
      const hoverChannelTarget = pickFibonacciChannelHandle(x, y);
      if (hoverFibTarget || hoverChannelTarget) {
        container.style.cursor = "grab";
      } else if (hitTestFibonacciChannelOverlay(x, y)) {
        container.style.cursor = "move";
      } else {
        container.style.cursor = "";
      }
    };

    const handleContainerMouseUp = () => stopFibDrag();
    const handleWindowMouseMove = (event: MouseEvent) => {
      const activeTarget = fibDragTargetRef.current;
      if (!activeTarget) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (activeTarget === "channel-move") {
        const moved = computeMovedChannelPoints(x, y);
        if (!moved) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        applyChannelMoveUpdate(moved);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const point = toPickedPointFromCoordinate(x, y);
      if (!point) return;
      fibDragMovedRef.current = true;
      lastFibDragAtRef.current = Date.now();
      if (activeTarget === "drawing-start" || activeTarget === "drawing-end") {
        const drawingId = drawingDragIdRef.current;
        if (!drawingId) return;
        setUserDrawings((prev) =>
          prev.map((item) =>
            item.id === drawingId
              ? {
                  ...item,
                  [activeTarget === "drawing-start" ? "start" : "end"]: point,
                }
              : item,
          ),
        );
      } else if (activeTarget === "center" || activeTarget === "edge") {
        onFibonacciPointDragRef.current?.(activeTarget, point);
      } else {
        const target = activeTarget === "channel-start" ? "start" : "end";
        applyChannelPointUpdate(target, point);
      }
      event.preventDefault();
      event.stopPropagation();
    };
    const handleWindowMouseUp = () => stopFibDrag();

    container.addEventListener("mousedown", handleContainerMouseDown, { capture: true });
    container.addEventListener("mousemove", handleContainerMouseMove, { capture: true });
    container.addEventListener("mouseup", handleContainerMouseUp, { capture: true });
    window.addEventListener("mousemove", handleWindowMouseMove, { capture: true });
    window.addEventListener("mouseup", handleWindowMouseUp, { capture: true });

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
      requestFibonacciSync();
    });
    resizeObserver.observe(container);

    container.addEventListener("wheel", handleVisibleRangeChange, { passive: true });
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
      container.removeEventListener("mousedown", handleContainerMouseDown, { capture: true });
      container.removeEventListener("mousemove", handleContainerMouseMove, { capture: true });
      container.removeEventListener("mouseup", handleContainerMouseUp, { capture: true });
      window.removeEventListener("mousemove", handleWindowMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleWindowMouseUp, { capture: true });
      setChartInteractionEnabled(true);
      container.removeEventListener("wheel", handleVisibleRangeChange);
      container.removeEventListener("touchmove", handleVisibleRangeChange);
      if (fibSyncRafRef.current !== null) {
        window.cancelAnimationFrame(fibSyncRafRef.current);
        fibSyncRafRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [
    pickFibonacciHandle,
    pickFibonacciChannelHandle,
    requestFibonacciSync,
    setChartInteractionEnabled,
    syncLineOverlays,
    toPickedPointFromCoordinate,
    hitTestFibonacciOverlay,
    hitTestFibonacciChannelOverlay,
    computeMovedChannelPoints,
    pickUserDrawingHit,
  ]);

  useEffect(() => {
    const connect = () => {
      if (destroyedRef.current || !seriesRef.current) return;

      const ws = new WebSocket(getMarketWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(`Python WS 연결됨 ${new Date().toLocaleTimeString()}`);
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
              setIndicatorValues(candles.map((item) => Math.abs(Number(item.close) - Number(item.open))));
              const latest = asCandleSummary(candles[candles.length - 1]);
              if (latest) setCandleSummary(latest);
              syncLineOverlays();
              requestFibonacciSync();
            }
            setStatus(`실시간 수신 중 ${message.symbol} ${message.interval}m`);
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
            setIndicatorValues(candlesRef.current.map((item) => Math.abs(Number(item.close) - Number(item.open))));
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
        setStatus("연결 종료, 재연결 중...");
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
    onHoverPointChangeRef.current = onHoverPointChange;
  }, [onHoverPointChange]);

  useEffect(() => {
    onFibonacciPointDragRef.current = onFibonacciPointDrag;
  }, [onFibonacciPointDrag]);

  useEffect(() => {
    onFibonacciChannelPointDragRef.current = onFibonacciChannelPointDrag;
  }, [onFibonacciChannelPointDrag]);

  useEffect(() => {
    onFibonacciChannelMoveRef.current = onFibonacciChannelMove;
  }, [onFibonacciChannelMove]);

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

  useEffect(() => {
    fibonacciChannelRef.current = effectiveFibonacciChannelOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciChannelOverlay, requestFibonacciSync]);

  useEffect(() => {
    requestFibonacciSync();
  }, [
    activeToolKind,
    pendingDrawingHover,
    pendingDrawingStart,
    requestFibonacciSync,
    selectedDrawingId,
    toolFibonacciOverlay,
    userDrawings,
  ]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2">
        <div className="flex items-center gap-2">
          {enableDrawingTools ? (
            <>
              <span className="text-[11px] text-slate-400">Indicator</span>
              <select
                value={selectedIndicator}
                onChange={(event) => setSelectedIndicator(event.target.value as "none" | "ad")}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 outline-none"
              >
                <option value="none">없음</option>
                <option value="ad">AD (10)</option>
              </select>
            </>
          ) : (
            <span className="text-xs text-slate-300">비트코인 차트</span>
          )}
        </div>
        <span className="text-xs text-slate-400">{status}</span>
      </div>
      <div ref={viewportRef}>
        <div className="flex gap-2">
          {enableDrawingTools && (
            <aside
              className="flex shrink-0 flex-col items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 py-2"
              style={{ width: TOOL_RAIL_WIDTH }}
            >
            {DRAWING_TOOLS.map((tool) => {
              const isSelected = selectedTool === tool.id || selectedTool.startsWith(`${tool.id}:`);
              const hasChildren = "children" in tool;
              return (
                <div key={tool.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTool(tool.id);
                      if (!hasChildren) setOpenToolMenu(null);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded border text-[9px] ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 text-sky-100"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
                    }`}
                    title={tool.label}
                  >
                    {renderToolIcon(tool.id)}
                  </button>
                  <div className="pointer-events-none absolute left-9 top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded border border-slate-700 bg-slate-950/95 px-2 py-1 text-[10px] text-slate-200 group-hover:block">
                    {tool.label}
                  </div>
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => setOpenToolMenu((prev) => (prev === tool.id ? null : tool.id))}
                      className="absolute -right-2 top-1/2 hidden h-3 w-3 -translate-y-1/2 items-center justify-center rounded border border-slate-700 bg-slate-900 text-[8px] text-slate-300 group-hover:flex"
                    >
                      ▸
                    </button>
                  )}
                  {hasChildren && openToolMenu === tool.id && (
                    <div className="absolute left-9 top-0 z-30 min-w-[92px] rounded-md border border-slate-700 bg-slate-950/95 p-1 shadow-lg">
                      {tool.children.map((child) => (
                        <button
                          key={child}
                          type="button"
                          onClick={() => {
                            setSelectedTool(`${tool.id}:${child}`);
                            setOpenToolMenu(null);
                          }}
                          className="block w-full rounded px-2 py-1 text-left text-[10px] text-slate-200 hover:bg-slate-800/70"
                        >
                          {child}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            </aside>
          )}

          <div className="w-full space-y-2">
            <div
              className="relative overflow-hidden rounded-md border border-slate-800 bg-slate-950/50"
              style={fixedLayoutWidth ? { minWidth: `${fixedLayoutWidth}px` } : undefined}
            >
              {enableDrawingTools && (selectedDrawingId || selectedToolFibonacci) && (
                <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDrawingId) {
                        setUserDrawings((prev) => prev.filter((item) => item.id !== selectedDrawingId));
                        setSelectedDrawingId(null);
                      }
                      if (selectedToolFibonacci) {
                        setToolFibonacciOverlay(undefined);
                        setSelectedToolFibonacci(false);
                        setPendingDrawingStart(null);
                        setPendingDrawingHover(null);
                      }
                    }}
                    className="rounded-md border border-red-700 bg-slate-950/80 px-2 py-1 text-[11px] text-red-300 hover:bg-red-900/30"
                  >
                    선택 도형 삭제
                  </button>
                </div>
              )}
              {showFibonacciActions && (
                <div className="absolute right-2 top-12 z-20 flex items-center gap-2">
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

            {enableDrawingTools && selectedIndicator !== "none" && (
              <div className="relative rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1">
                <p className="text-[10px] text-slate-400">AD (10)</p>
                <svg width="100%" height={INDICATOR_PANEL_HEIGHT - 22} viewBox="0 0 100 100" preserveAspectRatio="none">
                  {indicatorValues.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#f87171"
                      strokeWidth="1.2"
                      points={indicatorValues
                        .map((value, index, arr) => {
                          const x = (index / (arr.length - 1)) * 100;
                          const max = Math.max(...arr, 1);
                          const y = 100 - (value / max) * 100;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  )}
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

