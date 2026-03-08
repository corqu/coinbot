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
type FibonacciToolVariant = "channel" | "circle" | "retracement" | "speed-arcs" | "extension";

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

export type FibonacciRetracementOverlay = {
  a?: ChartPickedPoint | null;
  b?: ChartPickedPoint | null;
  ratios?: number[];
};

export type FibonacciChannelOverlay = {
  a?: ChartPickedPoint | null;
  b?: ChartPickedPoint | null;
  c?: ChartPickedPoint | null;
  ratios?: number[];
};

export type FibonacciSpeedResistanceArcsOverlay = {
  start?: ChartPickedPoint | null;
  end?: ChartPickedPoint | null;
  ratios?: number[];
};

export type FibonacciExtensionOverlay = {
  a?: ChartPickedPoint | null;
  b?: ChartPickedPoint | null;
  c?: ChartPickedPoint | null;
  ratios?: number[];
};

type BitcoinChartProps = {
  enableDrawingTools?: boolean;
  overlays?: ChartOverlay[];
  onPricePick?: (price: number) => void;
  onPointPick?: (point: ChartPickedPoint) => void;
  onHoverPointChange?: (point: ChartPickedPoint | null) => void;
  onFibonacciPointDrag?: (target: "center" | "edge", point: ChartPickedPoint) => void;
  onFibonacciRetracementPointDrag?: (target: "a" | "b", point: ChartPickedPoint) => void;
  onFibonacciRetracementMove?: (next: { a: ChartPickedPoint; b: ChartPickedPoint }) => void;
  onFibonacciChannelPointDrag?: (target: "a" | "b" | "c", point: ChartPickedPoint) => void;
  onFibonacciChannelMove?: (next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => void;
  onFibonacciExtensionPointDrag?: (target: "a" | "b" | "c", point: ChartPickedPoint) => void;
  onFibonacciExtensionMove?: (next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => void;
  fibonacciCircleOverlay?: FibonacciCircleOverlay;
  fibonacciRetracementOverlay?: FibonacciRetracementOverlay;
  fibonacciChannelOverlay?: FibonacciChannelOverlay;
  fibonacciExtensionOverlay?: FibonacciExtensionOverlay;
  fibonacciSpeedResistanceArcsOverlay?: FibonacciSpeedResistanceArcsOverlay;
  onFibonacciOverlayClick?: () => void;
  overlaySelectionEnabled?: boolean;
  showFibonacciActions?: boolean;
  onFibonacciDelete?: () => void;
  onFibonacciSpeedResistanceArcsPointDrag?: (target: "start" | "end", point: ChartPickedPoint) => void;
  onFibonacciSpeedResistanceArcsMove?: (next: { start: ChartPickedPoint; end: ChartPickedPoint }) => void;
};

const FIB_CIRCLE_DEFAULT_RATIOS = [0.382, 0.5, 0.618, 1.0, 1.618];
const FIB_CIRCLE_DEFAULT_EXT_RATIOS = [2.0, 2.618, 4.236];
const FIB_RETRACEMENT_DEFAULT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_RETRACEMENT_DEFAULT_EXT_RATIOS = [1.272, 1.618, 2.0];
const FIB_CHANNEL_DEFAULT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
const FIB_CHANNEL_DEFAULT_EXT_RATIOS = [1.272, 1.618, 2.0];
const FIB_EXTENSION_DEFAULT_RATIOS = [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.0, 2.618];
const FIB_SPEED_ARCS_DEFAULT_RATIOS = [0.382, 0.5, 0.618, 1.0];
const MAIN_CHART_HEIGHT = 330;
const INDICATOR_PANEL_HEIGHT = 130;
const TOOL_RAIL_WIDTH = 40;
const PRICE_SCALE_RESERVED = 56;

const DRAWING_TOOLS = [
  { id: "trendline", label: "추세선" },
  {
    id: "fibonacci",
    label: "피보나치",
    children: ["채널", "서클", "되돌림", "스피드저항아크", "확장", "스피드팬"],
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

function formatFibRatio(value: number): string {
  return Number(value.toFixed(3)).toString();
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
  const direct = logicalToCoordinateSafe(chart, logical);
  if (direct !== null) return direct;

  if (candles.length < 2) return null;
  const lastIndex = candles.length - 1;
  const prevIndex = candles.length - 2;
  const lastX = chart.timeScale().timeToCoordinate(candles[lastIndex]?.time);
  const prevX = chart.timeScale().timeToCoordinate(candles[prevIndex]?.time);
  if (lastX === null || prevX === null) return null;
  const spacing = lastX - prevX;
  if (!Number.isFinite(spacing) || Math.abs(spacing) < 0.0001) return null;
  return lastX + (logical - lastIndex) * spacing;
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

function resolveFibonacciToolVariant(selectedTool: string): FibonacciToolVariant {
  if (selectedTool.endsWith(":서클")) return "circle";
  if (selectedTool.endsWith(":되돌림")) return "retracement";
  if (selectedTool.endsWith(":스피드저항아크")) return "speed-arcs";
  if (selectedTool.endsWith(":확장")) return "extension";
  if (selectedTool.endsWith(":채널")) return "channel";
  return "channel";
}

export function BitcoinChart({
  enableDrawingTools = false,
  overlays = [],
  onPricePick,
  onPointPick,
  onHoverPointChange,
  onFibonacciPointDrag,
  onFibonacciRetracementPointDrag,
  onFibonacciRetracementMove,
  onFibonacciChannelPointDrag,
  onFibonacciChannelMove,
  onFibonacciExtensionPointDrag,
  onFibonacciExtensionMove,
  fibonacciCircleOverlay,
  fibonacciRetracementOverlay,
  fibonacciChannelOverlay,
  fibonacciExtensionOverlay,
  fibonacciSpeedResistanceArcsOverlay,
  onFibonacciOverlayClick,
  overlaySelectionEnabled = true,
  showFibonacciActions = false,
  onFibonacciDelete,
  onFibonacciSpeedResistanceArcsPointDrag,
  onFibonacciSpeedResistanceArcsMove,
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
  const onFibonacciRetracementPointDragRef = useRef<((target: "a" | "b", point: ChartPickedPoint) => void) | undefined>(
    onFibonacciRetracementPointDrag,
  );
  const onFibonacciRetracementMoveRef = useRef<((next: { a: ChartPickedPoint; b: ChartPickedPoint }) => void) | undefined>(
    onFibonacciRetracementMove,
  );
  const onFibonacciChannelPointDragRef = useRef<
    ((target: "a" | "b" | "c", point: ChartPickedPoint) => void) | undefined
  >(onFibonacciChannelPointDrag);
  const onFibonacciChannelMoveRef = useRef<
    ((next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => void) | undefined
  >(
    onFibonacciChannelMove,
  );
  const onFibonacciExtensionPointDragRef = useRef<
    ((target: "a" | "b" | "c", point: ChartPickedPoint) => void) | undefined
  >(onFibonacciExtensionPointDrag);
  const onFibonacciExtensionMoveRef = useRef<
    ((next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => void) | undefined
  >(onFibonacciExtensionMove);
  const onFibonacciSpeedResistanceArcsPointDragRef = useRef<
    ((target: "start" | "end", point: ChartPickedPoint) => void) | undefined
  >(onFibonacciSpeedResistanceArcsPointDrag);
  const onFibonacciSpeedResistanceArcsMoveRef = useRef<
    ((next: { start: ChartPickedPoint; end: ChartPickedPoint }) => void) | undefined
  >(onFibonacciSpeedResistanceArcsMove);
  const onFibonacciOverlayClickRef = useRef<(() => void) | undefined>(onFibonacciOverlayClick);
  const overlaySelectionEnabledRef = useRef<boolean>(overlaySelectionEnabled);
  const fibonacciCircleRef = useRef<FibonacciCircleOverlay | undefined>(fibonacciCircleOverlay);
  const fibonacciRetracementRef = useRef<FibonacciRetracementOverlay | undefined>(fibonacciRetracementOverlay);
  const fibonacciChannelRef = useRef<FibonacciChannelOverlay | undefined>(fibonacciChannelOverlay);
  const fibonacciExtensionRef = useRef<FibonacciExtensionOverlay | undefined>(fibonacciExtensionOverlay);
  const fibonacciSpeedArcsRef = useRef<FibonacciSpeedResistanceArcsOverlay | undefined>(fibonacciSpeedResistanceArcsOverlay);
  const fibSyncRafRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSvgMarkupRef = useRef<string>("");
  const lastPickAtRef = useRef<number>(0);
  const lastFibDragAtRef = useRef<number>(0);
  const fibDragTargetRef = useRef<
    | "center"
    | "edge"
    | "circle-move"
    | "retracement-a"
    | "retracement-b"
    | "retracement-move"
    | "channel-a"
    | "channel-b"
    | "channel-c"
    | "channel-move"
    | "extension-a"
    | "extension-b"
    | "extension-c"
    | "extension-move"
    | "arcs-start"
    | "arcs-end"
    | "arcs-move"
    | "drawing-start"
    | "drawing-end"
    | "drawing-move"
    | null
  >(null);
  const fibDragMovedRef = useRef<boolean>(false);
  const channelMoveSessionRef = useRef<
    | {
        aTs: number;
        bTs: number;
        cTs: number;
        aPrice: number;
        bPrice: number;
        cPrice: number;
        grabTs: number;
        grabPrice: number;
      }
    | null
  >(null);
  const retracementMoveSessionRef = useRef<
    | {
        aTs: number;
        bTs: number;
        aPrice: number;
        bPrice: number;
        grabTs: number;
        grabPrice: number;
      }
    | null
  >(null);
  const speedArcsMoveSessionRef = useRef<
    | {
        startTs: number;
        endTs: number;
        startPrice: number;
        endPrice: number;
        grabTs: number;
        grabPrice: number;
      }
    | null
  >(null);
  const circleMoveSessionRef = useRef<
    | {
        centerTs: number;
        edgeTs: number;
        centerPrice: number;
        edgePrice: number;
        grabTs: number;
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
  const [selectedToolFibonacciVariant, setSelectedToolFibonacciVariant] = useState<FibonacciToolVariant | null>(null);
  const [pendingDrawingStart, setPendingDrawingStart] = useState<ChartPickedPoint | null>(null);
  const [pendingDrawingHover, setPendingDrawingHover] = useState<ChartPickedPoint | null>(null);
  const [toolFibonacciOverlay, setToolFibonacciOverlay] = useState<FibonacciChannelOverlay | undefined>(undefined);
  const [toolFibonacciCircleOverlay, setToolFibonacciCircleOverlay] = useState<FibonacciCircleOverlay | undefined>(
    undefined,
  );
  const [toolFibonacciRetracementOverlay, setToolFibonacciRetracementOverlay] = useState<FibonacciRetracementOverlay | undefined>(
    undefined,
  );
  const [toolFibonacciExtensionOverlay, setToolFibonacciExtensionOverlay] = useState<FibonacciExtensionOverlay | undefined>(
    undefined,
  );
  const [toolFibonacciSpeedArcsOverlay, setToolFibonacciSpeedArcsOverlay] = useState<FibonacciSpeedResistanceArcsOverlay | undefined>(
    undefined,
  );
  const activeToolKind = enableDrawingTools ? toDrawingToolKind(selectedTool) : null;
  const effectiveFibonacciChannelOverlay = toolFibonacciOverlay ?? fibonacciChannelOverlay;
  const effectiveFibonacciCircleOverlay = toolFibonacciCircleOverlay ?? fibonacciCircleOverlay;
  const effectiveFibonacciRetracementOverlay = toolFibonacciRetracementOverlay ?? fibonacciRetracementOverlay;
  const effectiveFibonacciSpeedArcsOverlay = toolFibonacciSpeedArcsOverlay ?? fibonacciSpeedResistanceArcsOverlay;
  const effectiveFibonacciExtensionOverlay = toolFibonacciExtensionOverlay ?? fibonacciExtensionOverlay;
  const activeToolKindRef = useRef<DrawingToolKind | null>(activeToolKind);
  const selectedToolRef = useRef<string>(selectedTool);
  const userDrawingsRef = useRef<UserLineDrawing[]>(userDrawings);
  const selectedDrawingIdRef = useRef<string | null>(selectedDrawingId);
  const drawingGeometriesRef = useRef<UserDrawingScreenGeometry[]>([]);
  const drawingDragIdRef = useRef<string | null>(null);
  const drawingMoveSessionRef = useRef<{
    drawingId: string;
    start: ChartPickedPoint;
    end: ChartPickedPoint;
    grabPoint: ChartPickedPoint;
  } | null>(null);
  const pendingDrawingStartRef = useRef<ChartPickedPoint | null>(pendingDrawingStart);
  const pendingDrawingHoverRef = useRef<ChartPickedPoint | null>(pendingDrawingHover);
  const selectedToolFibonacciRef = useRef<boolean>(selectedToolFibonacci);
  const selectedToolFibonacciVariantRef = useRef<FibonacciToolVariant | null>(selectedToolFibonacciVariant);
  const toolFibonacciOverlayRef = useRef<FibonacciChannelOverlay | undefined>(toolFibonacciOverlay);
  const toolFibonacciCircleOverlayRef = useRef<FibonacciCircleOverlay | undefined>(toolFibonacciCircleOverlay);
  const toolFibonacciRetracementOverlayRef = useRef<FibonacciRetracementOverlay | undefined>(toolFibonacciRetracementOverlay);
  const toolFibonacciExtensionOverlayRef = useRef<FibonacciExtensionOverlay | undefined>(toolFibonacciExtensionOverlay);
  const toolFibonacciSpeedArcsOverlayRef = useRef<FibonacciSpeedResistanceArcsOverlay | undefined>(toolFibonacciSpeedArcsOverlay);

  useEffect(() => {
    setPendingDrawingStart(null);
    setPendingDrawingHover(null);
    if (selectedTool !== "") {
      setSelectedToolFibonacci(false);
      setSelectedToolFibonacciVariant(null);
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
    selectedToolFibonacciRef.current = selectedToolFibonacci;
  }, [selectedToolFibonacci]);

  useEffect(() => {
    selectedToolFibonacciVariantRef.current = selectedToolFibonacciVariant;
  }, [selectedToolFibonacciVariant]);

  useEffect(() => {
    toolFibonacciOverlayRef.current = toolFibonacciOverlay;
  }, [toolFibonacciOverlay]);

  useEffect(() => {
    toolFibonacciCircleOverlayRef.current = toolFibonacciCircleOverlay;
  }, [toolFibonacciCircleOverlay]);

  useEffect(() => {
    toolFibonacciRetracementOverlayRef.current = toolFibonacciRetracementOverlay;
  }, [toolFibonacciRetracementOverlay]);

  useEffect(() => {
    toolFibonacciExtensionOverlayRef.current = toolFibonacciExtensionOverlay;
  }, [toolFibonacciExtensionOverlay]);

  useEffect(() => {
    toolFibonacciSpeedArcsOverlayRef.current = toolFibonacciSpeedArcsOverlay;
  }, [toolFibonacciSpeedArcsOverlay]);

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
    if (candles.length === 0) return null;

    const center = overlay.center;
    const edge = overlay.edge;
    const centerTs = center.ts;
    const edgeTs = edge.ts;
    if (centerTs === null || edgeTs === null) return null;

    const cx = pointTsToXCoordinate(chart, candles, centerTs);
    const cy = series.priceToCoordinate(center.price);
    const ex = pointTsToXCoordinate(chart, candles, edgeTs);
    const ey = series.priceToCoordinate(edge.price);
    if (cx === null || cy === null || ex === null || ey === null) return null;

    const dTsRaw = edgeTs - centerTs;
    const dPriceRaw = edge.price - center.price;
    const intervalSec = estimateBarIntervalSec(candles);
    const priceStep = Math.max(Math.abs(center.price) * 0.001, 1);

    let sx = Math.abs(dTsRaw) > 1e-9 ? (ex - cx) / dTsRaw : NaN;
    if (!Number.isFinite(sx) || Math.abs(sx) < 1e-9) {
      const tx = pointTsToXCoordinate(chart, candles, centerTs + intervalSec);
      sx = tx === null ? NaN : (tx - cx) / intervalSec;
    }

    let sy = Math.abs(dPriceRaw) > 1e-9 ? (ey - cy) / dPriceRaw : NaN;
    if (!Number.isFinite(sy) || Math.abs(sy) < 1e-9) {
      const py = series.priceToCoordinate(center.price + priceStep);
      sy = py === null ? NaN : (py - cy) / priceStep;
    }

    if (!Number.isFinite(sx) || !Number.isFinite(sy) || Math.abs(sx) < 1e-9 || Math.abs(sy) < 1e-9) return null;
    const exNorm = dTsRaw * sx;
    const eyNorm = dPriceRaw * sy;
    if (Math.hypot(exNorm, eyNorm) < 1e-6) return null;

    const baseRatios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0)
        : FIB_CIRCLE_DEFAULT_RATIOS;
    if (baseRatios.length === 0) return null;
    const extRatios = FIB_CIRCLE_DEFAULT_EXT_RATIOS.filter(
      (ratio) => !baseRatios.some((baseRatio) => Math.abs(baseRatio - ratio) < 1e-9),
    );

    const toRingPoints = (ratio: number): ScreenPoint[] => {
      const points: ScreenPoint[] = [];
      const segments = 120;
      for (let i = 0; i <= segments; i += 1) {
        const theta = (i / segments) * Math.PI * 2;
        const nx = exNorm * Math.cos(theta) - eyNorm * Math.sin(theta);
        const ny = eyNorm * Math.cos(theta) + exNorm * Math.sin(theta);
        const ts = centerTs + (ratio * nx) / sx;
        const price = center.price + (ratio * ny) / sy;
        const x = pointTsToXCoordinate(chart, candles, ts);
        const y = series.priceToCoordinate(price);
        if (x === null || y === null) continue;
        points.push({ x, y });
      }
      return points;
    };

    const toRing = (ratio: number, opacity: number, external = false) => {
      const points = toRingPoints(ratio);
      if (points.length < 3) return null;
      return {
        ratio,
        points,
        path: pointsToPath(points),
        strokeOpacity: opacity,
        external,
      };
    };

    const rings = baseRatios
      .map((ratio, index) => toRing(ratio, Math.max(0.2, 0.85 - index * 0.08), ratio > 1))
      .filter(
        (
          ring,
        ): ring is { ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number; external: boolean } =>
          ring !== null,
      );

    const extRings = extRatios
      .map((ratio, index) => toRing(ratio, Math.max(0.2, 0.7 - index * 0.08), true))
      .filter(
        (
          ring,
        ): ring is { ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number; external: boolean } =>
          ring !== null,
      );

    if (rings.length === 0 && extRings.length === 0) return null;
    return { cx, cy, ex, ey, rings, extRings };
  }, []);

  const computeFibonacciRetracementScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciRetracementRef.current;
    const candles = candlesRef.current;
    if (!chart || !series || !overlay?.a || !overlay?.b) return null;
    if (overlay.a.ts === null || overlay.b.ts === null) return null;
    if (candles.length === 0) return null;

    const ax = pointTsToXCoordinate(chart, candles, overlay.a.ts);
    const ay = series.priceToCoordinate(overlay.a.price);
    const bx = pointTsToXCoordinate(chart, candles, overlay.b.ts);
    const by = series.priceToCoordinate(overlay.b.price);
    if (ax === null || ay === null || bx === null || by === null) return null;

    const diff = overlay.b.price - overlay.a.price;
    const baseRatios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio))
        : FIB_RETRACEMENT_DEFAULT_RATIOS;
    const extRatios = FIB_RETRACEMENT_DEFAULT_EXT_RATIOS.filter(
      (ratio) => Number.isFinite(ratio) && !baseRatios.some((base) => Math.abs(base - ratio) < 1e-9),
    );
    const ratios = [...baseRatios, ...extRatios];

    const toRetracementLine = (ratio: number, opacity: number) => {
      if (!overlay.a || !overlay.b) return null;
      const price = overlay.a.price + diff * ratio;
      const y = series.priceToCoordinate(price);
      if (y === null) return null;
      const leftX = Math.min(ax, bx);
      const rightX = Math.max(ax, bx);
      return {
        ratio,
        price,
        y,
        path: `M ${leftX} ${y} L ${rightX} ${y}`,
        strokeOpacity: opacity,
      };
    };

    const bands = ratios
      .map((ratio: number, idx: number) => toRetracementLine(ratio, Math.max(0.2, 0.9 - idx * 0.08)))
      .filter((band: any): band is NonNullable<ReturnType<typeof toRetracementLine>> => band !== null);

    return { ax, ay, bx, by, bands };
  }, []);

  const computeFibonacciExtensionScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciExtensionRef.current;
    const candles = candlesRef.current;
    const container = containerRef.current;
    if (!chart || !series || !overlay?.a || overlay.a.ts === null || !container || candles.length === 0) return null;

    const ax = pointTsToXCoordinate(chart, candles, overlay.a.ts);
    const ay = series.priceToCoordinate(overlay.a.price);
    if (ax === null || ay === null) return null;

    if (!overlay.b || overlay.b.ts === null) {
      return {
        ax,
        ay,
        bx: null as number | null,
        by: null as number | null,
        cx: null as number | null,
        cy: null as number | null,
        zeroGuidePath: "",
        levels: [] as Array<{ ratio: number; price: number; y: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        preview: true,
        rightX: Math.max(0, container.clientWidth - PRICE_SCALE_RESERVED),
      };
    }

    const bx = pointTsToXCoordinate(chart, candles, overlay.b.ts);
    const by = series.priceToCoordinate(overlay.b.price);
    if (bx === null || by === null) return null;

    if (!overlay.c || overlay.c.ts === null) {
      return {
        ax,
        ay,
        bx,
        by,
        cx: null as number | null,
        cy: null as number | null,
        zeroGuidePath: "",
        levels: [] as Array<{ ratio: number; price: number; y: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        preview: true,
        rightX: Math.max(0, container.clientWidth - PRICE_SCALE_RESERVED),
      };
    }

    const cx = pointTsToXCoordinate(chart, candles, overlay.c.ts);
    const cy = series.priceToCoordinate(overlay.c.price);
    if (cx === null || cy === null) return null;

    const plotRightX = Math.max(0, container.clientWidth - PRICE_SCALE_RESERVED);
    const spanAB = Math.max(40, Math.abs(bx - ax));
    const spanAC = Math.max(40, Math.abs(cx - ax));
    const extensionLength = Math.min(420, Math.max(140, Math.max(spanAB, spanAC) * 2.0));
    const leftX = cx;
    const rightX = Math.min(plotRightX, cx + extensionLength);
    const move = overlay.b.price - overlay.a.price;
    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio >= 0)
        : FIB_EXTENSION_DEFAULT_RATIOS;

    const levels = ratios
      .map((ratio, idx) => {
        const price = overlay.c!.price + move * ratio;
        const y = series.priceToCoordinate(price);
        if (y === null) return null;
        const points = [
          { x: leftX, y },
          { x: rightX, y },
        ];
        return {
          ratio,
          price,
          y,
          points,
          path: pointsToPath(points),
          strokeOpacity: Math.max(0.2, 0.9 - idx * 0.08),
        };
      })
      .filter(
        (
          level,
        ): level is { ratio: number; price: number; y: number; points: ScreenPoint[]; path: string; strokeOpacity: number } =>
          level !== null,
      );

    return {
      ax,
      ay,
      bx,
      by,
      cx,
      cy,
      zeroGuidePath: pointsToPath([
        { x: ax, y: cy },
        { x: cx, y: cy },
      ]),
      levels,
      preview: false,
      rightX,
    };
  }, []);

  const computeFibonacciChannelScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciChannelRef.current;
    const candles = candlesRef.current;
    const a = overlay?.a;
    const b = overlay?.b;
    const c = overlay?.c;
    if (!chart || !series || !a || a.ts === null) return null;

    const toScreen = (point: { ts: number; price: number }): ScreenPoint | null => {
      const x = pointTsToXCoordinate(chart, candles, point.ts);
      const y = series.priceToCoordinate(point.price);
      if (x === null || y === null) return null;
      return { x, y };
    };

    const aPoint = { ts: a.ts, price: a.price };
    const aScreen = toScreen(aPoint);
    if (!aScreen) return null;

    if (!b || b.ts === null) {
      return {
        ax: aScreen.x,
        ay: aScreen.y,
        bx: null,
        by: null,
        cx: null,
        cy: null,
        basePoints: [] as ScreenPoint[],
        leftBoundaryPoints: [] as ScreenPoint[],
        rightBoundaryPoints: [] as ScreenPoint[],
        basePath: "",
        leftBoundaryPath: "",
        rightBoundaryPath: "",
        cGuidePath: "",
        bands: [] as Array<{ ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        extBands: [] as Array<{ ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        preview: true,
      };
    }

    const bPoint = { ts: b.ts, price: b.price };
    const bScreen = toScreen(bPoint);
    if (!bScreen) return null;
    if (Math.abs(bPoint.ts - aPoint.ts) < 1e-6) return null;

    const basePoints = [aScreen, bScreen];
    const basePath = pointsToPath(basePoints);

    if (!c || c.ts === null) {
      return {
        ax: aScreen.x,
        ay: aScreen.y,
        bx: bScreen.x,
        by: bScreen.y,
        cx: null,
        cy: null,
        basePoints,
        leftBoundaryPoints: [] as ScreenPoint[],
        rightBoundaryPoints: [] as ScreenPoint[],
        basePath,
        leftBoundaryPath: "",
        rightBoundaryPath: "",
        cGuidePath: "",
        bands: [] as Array<{ ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        extBands: [] as Array<{ ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number }>,
        preview: true,
      };
    }

    const cPoint = { ts: c.ts, price: c.price };
    const cScreen = toScreen(cPoint);
    if (!cScreen) return null;

    const sideX = cScreen.x - aScreen.x;
    const sideY = cScreen.y - aScreen.y;
    const dScreen = { x: bScreen.x + sideX, y: bScreen.y + sideY };

    const leftBoundaryPoints = [aScreen, cScreen];
    const rightBoundaryPoints = [bScreen, dScreen];

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio >= 0)
        : FIB_CHANNEL_DEFAULT_RATIOS;
    const extRatios = FIB_CHANNEL_DEFAULT_EXT_RATIOS.filter(
      (ratio) => !ratios.some((baseRatio) => Math.abs(baseRatio - ratio) < 1e-9),
    );

    const toBandLine = (ratio: number, opacity: number) => {
      const points: ScreenPoint[] = [
        { x: aScreen.x + sideX * ratio, y: aScreen.y + sideY * ratio },
        { x: bScreen.x + sideX * ratio, y: bScreen.y + sideY * ratio },
      ];
      return {
        ratio,
        points,
        path: pointsToPath(points),
        strokeOpacity: opacity,
      };
    };

    const bands = ratios
      .map((ratio, idx) => toBandLine(ratio, Math.max(0.2, 0.9 - idx * 0.08)))
      .filter(
        (band): band is { ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number } => band !== null,
      );

    const extBands = extRatios
      .map((ratio, idx) => toBandLine(ratio, Math.max(0.2, 0.75 - idx * 0.08)))
      .filter(
        (band): band is { ratio: number; points: ScreenPoint[]; path: string; strokeOpacity: number } => band !== null,
      );

    const baseSlope = (bPoint.price - aPoint.price) / (bPoint.ts - aPoint.ts);
    const baseAtCTs = aPoint.price + baseSlope * (cPoint.ts - aPoint.ts);
    const cGuideStart = toScreen({ ts: cPoint.ts, price: baseAtCTs });
    const cGuidePath =
      cGuideStart && cScreen
        ? pointsToPath([
            cGuideStart,
            cScreen,
          ])
        : "";

    return {
      ax: aScreen.x,
      ay: aScreen.y,
      bx: bScreen.x,
      by: bScreen.y,
      cx: cScreen.x,
      cy: cScreen.y,
      basePoints,
      leftBoundaryPoints,
      rightBoundaryPoints,
      basePath,
      leftBoundaryPath: pointsToPath(leftBoundaryPoints),
      rightBoundaryPath: pointsToPath(rightBoundaryPoints),
      cGuidePath,
      bands,
      extBands,
      preview: false,
    };
  }, []);

  const computeFibonacciSpeedArcsScreenGeometry = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = fibonacciSpeedArcsRef.current;
    const candles = candlesRef.current;
    if (!chart || !series || !overlay?.start || !overlay?.end) return null;
    if (overlay.start.ts === null || overlay.end.ts === null) return null;
    if (candles.length === 0) return null;

    // Python semantics:
    // - start = center (a.index, a.price)
    // - end   = point on base radius (b.index, b.price)
    const cx = pointTsToXCoordinate(chart, candles, overlay.start.ts);
    const cy = series.priceToCoordinate(overlay.start.price);
    const rx = pointTsToXCoordinate(chart, candles, overlay.end.ts);
    const ry = series.priceToCoordinate(overlay.end.price);
    if (cx === null || cy === null || rx === null || ry === null) return null;

    const baseRadius = Math.hypot(rx - cx, ry - cy);
    if (!Number.isFinite(baseRadius) || baseRadius < 1e-6) return null;

    const ratios =
      overlay.ratios && overlay.ratios.length > 0
        ? overlay.ratios.filter((ratio) => Number.isFinite(ratio) && ratio > 0)
        : FIB_SPEED_ARCS_DEFAULT_RATIOS;
    if (ratios.length === 0) return null;

    const toArcPoints = (radius: number): ScreenPoint[] => {
      const points: ScreenPoint[] = [];
      const segments = 120;
      for (let i = 0; i <= segments; i += 1) {
        // Upper semicircle (screen coordinates: smaller y is "up").
        const t = i / segments;
        const theta = Math.PI - t * Math.PI; // π -> 0
        const x = cx + radius * Math.cos(theta);
        const y = cy - radius * Math.sin(theta);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        points.push({ x, y });
      }
      return points;
    };

    const arcs = ratios
      .map((ratio, idx) => {
        const radius = baseRadius * ratio;
        if (!Number.isFinite(radius) || radius <= 0) return null;
        const points = toArcPoints(radius);
        if (points.length < 3) return null;
        return {
          ratio,
          radius,
          points,
          path: pointsToPath(points),
          strokeOpacity: Math.max(0.2, 0.9 - idx * 0.08),
        };
      })
      .filter(
        (
          arc,
        ): arc is { ratio: number; radius: number; points: ScreenPoint[]; path: string; strokeOpacity: number } =>
          arc !== null,
      );

    if (arcs.length === 0) return null;
    return { cx, cy, rx, ry, baseRadius, arcs };
  }, []);

  const syncFibonacciOverlay = useCallback(() => {
    const svg = svgOverlayRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    // Exclude right price-scale strip so overlay stays inside the plot area.
    const width = Math.max(0, container.clientWidth - PRICE_SCALE_RESERVED);
    // Exclude bottom time-scale strip so overlay stays inside the plot area.
    const timeScaleReserved = 26;
    const height = Math.max(0, container.clientHeight - timeScaleReserved);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const circleGeometry = computeFibonacciScreenGeometry();
    const channelGeometry = computeFibonacciChannelScreenGeometry();
    const retracementGeometry = computeFibonacciRetracementScreenGeometry();
    const extensionGeometry = computeFibonacciExtensionScreenGeometry();
    const speedArcsGeometry = computeFibonacciSpeedArcsScreenGeometry();

    const circlePaths = circleGeometry
      ? circleGeometry.rings
          .map((ring) => {
            const color = ring.external ? "#f97316" : "#38bdf8";
            const radius = Math.hypot(circleGeometry.ex - circleGeometry.cx, circleGeometry.ey - circleGeometry.cy) * ring.ratio;
            if (!Number.isFinite(radius) || radius <= 0) return "";
            return `<circle cx="${circleGeometry.cx}" cy="${circleGeometry.cy}" r="${radius}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="${ring.strokeOpacity}" ${ring.external ? 'stroke-dasharray="6 4"' : ""} />`;
          })
          .join("")
      : "";

    const circleExtPaths = circleGeometry
      ? circleGeometry.extRings
          .map((ring) => {
            const radius = Math.hypot(circleGeometry.ex - circleGeometry.cx, circleGeometry.ey - circleGeometry.cy) * ring.ratio;
            if (!Number.isFinite(radius) || radius <= 0) return "";
            return `<circle cx="${circleGeometry.cx}" cy="${circleGeometry.cy}" r="${radius}" fill="none" stroke="#f97316" stroke-width="1.2" stroke-opacity="${ring.strokeOpacity}" stroke-dasharray="6 4" />`;
          })
          .join("")
      : "";

    const showCircleControls =
      selectedToolFibonacciRef.current && selectedToolFibonacciVariantRef.current === "circle";
    const circleControls = circleGeometry && showCircleControls
      ? `
      <circle cx="${circleGeometry.cx}" cy="${circleGeometry.cy}" r="4" fill="#22c55e" />
      <circle cx="${circleGeometry.ex}" cy="${circleGeometry.ey}" r="4" fill="#f97316" />
      <line x1="${circleGeometry.cx}" y1="${circleGeometry.cy}" x2="${circleGeometry.ex}" y2="${circleGeometry.ey}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" />
    `
      : "";

    const retracementPaths = retracementGeometry
      ? retracementGeometry.bands
          .map((band) => {
            const isBoundary = Math.abs(band.ratio) < 1e-9 || Math.abs(band.ratio - 1.0) < 1e-9;
            const isExtension = band.ratio > 1.000000001 || band.ratio < -1e-9;
            const color = isBoundary ? "#f8fafc" : isExtension ? "#f97316" : "#38bdf8";
            const widthStroke = isBoundary ? 1.8 : isExtension ? 1.1 : 1.2;
            const dash = isBoundary ? "" : isExtension ? ' stroke-dasharray="6 4"' : ' stroke-dasharray="6 4"';
            return `<path d="${band.path}" fill="none" stroke="${color}" stroke-width="${widthStroke}" stroke-opacity="${band.strokeOpacity}"${dash} />`;
          })
          .join("")
      : "";

    const retracementLabels = retracementGeometry
      ? retracementGeometry.bands
          .map((band) => {
            const labelX = Math.max(retracementGeometry.ax, retracementGeometry.bx) + 6;
            return `<text x="${labelX}" y="${band.y}" text-anchor="start" dominant-baseline="middle" fill="#cbd5e1" font-size="10" font-weight="500" paint-order="stroke" stroke="#020617" stroke-width="2">${formatFibRatio(
              band.ratio,
            )} (${formatPrice(band.price)})</text>`;
          })
          .join("")
      : "";

    const showRetracementControls =
      selectedToolFibonacciRef.current && selectedToolFibonacciVariantRef.current === "retracement";
    const retracementControls = retracementGeometry && showRetracementControls
      ? `
      <line x1="${retracementGeometry.ax}" y1="${retracementGeometry.ay}" x2="${retracementGeometry.bx}" y2="${retracementGeometry.by}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" fill="none" />
      <circle cx="${retracementGeometry.ax}" cy="${retracementGeometry.ay}" r="4" fill="#22c55e" />
      <circle cx="${retracementGeometry.bx}" cy="${retracementGeometry.by}" r="4" fill="#f97316" />
    `
      : "";

    const speedArcsPaths = speedArcsGeometry
      ? speedArcsGeometry.arcs
          .map((arc) => {
            const isBase = Math.abs(arc.ratio - 1.0) < 1e-9;
            const color = isBase ? "#f8fafc" : "#38bdf8";
            const width = isBase ? 1.8 : 1.2;
            const dash = isBase ? "" : ' stroke-dasharray="6 4"';
            return `<path d="${arc.path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity="${arc.strokeOpacity}"${dash} />`;
          })
          .join("")
      : "";

    const speedArcsLabels = speedArcsGeometry
      ? speedArcsGeometry.arcs
          .map((arc) => {
            const labelX = speedArcsGeometry.cx + arc.radius + 6;
            const labelY = speedArcsGeometry.cy;
            return `<text x="${labelX}" y="${labelY}" text-anchor="start" dominant-baseline="middle" fill="#cbd5e1" font-size="10" font-weight="500" paint-order="stroke" stroke="#020617" stroke-width="2">${formatFibRatio(
              arc.ratio,
            )}</text>`;
          })
          .join("")
      : "";

    const showSpeedArcsControls =
      selectedToolFibonacciRef.current && selectedToolFibonacciVariantRef.current === "speed-arcs";
    const speedArcsControls = speedArcsGeometry && showSpeedArcsControls
      ? `
      <line x1="${speedArcsGeometry.cx}" y1="${speedArcsGeometry.cy}" x2="${speedArcsGeometry.rx}" y2="${speedArcsGeometry.ry}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" fill="none" />
      <circle cx="${speedArcsGeometry.cx}" cy="${speedArcsGeometry.cy}" r="4" fill="#22c55e" />
      <circle cx="${speedArcsGeometry.rx}" cy="${speedArcsGeometry.ry}" r="4" fill="#f97316" />
    `
      : "";

    const extensionPaths = extensionGeometry
      ? extensionGeometry.levels
          .map((level) => {
            const isBase = Math.abs(level.ratio - 1.0) < 1e-9;
            const color = isBase ? "#f8fafc" : "#38bdf8";
            const widthStroke = isBase ? 1.8 : 1.2;
            const dash = isBase ? "" : ' stroke-dasharray="6 4"';
            return `<path d="${level.path}" fill="none" stroke="${color}" stroke-width="${widthStroke}" stroke-opacity="${level.strokeOpacity}"${dash} />`;
          })
          .join("")
      : "";

    const extensionLabels = extensionGeometry
      ? extensionGeometry.levels
          .map((level) => {
            const labelX = extensionGeometry.rightX + 6;
            return `<text x="${labelX}" y="${level.y}" text-anchor="start" dominant-baseline="middle" fill="#cbd5e1" font-size="10" font-weight="500" paint-order="stroke" stroke="#020617" stroke-width="2">${formatFibRatio(
              level.ratio,
            )} (${formatPrice(level.price)})</text>`;
          })
          .join("")
      : "";

    const showExtensionControls =
      selectedToolFibonacciRef.current && selectedToolFibonacciVariantRef.current === "extension";
    const extensionControls = extensionGeometry && showExtensionControls
      ? `
      ${
        extensionGeometry.zeroGuidePath
          ? `<path d="${extensionGeometry.zeroGuidePath}" stroke="#64748b" stroke-width="1" stroke-dasharray="5 4" fill="none" />`
          : ""
      }
      ${
        extensionGeometry.bx !== null && extensionGeometry.by !== null
          ? `<line x1="${extensionGeometry.ax}" y1="${extensionGeometry.ay}" x2="${extensionGeometry.bx}" y2="${extensionGeometry.by}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" fill="none" />`
          : ""
      }
      ${
        extensionGeometry.bx !== null &&
        extensionGeometry.by !== null &&
        extensionGeometry.cx !== null &&
        extensionGeometry.cy !== null
          ? `<line x1="${extensionGeometry.bx}" y1="${extensionGeometry.by}" x2="${extensionGeometry.cx}" y2="${extensionGeometry.cy}" stroke="#64748b" stroke-width="1" stroke-dasharray="4 4" fill="none" />`
          : ""
      }
      <circle cx="${extensionGeometry.ax}" cy="${extensionGeometry.ay}" r="4" fill="#22c55e" />
      ${
        extensionGeometry.bx !== null && extensionGeometry.by !== null
          ? `<circle cx="${extensionGeometry.bx}" cy="${extensionGeometry.by}" r="4" fill="#f97316" />`
          : ""
      }
      ${
        extensionGeometry.cx !== null && extensionGeometry.cy !== null
          ? `<circle cx="${extensionGeometry.cx}" cy="${extensionGeometry.cy}" r="4" fill="#38bdf8" />`
          : ""
      }
    `
      : "";

    const channelPaths = channelGeometry
      ? channelGeometry.bands
          .map((band) => {
            const isBoundary = Math.abs(band.ratio) < 1e-9 || Math.abs(band.ratio - 1.0) < 1e-9;
            const color = isBoundary ? "#f8fafc" : "#38bdf8";
            const widthStroke = isBoundary ? 1.8 : 1.2;
            const dash = isBoundary ? "" : ' stroke-dasharray="6 4"';
            return `<path d="${band.path}" fill="none" stroke="${color}" stroke-width="${widthStroke}" stroke-opacity="${band.strokeOpacity}"${dash} />`;
          })
          .join("")
      : "";

    const channelExtPaths = channelGeometry
      ? channelGeometry.extBands
          .map((band) => {
            const dash = channelGeometry.preview ? ' stroke-dasharray="4 4"' : ' stroke-dasharray="6 4"';
            return `<path d="${band.path}" fill="none" stroke="#f97316" stroke-width="1.1" stroke-opacity="${band.strokeOpacity}"${dash} />`;
          })
          .join("")
      : "";

    const channelLabels = channelGeometry
      ? [...channelGeometry.bands, ...channelGeometry.extBands]
          .map((band) => {
            const p1 = band.points[0];
            const p2 = band.points[1];
            if (!p1 || !p2) return "";
            const left = p1.x <= p2.x ? p1 : p2;
            const right = p1.x <= p2.x ? p2 : p1;
            const dx = right.x - left.x;
            const dy = right.y - left.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-6) return "";
            const ux = dx / len;
            const uy = dy / len;
            const labelX = left.x - ux * 10;
            const labelY = left.y - uy * 10;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return `<text x="${labelX}" y="${labelY}" transform="rotate(${angle} ${labelX} ${labelY})" text-anchor="end" dominant-baseline="middle" fill="#cbd5e1" font-size="10" font-weight="500" paint-order="stroke" stroke="#020617" stroke-width="2">${formatFibRatio(
              band.ratio,
            )}</text>`;
          })
          .join("")
      : "";

    const showChannelControls =
      selectedToolFibonacciRef.current && selectedToolFibonacciVariantRef.current === "channel";
    const channelControls = channelGeometry && showChannelControls
      ? `
      <path d="${channelGeometry.basePath}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" fill="none" />
      <path d="${channelGeometry.leftBoundaryPath}" stroke="#64748b" stroke-width="1" stroke-opacity="0.8" fill="none" />
      <path d="${channelGeometry.rightBoundaryPath}" stroke="#64748b" stroke-width="1" stroke-opacity="0.8" fill="none" />
      <circle cx="${channelGeometry.ax}" cy="${channelGeometry.ay}" r="4" fill="#22c55e" />
      ${
        channelGeometry.bx !== null && channelGeometry.by !== null
          ? `<circle cx="${channelGeometry.bx}" cy="${channelGeometry.by}" r="4" fill="#f97316" />`
          : ""
      }
      ${
        channelGeometry.cx !== null && channelGeometry.cy !== null
          ? `<circle cx="${channelGeometry.cx}" cy="${channelGeometry.cy}" r="4" fill="#38bdf8" />`
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
      Boolean(retracementGeometry) ||
      Boolean(extensionGeometry) ||
      Boolean(speedArcsGeometry) ||
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
      ${channelLabels}
      ${retracementPaths}
      ${retracementLabels}
      ${extensionPaths}
      ${extensionLabels}
      ${speedArcsPaths}
      ${speedArcsLabels}
      ${linePaths}
      ${selectedDrawingHandles}
      ${pendingLinePath}
      ${circlePaths}
      ${circleExtPaths}
      ${channelControls}
      ${circleControls}
      ${retracementControls}
      ${extensionControls}
      ${speedArcsControls}
    `;
    if (nextMarkup === lastSvgMarkupRef.current) return;
    svg.innerHTML = nextMarkup;
    lastSvgMarkupRef.current = nextMarkup;
  }, [
    computeFibonacciChannelScreenGeometry,
    computeFibonacciScreenGeometry,
    computeFibonacciRetracementScreenGeometry,
    computeFibonacciExtensionScreenGeometry,
    computeFibonacciSpeedArcsScreenGeometry,
  ]);

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
    if (!geometry) return null;
    return {
      ax: geometry.ax,
      ay: geometry.ay,
      bx: geometry.bx,
      by: geometry.by,
      cx: geometry.cx,
      cy: geometry.cy,
    };
  }, [computeFibonacciChannelScreenGeometry]);

  const getFibonacciRetracementControlPoints = useCallback(() => {
    const geometry = computeFibonacciRetracementScreenGeometry();
    if (!geometry) return null;
    return {
      ax: geometry.ax,
      ay: geometry.ay,
      bx: geometry.bx,
      by: geometry.by,
    };
  }, [computeFibonacciRetracementScreenGeometry]);

  const pickFibonacciHandle = useCallback((x: number, y: number): "center" | "edge" | null => {
    const control = getFibonacciControlPoints();
    if (!control) return null;

    const dCenter = Math.hypot(x - control.cx, y - control.cy);
    const dEdge = Math.hypot(x - control.ex, y - control.ey);
    const hitRadius = 14;
    if (dCenter > hitRadius && dEdge > hitRadius) return null;
    return dCenter <= dEdge ? "center" : "edge";
  }, [getFibonacciControlPoints]);

  const pickFibonacciRetracementHandle = useCallback((x: number, y: number): "a" | "b" | null => {
    const control = getFibonacciRetracementControlPoints();
    if (!control) return null;
    const distances: Array<{ key: "a" | "b"; value: number }> = [
      { key: "a", value: Math.hypot(x - control.ax, y - control.ay) },
      { key: "b", value: Math.hypot(x - control.bx, y - control.by) },
    ];
    const hitRadius = 10;
    const nearest = distances.reduce((best, item) => (item.value < best.value ? item : best), distances[0]);
    if (nearest.value > hitRadius) return null;
    return nearest.key;
  }, [getFibonacciRetracementControlPoints]);

  const pickFibonacciChannelHandle = useCallback((x: number, y: number): "a" | "b" | "c" | null => {
    const control = getFibonacciChannelControlPoints();
    if (!control) return null;
    const distances: Array<{ key: "a" | "b" | "c"; value: number }> = [
      { key: "a", value: Math.hypot(x - control.ax, y - control.ay) },
      {
        key: "b",
        value:
          control.bx === null || control.by === null
            ? Number.POSITIVE_INFINITY
            : Math.hypot(x - control.bx, y - control.by),
      },
      {
        key: "c",
        value:
          control.cx === null || control.cy === null
            ? Number.POSITIVE_INFINITY
            : Math.hypot(x - control.cx, y - control.cy),
      },
    ];
    const hitRadius = 10;
    const nearest = distances.reduce((best, item) => (item.value < best.value ? item : best), distances[0]);
    if (nearest.value > hitRadius) return null;
    return nearest.key;
  }, [getFibonacciChannelControlPoints]);

  const pickFibonacciExtensionHandle = useCallback((x: number, y: number): "a" | "b" | "c" | null => {
    const geometry = computeFibonacciExtensionScreenGeometry();
    if (!geometry) return null;
    const distances: Array<{ key: "a" | "b" | "c"; value: number }> = [
      { key: "a", value: Math.hypot(x - geometry.ax, y - geometry.ay) },
      {
        key: "b",
        value:
          geometry.bx === null || geometry.by === null
            ? Number.POSITIVE_INFINITY
            : Math.hypot(x - geometry.bx, y - geometry.by),
      },
      {
        key: "c",
        value:
          geometry.cx === null || geometry.cy === null
            ? Number.POSITIVE_INFINITY
            : Math.hypot(x - geometry.cx, y - geometry.cy),
      },
    ];
    const hitRadius = 10;
    const nearest = distances.reduce((best, item) => (item.value < best.value ? item : best), distances[0]);
    if (nearest.value > hitRadius) return null;
    return nearest.key;
  }, [computeFibonacciExtensionScreenGeometry]);

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
    const ringHit = [...geometry.rings, ...geometry.extRings].some((ring) => minDistanceToPolyline(ring.points, x, y) <= 6);
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

    if (geometry.basePoints.length > 1 && minDistanceToPolyline(geometry.basePoints, x, y) <= 6) {
      return true;
    }
    if (geometry.leftBoundaryPoints.length > 1 && minDistanceToPolyline(geometry.leftBoundaryPoints, x, y) <= 6) {
      return true;
    }
    if (geometry.rightBoundaryPoints.length > 1 && minDistanceToPolyline(geometry.rightBoundaryPoints, x, y) <= 6) {
      return true;
    }

    const anyBandHit = [...geometry.bands, ...geometry.extBands].some(
      (band) => minDistanceToPolyline(band.points, x, y) <= 6,
    );
    return anyBandHit;
  }, [computeFibonacciChannelScreenGeometry, pickFibonacciChannelHandle]);

  const hitTestFibonacciExtensionOverlay = useCallback(
    (x: number, y: number) => {
      const geometry = computeFibonacciExtensionScreenGeometry();
      if (!geometry) return false;
      if (pickFibonacciExtensionHandle(x, y)) return true;
      if (geometry.levels.some((level) => minDistanceToPolyline(level.points, x, y) <= 6)) return true;
      if (geometry.bx !== null && geometry.by !== null) {
        const ab = minDistanceToPolyline(
          [
            { x: geometry.ax, y: geometry.ay },
            { x: geometry.bx, y: geometry.by },
          ],
          x,
          y,
        );
        if (ab <= 6) return true;
      }
      if (
        geometry.bx !== null &&
        geometry.by !== null &&
        geometry.cx !== null &&
        geometry.cy !== null
      ) {
        const bc = minDistanceToPolyline(
          [
            { x: geometry.bx, y: geometry.by },
            { x: geometry.cx, y: geometry.cy },
          ],
          x,
          y,
        );
        if (bc <= 6) return true;
      }
      return false;
    },
    [computeFibonacciExtensionScreenGeometry, pickFibonacciExtensionHandle],
  );

  const hitTestFibonacciRetracementOverlay = useCallback(
    (x: number, y: number) => {
      const geometry = computeFibonacciRetracementScreenGeometry();
      if (!geometry) return false;
      const handle = pickFibonacciRetracementHandle(x, y);
      if (handle) return true;

      const anyBandHit = geometry.bands.some((band) => {
        const leftX = Math.min(geometry.ax, geometry.bx);
        const rightX = Math.max(geometry.ax, geometry.bx);
        return minDistanceToPolyline(
          [
            { x: leftX, y: band.y },
            { x: rightX, y: band.y },
          ],
          x,
          y,
        ) <= 6;
      });
      if (anyBandHit) return true;

      const vx = geometry.bx - geometry.ax;
      const vy = geometry.by - geometry.ay;
      const wx = x - geometry.ax;
      const wy = y - geometry.ay;
      const c2 = vx * vx + vy * vy;
      if (c2 <= 0) return false;
      const t = Math.max(0, Math.min(1, (vx * wx + vy * wy) / c2));
      const px = geometry.ax + t * vx;
      const py = geometry.ay + t * vy;
      return Math.hypot(x - px, y - py) <= 6;
    },
    [computeFibonacciRetracementScreenGeometry, pickFibonacciRetracementHandle],
  );

  const getFibonacciSpeedArcsControlPoints = useCallback(() => {
    const geometry = computeFibonacciSpeedArcsScreenGeometry();
    if (!geometry) return null;
    return { cx: geometry.cx, cy: geometry.cy, rx: geometry.rx, ry: geometry.ry };
  }, [computeFibonacciSpeedArcsScreenGeometry]);

  const pickFibonacciSpeedArcsHandle = useCallback((x: number, y: number): "start" | "end" | null => {
    const control = getFibonacciSpeedArcsControlPoints();
    if (!control) return null;
    const dStart = Math.hypot(x - control.cx, y - control.cy);
    const dEnd = Math.hypot(x - control.rx, y - control.ry);
    const hitRadius = 10;
    if (dStart > hitRadius && dEnd > hitRadius) return null;
    return dStart <= dEnd ? "start" : "end";
  }, [getFibonacciSpeedArcsControlPoints]);

  const hitTestFibonacciSpeedArcsOverlay = useCallback(
    (x: number, y: number) => {
      const geometry = computeFibonacciSpeedArcsScreenGeometry();
      if (!geometry) return false;
      const handle = pickFibonacciSpeedArcsHandle(x, y);
      if (handle) return true;
      return geometry.arcs.some((arc) => minDistanceToPolyline(arc.points, x, y) <= 6);
    },
    [computeFibonacciSpeedArcsScreenGeometry, pickFibonacciSpeedArcsHandle],
  );

  const computeMovedChannelPoints = useCallback(
    (x: number, y: number): { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint } | null => {
      const session = channelMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = inferTsFromCoordinate(chart, candles, x);
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;
      const deltaTs = currentTs - session.grabTs;
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      return {
        a: {
          ts: Math.floor(session.aTs + deltaTs),
          price: rounded(session.aPrice + deltaPrice),
        },
        b: {
          ts: Math.floor(session.bTs + deltaTs),
          price: rounded(session.bPrice + deltaPrice),
        },
        c: {
          ts: Math.floor(session.cTs + deltaTs),
          price: rounded(session.cPrice + deltaPrice),
        },
      };
    },
    [],
  );

  const computeMovedExtensionPoints = useCallback(
    (x: number, y: number): { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint } | null => {
      const session = channelMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = inferTsFromCoordinate(chart, candles, x);
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;
      const deltaTs = currentTs - session.grabTs;
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      return {
        a: { ts: Math.floor(session.aTs + deltaTs), price: rounded(session.aPrice + deltaPrice) },
        b: { ts: Math.floor(session.bTs + deltaTs), price: rounded(session.bPrice + deltaPrice) },
        c: { ts: Math.floor(session.cTs + deltaTs), price: rounded(session.cPrice + deltaPrice) },
      };
    },
    [],
  );

  const computeMovedSpeedArcsPoints = useCallback(
    (x: number, y: number): { start: ChartPickedPoint; end: ChartPickedPoint } | null => {
      const session = speedArcsMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = inferTsFromCoordinate(chart, candles, x);
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;

      const deltaTs = currentTs - session.grabTs;
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      return {
        start: {
          ts: Math.floor(session.startTs + deltaTs),
          price: rounded(session.startPrice + deltaPrice),
        },
        end: {
          ts: Math.floor(session.endTs + deltaTs),
          price: rounded(session.endPrice + deltaPrice),
        },
      };
    },
    [],
  );

  const applySpeedArcsPointUpdate = useCallback((target: "start" | "end", point: ChartPickedPoint) => {
    const isToolActive = Boolean(toolFibonacciSpeedArcsOverlayRef.current);
    if (!isToolActive && onFibonacciSpeedResistanceArcsPointDragRef.current) {
      onFibonacciSpeedResistanceArcsPointDragRef.current(target, point);
      return;
    }
    setToolFibonacciSpeedArcsOverlay((prev) => {
      if (!prev) return prev;
      return { ...prev, [target]: point };
    });
  }, []);

  const applySpeedArcsMoveUpdate = useCallback((next: { start: ChartPickedPoint; end: ChartPickedPoint }) => {
    const isToolActive = Boolean(toolFibonacciSpeedArcsOverlayRef.current);
    if (!isToolActive && onFibonacciSpeedResistanceArcsMoveRef.current) {
      onFibonacciSpeedResistanceArcsMoveRef.current(next);
      return;
    }
    setToolFibonacciSpeedArcsOverlay((prev) => {
      if (!prev) return prev;
      return { ...prev, start: next.start, end: next.end };
    });
  }, []);

  const computeMovedRetracementPoints = useCallback(
    (x: number, y: number): { a: ChartPickedPoint; b: ChartPickedPoint } | null => {
      const session = retracementMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = inferTsFromCoordinate(chart, candles, x);
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;

      const deltaTs = currentTs - session.grabTs;
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      return {
        a: {
          ts: Math.floor(session.aTs + deltaTs),
          price: rounded(session.aPrice + deltaPrice),
        },
        b: {
          ts: Math.floor(session.bTs + deltaTs),
          price: rounded(session.bPrice + deltaPrice),
        },
      };
    },
    [],
  );

  const computeMovedCirclePoints = useCallback(
    (x: number, y: number): { center: ChartPickedPoint; edge: ChartPickedPoint } | null => {
      const session = circleMoveSessionRef.current;
      const series = seriesRef.current;
      if (!session || !series) return null;
      const candles = candlesRef.current;
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return null;

      const currentTs = inferTsFromCoordinate(chart, candles, x);
      const currentPrice = series.coordinateToPrice(y);
      if (currentTs === null || currentPrice === null || !Number.isFinite(currentPrice)) return null;
      const deltaTs = currentTs - session.grabTs;
      const deltaPrice = rounded(currentPrice - session.grabPrice);

      return {
        center: {
          ts: Math.floor(session.centerTs + deltaTs),
          price: rounded(session.centerPrice + deltaPrice),
        },
        edge: {
          ts: Math.floor(session.edgeTs + deltaTs),
          price: rounded(session.edgePrice + deltaPrice),
        },
      };
    },
    [],
  );

  const applyCirclePointUpdate = useCallback((target: "center" | "edge", point: ChartPickedPoint) => {
    const isToolCircleActive = Boolean(toolFibonacciCircleOverlayRef.current);
    if (!isToolCircleActive && onFibonacciPointDragRef.current) {
      onFibonacciPointDragRef.current(target, point);
      return;
    }
    setToolFibonacciCircleOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [target]: point,
      };
    });
  }, []);

  const applyCircleMoveUpdate = useCallback((next: { center: ChartPickedPoint; edge: ChartPickedPoint }) => {
    setToolFibonacciCircleOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        center: next.center,
        edge: next.edge,
      };
    });
  }, []);

  const applyChannelPointUpdate = useCallback(
    (target: "a" | "b" | "c", point: ChartPickedPoint) => {
      const isToolChannelActive = Boolean(toolFibonacciOverlayRef.current);
      if (!isToolChannelActive && onFibonacciChannelPointDragRef.current) {
        onFibonacciChannelPointDragRef.current(target, point);
        return;
      }
      setToolFibonacciOverlay((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [target]: point,
        };
      });
    },
    [],
  );

  const applyRetracementPointUpdate = useCallback((target: "a" | "b", point: ChartPickedPoint) => {
    const isToolRetracementActive = Boolean(toolFibonacciRetracementOverlayRef.current);
    if (!isToolRetracementActive && onFibonacciRetracementPointDragRef.current) {
      onFibonacciRetracementPointDragRef.current(target, point);
      return;
    }
    setToolFibonacciRetracementOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [target]: point,
      };
    });
  }, []);

  const applyRetracementMoveUpdate = useCallback((next: { a: ChartPickedPoint; b: ChartPickedPoint }) => {
    const isToolRetracementActive = Boolean(toolFibonacciRetracementOverlayRef.current);
    if (!isToolRetracementActive && onFibonacciRetracementMoveRef.current) {
      onFibonacciRetracementMoveRef.current(next);
      return;
    }
    setToolFibonacciRetracementOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        a: next.a,
        b: next.b,
      };
    });
  }, []);

  const applyChannelMoveUpdate = useCallback((next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => {
    const isToolChannelActive = Boolean(toolFibonacciOverlayRef.current);
    if (!isToolChannelActive && onFibonacciChannelMoveRef.current) {
      onFibonacciChannelMoveRef.current(next);
      return;
    }
    setToolFibonacciOverlay((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        a: next.a,
        b: next.b,
        c: next.c,
      };
    });
  }, []);

  const applyExtensionPointUpdate = useCallback((target: "a" | "b" | "c", point: ChartPickedPoint) => {
    const isToolExtensionActive = Boolean(toolFibonacciExtensionOverlayRef.current);
    if (!isToolExtensionActive && onFibonacciExtensionPointDragRef.current) {
      onFibonacciExtensionPointDragRef.current(target, point);
      return;
    }
    setToolFibonacciExtensionOverlay((prev) => {
      if (!prev) return prev;
      return { ...prev, [target]: point };
    });
  }, []);

  const applyExtensionMoveUpdate = useCallback((next: { a: ChartPickedPoint; b: ChartPickedPoint; c: ChartPickedPoint }) => {
    const isToolExtensionActive = Boolean(toolFibonacciExtensionOverlayRef.current);
    if (!isToolExtensionActive && onFibonacciExtensionMoveRef.current) {
      onFibonacciExtensionMoveRef.current(next);
      return;
    }
    setToolFibonacciExtensionOverlay((prev) => {
      if (!prev) return prev;
      return { ...prev, a: next.a, b: next.b, c: next.c };
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

  const handleDeleteSelectedDrawing = useCallback(() => {
    const selectedId = selectedDrawingIdRef.current;
    if (selectedId) {
      setUserDrawings((prev) => prev.filter((item) => item.id !== selectedId));
      setSelectedDrawingId(null);
      drawingDragIdRef.current = null;
      drawingMoveSessionRef.current = null;
    }
  }, []);

  const handleDeleteSelectedFibonacci = useCallback(() => {
    if (!selectedToolFibonacciRef.current) return;
    const selectedVariant = selectedToolFibonacciVariantRef.current;
    const hasToolSelectedOverlay =
      selectedVariant === "channel"
        ? Boolean(toolFibonacciOverlayRef.current)
        : selectedVariant === "circle"
        ? Boolean(toolFibonacciCircleOverlayRef.current)
        : selectedVariant === "retracement"
        ? Boolean(toolFibonacciRetracementOverlayRef.current)
        : selectedVariant === "extension"
        ? Boolean(toolFibonacciExtensionOverlayRef.current)
        : selectedVariant === "speed-arcs"
        ? Boolean(toolFibonacciSpeedArcsOverlayRef.current)
        : false;
    if (!hasToolSelectedOverlay) onFibonacciDelete?.();
    if (selectedVariant === "channel") setToolFibonacciOverlay(undefined);
    else if (selectedVariant === "circle") setToolFibonacciCircleOverlay(undefined);
    else if (selectedVariant === "retracement") setToolFibonacciRetracementOverlay(undefined);
    else if (selectedVariant === "extension") setToolFibonacciExtensionOverlay(undefined);
    else if (selectedVariant === "speed-arcs") setToolFibonacciSpeedArcsOverlay(undefined);
    setSelectedToolFibonacci(false);
    setSelectedToolFibonacciVariant(null);
    setPendingDrawingStart(null);
    setPendingDrawingHover(null);
  }, [onFibonacciDelete]);

  const handleDeleteSelected = useCallback(() => {
    handleDeleteSelectedDrawing();
    handleDeleteSelectedFibonacci();
  }, [handleDeleteSelectedDrawing, handleDeleteSelectedFibonacci]);

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
          const fibVariant = resolveFibonacciToolVariant(selectedToolRef.current);
          if (fibVariant === "circle") {
            setToolFibonacciCircleOverlay({
              center: currentPendingStart,
              edge: hoveredPoint,
              ratios: FIB_CIRCLE_DEFAULT_RATIOS,
            });
          } else if (fibVariant === "retracement") {
            setToolFibonacciRetracementOverlay({
              a: currentPendingStart,
              b: hoveredPoint,
              ratios: FIB_RETRACEMENT_DEFAULT_RATIOS,
            });
          } else if (fibVariant === "speed-arcs") {
            setToolFibonacciSpeedArcsOverlay({
              start: currentPendingStart,
              end: hoveredPoint,
              ratios: FIB_SPEED_ARCS_DEFAULT_RATIOS,
            });
          } else if (fibVariant === "extension") {
            const currentOverlay = toolFibonacciExtensionOverlayRef.current ?? fibonacciExtensionRef.current;
            const aPoint = currentPendingStart;
            const bPoint = currentOverlay?.b ?? null;
            setToolFibonacciExtensionOverlay({
              a: aPoint,
              b: bPoint,
              c: hoveredPoint,
              ratios: FIB_EXTENSION_DEFAULT_RATIOS,
            });
          } else {
            const currentOverlay = fibonacciChannelRef.current;
            const aPoint = currentPendingStart;
            const bPoint = currentOverlay?.b ?? null;
            setToolFibonacciOverlay({
              a: aPoint,
              b: bPoint,
              c: hoveredPoint,
              ratios: FIB_CHANNEL_DEFAULT_RATIOS,
            });
          }
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
          let currentPendingStart = pendingDrawingStartRef.current;
          if (currentToolKind === "fibonacci" && !currentPendingStart) {
            const fibVariant = resolveFibonacciToolVariant(selectedToolRef.current);
            if (fibVariant === "circle") {
              currentPendingStart = toolFibonacciCircleOverlayRef.current?.center ?? null;
            } else if (fibVariant === "retracement") {
              currentPendingStart = toolFibonacciRetracementOverlayRef.current?.a ?? null;
            } else if (fibVariant === "speed-arcs") {
              currentPendingStart = toolFibonacciSpeedArcsOverlayRef.current?.start ?? null;
            } else if (fibVariant === "extension") {
              currentPendingStart = toolFibonacciExtensionOverlayRef.current?.a ?? null;
            } else {
              currentPendingStart = toolFibonacciOverlayRef.current?.a ?? null;
            }
          }
          if (currentToolKind) {
            if (!currentPendingStart) {
              lastPickAtRef.current = Date.now();
              pendingDrawingStartRef.current = pickedPoint;
              setPendingDrawingStart(pickedPoint);
              if (currentToolKind === "fibonacci") {
                const fibVariant = resolveFibonacciToolVariant(selectedToolRef.current);
                if (fibVariant === "circle") {
                  const nextCircleOverlay: FibonacciCircleOverlay = {
                    center: pickedPoint,
                    edge: undefined,
                    ratios: FIB_CIRCLE_DEFAULT_RATIOS,
                  };
                  toolFibonacciCircleOverlayRef.current = nextCircleOverlay;
                  setToolFibonacciCircleOverlay(nextCircleOverlay);
                } else if (fibVariant === "retracement") {
                  const nextRetracementOverlay: FibonacciRetracementOverlay = {
                    a: pickedPoint,
                    b: undefined,
                    ratios: FIB_RETRACEMENT_DEFAULT_RATIOS,
                  };
                  toolFibonacciRetracementOverlayRef.current = nextRetracementOverlay;
                  setToolFibonacciRetracementOverlay(nextRetracementOverlay);
                } else if (fibVariant === "speed-arcs") {
                  const nextSpeedArcsOverlay: FibonacciSpeedResistanceArcsOverlay = {
                    start: pickedPoint,
                    end: undefined,
                    ratios: FIB_SPEED_ARCS_DEFAULT_RATIOS,
                  };
                  toolFibonacciSpeedArcsOverlayRef.current = nextSpeedArcsOverlay;
                  setToolFibonacciSpeedArcsOverlay(nextSpeedArcsOverlay);
                } else if (fibVariant === "extension") {
                  const nextExtensionOverlay: FibonacciExtensionOverlay = {
                    a: pickedPoint,
                    b: undefined,
                    c: undefined,
                    ratios: FIB_EXTENSION_DEFAULT_RATIOS,
                  };
                  toolFibonacciExtensionOverlayRef.current = nextExtensionOverlay;
                  setToolFibonacciExtensionOverlay(nextExtensionOverlay);
                } else {
                  const nextChannelOverlay: FibonacciChannelOverlay = {
                    a: pickedPoint,
                    b: undefined,
                    c: undefined,
                    ratios: FIB_CHANNEL_DEFAULT_RATIOS,
                  };
                  toolFibonacciOverlayRef.current = nextChannelOverlay;
                  setToolFibonacciOverlay(nextChannelOverlay);
                }
              }
              return;
            }

            if (currentToolKind === "fibonacci") {
              const fibVariant = resolveFibonacciToolVariant(selectedToolRef.current);
              if (fibVariant === "circle") {
                lastPickAtRef.current = Date.now();
                const nextCircleOverlay: FibonacciCircleOverlay = {
                  center: currentPendingStart,
                  edge: pickedPoint,
                  ratios: FIB_CIRCLE_DEFAULT_RATIOS,
                };
                toolFibonacciCircleOverlayRef.current = nextCircleOverlay;
                setToolFibonacciCircleOverlay(nextCircleOverlay);
              } else if (fibVariant === "retracement") {
                lastPickAtRef.current = Date.now();
                const nextRetracementOverlay: FibonacciRetracementOverlay = {
                  a: currentPendingStart,
                  b: pickedPoint,
                  ratios: FIB_RETRACEMENT_DEFAULT_RATIOS,
                };
                toolFibonacciRetracementOverlayRef.current = nextRetracementOverlay;
                setToolFibonacciRetracementOverlay(nextRetracementOverlay);
              } else if (fibVariant === "speed-arcs") {
                lastPickAtRef.current = Date.now();
                const nextSpeedArcsOverlay: FibonacciSpeedResistanceArcsOverlay = {
                  start: currentPendingStart,
                  end: pickedPoint,
                  ratios: FIB_SPEED_ARCS_DEFAULT_RATIOS,
                };
                toolFibonacciSpeedArcsOverlayRef.current = nextSpeedArcsOverlay;
                setToolFibonacciSpeedArcsOverlay(nextSpeedArcsOverlay);
              } else if (fibVariant === "extension") {
                const currentOverlay = toolFibonacciExtensionOverlayRef.current ?? fibonacciExtensionRef.current;
                const currentB = currentOverlay?.b;
                if (!currentB) {
                  lastPickAtRef.current = Date.now();
                  const nextExtensionOverlay: FibonacciExtensionOverlay = {
                    a: currentPendingStart,
                    b: pickedPoint,
                    c: undefined,
                    ratios: FIB_EXTENSION_DEFAULT_RATIOS,
                  };
                  toolFibonacciExtensionOverlayRef.current = nextExtensionOverlay;
                  setToolFibonacciExtensionOverlay(nextExtensionOverlay);
                  return;
                }

                lastPickAtRef.current = Date.now();
                const nextExtensionOverlay: FibonacciExtensionOverlay = {
                  a: currentPendingStart,
                  b: currentB,
                  c: pickedPoint,
                  ratios: FIB_EXTENSION_DEFAULT_RATIOS,
                };
                toolFibonacciExtensionOverlayRef.current = nextExtensionOverlay;
                setToolFibonacciExtensionOverlay(nextExtensionOverlay);
              } else {
                const currentOverlay = fibonacciChannelRef.current;
                const currentB = currentOverlay?.b;
                if (!currentB) {
                  lastPickAtRef.current = Date.now();
                  const nextChannelOverlay: FibonacciChannelOverlay = {
                    a: currentPendingStart,
                    b: pickedPoint,
                    c: undefined,
                    ratios: FIB_CHANNEL_DEFAULT_RATIOS,
                  };
                  toolFibonacciOverlayRef.current = nextChannelOverlay;
                  setToolFibonacciOverlay(nextChannelOverlay);
                  return;
                }

                lastPickAtRef.current = Date.now();
                const nextChannelOverlay: FibonacciChannelOverlay = {
                  a: currentPendingStart,
                  b: currentB,
                  c: pickedPoint,
                  ratios: FIB_CHANNEL_DEFAULT_RATIOS,
                };
                toolFibonacciOverlayRef.current = nextChannelOverlay;
                setToolFibonacciOverlay(nextChannelOverlay);
              }
              setSelectedToolFibonacci(true);
              setSelectedToolFibonacciVariant(fibVariant);
              setSelectedDrawingId(null);
              pendingDrawingStartRef.current = null;
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
            pendingDrawingStartRef.current = null;
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
      const drawingToolActive = Boolean(activeToolKindRef.current);
      const drawingPlacementInProgress = Boolean(pendingDrawingStartRef.current);
      if (drawingToolActive && drawingPlacementInProgress) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const activeToolChannelOverlay = toolFibonacciOverlayRef.current;
      const activeToolCircleOverlay = toolFibonacciCircleOverlayRef.current;
      const activeToolRetracementOverlay = toolFibonacciRetracementOverlayRef.current;
      const activeToolExtensionOverlay = toolFibonacciExtensionOverlayRef.current;
      const activeToolSpeedArcsOverlay = toolFibonacciSpeedArcsOverlayRef.current;
      const hasToolChannelOverlay = Boolean(
        enableDrawingTools && activeToolChannelOverlay?.a && activeToolChannelOverlay?.b && activeToolChannelOverlay?.c,
      );
      const hasToolCircleOverlay = Boolean(
        enableDrawingTools && activeToolCircleOverlay?.center && activeToolCircleOverlay?.edge,
      );
      const hasToolRetracementOverlay = Boolean(
        enableDrawingTools && activeToolRetracementOverlay?.a && activeToolRetracementOverlay?.b,
      );
      const hasToolExtensionOverlay = Boolean(
        enableDrawingTools && activeToolExtensionOverlay?.a && activeToolExtensionOverlay?.b && activeToolExtensionOverlay?.c,
      );
      const hasToolSpeedArcsOverlay = Boolean(
        enableDrawingTools && activeToolSpeedArcsOverlay?.start && activeToolSpeedArcsOverlay?.end,
      );
      if (
        (hasToolChannelOverlay && hitTestFibonacciChannelOverlay(x, y)) ||
        (hasToolCircleOverlay && hitTestFibonacciOverlay(x, y)) ||
        (hasToolRetracementOverlay && hitTestFibonacciRetracementOverlay(x, y)) ||
        (hasToolExtensionOverlay && hitTestFibonacciExtensionOverlay(x, y)) ||
        (hasToolSpeedArcsOverlay && hitTestFibonacciSpeedArcsOverlay(x, y))
      ) {
        setSelectedToolFibonacci(true);
        if (hasToolChannelOverlay && hitTestFibonacciChannelOverlay(x, y)) setSelectedToolFibonacciVariant("channel");
        else if (hasToolCircleOverlay && hitTestFibonacciOverlay(x, y)) setSelectedToolFibonacciVariant("circle");
        else if (hasToolRetracementOverlay && hitTestFibonacciRetracementOverlay(x, y))
          setSelectedToolFibonacciVariant("retracement");
        else if (hasToolExtensionOverlay && hitTestFibonacciExtensionOverlay(x, y)) setSelectedToolFibonacciVariant("extension");
        else if (hasToolSpeedArcsOverlay && hitTestFibonacciSpeedArcsOverlay(x, y)) setSelectedToolFibonacciVariant("speed-arcs");
        setSelectedDrawingId(null);
        return;
      }
      if (selectedToolFibonacciRef.current) {
        setSelectedToolFibonacci(false);
        setSelectedToolFibonacciVariant(null);
      }

      if (
        overlaySelectionEnabledRef.current &&
        (hitTestFibonacciOverlay(x, y) ||
          hitTestFibonacciChannelOverlay(x, y) ||
          hitTestFibonacciRetracementOverlay(x, y) ||
          hitTestFibonacciExtensionOverlay(x, y) ||
          hitTestFibonacciSpeedArcsOverlay(x, y))
      ) {
        setSelectedToolFibonacci(true);
        if (hitTestFibonacciOverlay(x, y)) setSelectedToolFibonacciVariant("circle");
        else if (hitTestFibonacciChannelOverlay(x, y)) setSelectedToolFibonacciVariant("channel");
        else if (hitTestFibonacciRetracementOverlay(x, y)) setSelectedToolFibonacciVariant("retracement");
        else if (hitTestFibonacciExtensionOverlay(x, y)) setSelectedToolFibonacciVariant("extension");
        else if (hitTestFibonacciSpeedArcsOverlay(x, y)) setSelectedToolFibonacciVariant("speed-arcs");
        setSelectedDrawingId(null);
        onFibonacciOverlayClickRef.current?.();
        return;
      }

      const drawingHit = pickUserDrawingHit(x, y);
      if (drawingHit) {
        setSelectedDrawingId(drawingHit.id);
        setSelectedToolFibonacci(false);
        setSelectedToolFibonacciVariant(null);
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
      
      // If point-picking is in progress, do not intercept mousedown for overlay selection/drag.
      // This allows the click to reach the lightweight-charts canvas.
      if (!overlaySelectionEnabledRef.current) return;

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const drawingToolActive = Boolean(activeToolKindRef.current);
      const drawingPlacementInProgress = Boolean(pendingDrawingStartRef.current);

      const drawingHit = pickUserDrawingHit(x, y);
      if (drawingHit) {
        setSelectedDrawingId(drawingHit.id);
        setSelectedToolFibonacci(false);
        setSelectedToolFibonacciVariant(null);
        if (drawingHit.target === "start" || drawingHit.target === "end") {
          fibDragTargetRef.current = drawingHit.target === "start" ? "drawing-start" : "drawing-end";
          drawingDragIdRef.current = drawingHit.id;
          drawingMoveSessionRef.current = null;
          fibDragMovedRef.current = false;
          setChartInteractionEnabled(false);
          container.style.cursor = "grabbing";
        } else {
          const grabbedPoint = toPickedPointFromCoordinate(x, y);
          const sourceDrawing = userDrawingsRef.current.find((item) => item.id === drawingHit.id);
          if (grabbedPoint && sourceDrawing && sourceDrawing.start.ts !== null && sourceDrawing.end.ts !== null) {
            fibDragTargetRef.current = "drawing-move";
            drawingDragIdRef.current = drawingHit.id;
            drawingMoveSessionRef.current = {
              drawingId: drawingHit.id,
              start: sourceDrawing.start,
              end: sourceDrawing.end,
              grabPoint: grabbedPoint,
            };
            fibDragMovedRef.current = false;
            setChartInteractionEnabled(false);
            container.style.cursor = "grabbing";
          }
        }
        if (fibDragTargetRef.current) {
          fibDragMovedRef.current = false;
        }
        if (fibDragTargetRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }

      // While placing the second point, keep click flow for point placement only.
      // Allow overlay drag/edit in all other states.
      if (drawingToolActive && drawingPlacementInProgress) return;

      const fibTarget = pickFibonacciHandle(x, y);
      const fibHit = hitTestFibonacciOverlay(x, y);
      const channelTarget = pickFibonacciChannelHandle(x, y);
      const channelHit = hitTestFibonacciChannelOverlay(x, y);
      const retracementTarget = pickFibonacciRetracementHandle(x, y);
      const retracementHit = hitTestFibonacciRetracementOverlay(x, y);
      const extensionTarget = pickFibonacciExtensionHandle(x, y);
      const extensionHit = hitTestFibonacciExtensionOverlay(x, y);
      const speedArcsTarget = pickFibonacciSpeedArcsHandle(x, y);
      const speedArcsHit = hitTestFibonacciSpeedArcsOverlay(x, y);
      if (
        !fibTarget &&
        !channelTarget &&
        !channelHit &&
        !fibHit &&
        !retracementTarget &&
        !retracementHit &&
        !extensionTarget &&
        !extensionHit &&
        !speedArcsTarget &&
        !speedArcsHit
      ) {
        if (selectedDrawingIdRef.current) setSelectedDrawingId(null);
        if (selectedToolFibonacciRef.current) {
          setSelectedToolFibonacci(false);
          setSelectedToolFibonacciVariant(null);
        }
        return;
      }

      if (fibTarget) {
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("circle");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = fibTarget;
      } else if (channelTarget) {
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("channel");
        setSelectedDrawingId(null);
        fibDragTargetRef.current =
          channelTarget === "a" ? "channel-a" : channelTarget === "b" ? "channel-b" : "channel-c";
      } else if (retracementTarget) {
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("retracement");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = retracementTarget === "a" ? "retracement-a" : "retracement-b";
      } else if (extensionTarget) {
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("extension");
        setSelectedDrawingId(null);
        fibDragTargetRef.current =
          extensionTarget === "a" ? "extension-a" : extensionTarget === "b" ? "extension-b" : "extension-c";
      } else if (speedArcsTarget) {
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("speed-arcs");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = speedArcsTarget === "start" ? "arcs-start" : "arcs-end";
      } else if (channelHit) {
        const channel = fibonacciChannelRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!channel?.a || !channel?.b || !channel?.c || !point || point.ts === null) return;
        const aTs = channel.a.ts;
        const bTs = channel.b.ts;
        const cTs = channel.c.ts;
        if (aTs === null || bTs === null || cTs === null) return;
        channelMoveSessionRef.current = {
          aTs,
          bTs,
          cTs,
          aPrice: channel.a.price,
          bPrice: channel.b.price,
          cPrice: channel.c.price,
          grabTs: point.ts,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("channel");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "channel-move";
      } else if (fibHit) {
        const circle = fibonacciCircleRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!circle?.center || !circle?.edge || !point || point.ts === null) return;
        const centerTs = circle.center.ts;
        const edgeTs = circle.edge.ts;
        if (centerTs === null || edgeTs === null) return;
        circleMoveSessionRef.current = {
          centerTs,
          edgeTs,
          centerPrice: circle.center.price,
          edgePrice: circle.edge.price,
          grabTs: point.ts,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("circle");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "circle-move";
      } else if (retracementHit) {
        const retracement = fibonacciRetracementRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!retracement?.a || !retracement?.b || !point || point.ts === null) return;
        const aTs = retracement.a.ts;
        const bTs = retracement.b.ts;
        if (aTs === null || bTs === null) return;
        retracementMoveSessionRef.current = {
          aTs,
          bTs,
          aPrice: retracement.a.price,
          bPrice: retracement.b.price,
          grabTs: point.ts,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("retracement");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "retracement-move";
      } else if (extensionHit) {
        const ext = fibonacciExtensionRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!ext?.a || !ext?.b || !ext?.c || !point || point.ts === null) return;
        const aTs = ext.a.ts;
        const bTs = ext.b.ts;
        const cTs = ext.c.ts;
        if (aTs === null || bTs === null || cTs === null) return;
        channelMoveSessionRef.current = {
          aTs,
          bTs,
          cTs,
          aPrice: ext.a.price,
          bPrice: ext.b.price,
          cPrice: ext.c.price,
          grabTs: point.ts,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("extension");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "extension-move";
      } else if (speedArcsHit) {
        const arcs = fibonacciSpeedArcsRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!arcs?.start || !arcs?.end || !point || point.ts === null) return;
        const startTs = arcs.start.ts;
        const endTs = arcs.end.ts;
        if (startTs === null || endTs === null) return;
        speedArcsMoveSessionRef.current = {
          startTs,
          endTs,
          startPrice: arcs.start.price,
          endPrice: arcs.end.price,
          grabTs: point.ts,
          grabPrice: point.price,
        };
        setSelectedToolFibonacci(true);
        setSelectedToolFibonacciVariant("speed-arcs");
        setSelectedDrawingId(null);
        fibDragTargetRef.current = "arcs-move";
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
      circleMoveSessionRef.current = null;
      retracementMoveSessionRef.current = null;
      channelMoveSessionRef.current = null;
      speedArcsMoveSessionRef.current = null;
      drawingDragIdRef.current = null;
      drawingMoveSessionRef.current = null;
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
        if (activeTarget === "drawing-move") {
          const session = drawingMoveSessionRef.current;
          const point = toPickedPointFromCoordinate(x, y);
          if (!session || !point || point.ts === null || session.grabPoint.ts === null) return;
          const deltaPrice = point.price - session.grabPoint.price;
          const deltaTs = point.ts - session.grabPoint.ts;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          setUserDrawings((prev) =>
            prev.map((item) =>
              item.id === session.drawingId
                ? {
                    ...item,
                    start: {
                      price: rounded(session.start.price + deltaPrice),
                      ts: session.start.ts === null ? null : session.start.ts + deltaTs,
                    },
                    end: {
                      price: rounded(session.end.price + deltaPrice),
                      ts: session.end.ts === null ? null : session.end.ts + deltaTs,
                    },
                  }
                : item,
            ),
          );
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (activeTarget === "circle-move") {
          const moved = computeMovedCirclePoints(x, y);
          if (!moved) return;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          applyCircleMoveUpdate(moved);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (activeTarget === "retracement-move") {
          const moved = computeMovedRetracementPoints(x, y);
          if (!moved) return;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          applyRetracementMoveUpdate(moved);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        if (activeTarget === "arcs-move") {
          const moved = computeMovedSpeedArcsPoints(x, y);
          if (!moved) return;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          applySpeedArcsMoveUpdate(moved);
          event.preventDefault();
          event.stopPropagation();
          return;
        }

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
        if (activeTarget === "extension-move") {
          const moved = computeMovedExtensionPoints(x, y);
          if (!moved) return;
          fibDragMovedRef.current = true;
          lastFibDragAtRef.current = Date.now();
          applyExtensionMoveUpdate(moved);
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
          applyCirclePointUpdate(activeTarget, point);
        } else if (activeTarget === "retracement-a" || activeTarget === "retracement-b") {
          const target = activeTarget === "retracement-a" ? "a" : "b";
          applyRetracementPointUpdate(target, point);
        } else if (activeTarget === "arcs-start" || activeTarget === "arcs-end") {
          const target = activeTarget === "arcs-start" ? "start" : "end";
          applySpeedArcsPointUpdate(target, point);
        } else if (activeTarget === "extension-a" || activeTarget === "extension-b" || activeTarget === "extension-c") {
          const target = activeTarget === "extension-a" ? "a" : activeTarget === "extension-b" ? "b" : "c";
          applyExtensionPointUpdate(target, point);
        } else {
          const target = activeTarget === "channel-a" ? "a" : activeTarget === "channel-b" ? "b" : "c";
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
      const hoverRetracementTarget = pickFibonacciRetracementHandle(x, y);
      const hoverExtensionTarget = pickFibonacciExtensionHandle(x, y);
      const hoverSpeedArcsTarget = pickFibonacciSpeedArcsHandle(x, y);
      if (hoverFibTarget || hoverChannelTarget || hoverRetracementTarget || hoverExtensionTarget || hoverSpeedArcsTarget) {
        container.style.cursor = "grab";
      } else if (hitTestFibonacciOverlay(x, y)) {
        container.style.cursor = "move";
      } else if (hitTestFibonacciChannelOverlay(x, y)) {
        container.style.cursor = "move";
      } else if (hitTestFibonacciRetracementOverlay(x, y)) {
        container.style.cursor = "move";
      } else if (hitTestFibonacciExtensionOverlay(x, y)) {
        container.style.cursor = "move";
      } else if (hitTestFibonacciSpeedArcsOverlay(x, y)) {
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
      if (activeTarget === "drawing-move") {
        const session = drawingMoveSessionRef.current;
        const point = toPickedPointFromCoordinate(x, y);
        if (!session || !point || point.ts === null || session.grabPoint.ts === null) return;
        const deltaPrice = point.price - session.grabPoint.price;
        const deltaTs = point.ts - session.grabPoint.ts;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        setUserDrawings((prev) =>
          prev.map((item) =>
            item.id === session.drawingId
              ? {
                  ...item,
                  start: {
                    price: rounded(session.start.price + deltaPrice),
                    ts: session.start.ts === null ? null : session.start.ts + deltaTs,
                  },
                  end: {
                    price: rounded(session.end.price + deltaPrice),
                    ts: session.end.ts === null ? null : session.end.ts + deltaTs,
                  },
                }
              : item,
          ),
        );
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (activeTarget === "circle-move") {
        const moved = computeMovedCirclePoints(x, y);
        if (!moved) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        applyCircleMoveUpdate(moved);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (activeTarget === "retracement-move") {
        const moved = computeMovedRetracementPoints(x, y);
        if (!moved) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        applyRetracementMoveUpdate(moved);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (activeTarget === "arcs-move") {
        const moved = computeMovedSpeedArcsPoints(x, y);
        if (!moved) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        applySpeedArcsMoveUpdate(moved);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
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
      if (activeTarget === "extension-move") {
        const moved = computeMovedExtensionPoints(x, y);
        if (!moved) return;
        fibDragMovedRef.current = true;
        lastFibDragAtRef.current = Date.now();
        applyExtensionMoveUpdate(moved);
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
        applyCirclePointUpdate(activeTarget, point);
      } else if (activeTarget === "retracement-a" || activeTarget === "retracement-b") {
        const target = activeTarget === "retracement-a" ? "a" : "b";
        applyRetracementPointUpdate(target, point);
      } else if (activeTarget === "arcs-start" || activeTarget === "arcs-end") {
        const target = activeTarget === "arcs-start" ? "start" : "end";
        applySpeedArcsPointUpdate(target, point);
      } else if (activeTarget === "extension-a" || activeTarget === "extension-b" || activeTarget === "extension-c") {
        const target = activeTarget === "extension-a" ? "a" : activeTarget === "extension-b" ? "b" : "c";
        applyExtensionPointUpdate(target, point);
      } else {
        const target = activeTarget === "channel-a" ? "a" : activeTarget === "channel-b" ? "b" : "c";
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
    pickFibonacciRetracementHandle,
    pickFibonacciSpeedArcsHandle,
    pickFibonacciChannelHandle,
    requestFibonacciSync,
    setChartInteractionEnabled,
    syncLineOverlays,
    toPickedPointFromCoordinate,
    hitTestFibonacciOverlay,
    hitTestFibonacciRetracementOverlay,
    hitTestFibonacciSpeedArcsOverlay,
    hitTestFibonacciChannelOverlay,
    computeMovedCirclePoints,
    computeMovedRetracementPoints,
    computeMovedSpeedArcsPoints,
    computeMovedChannelPoints,
    applyCirclePointUpdate,
    applyCircleMoveUpdate,
    applyRetracementPointUpdate,
    applyRetracementMoveUpdate,
    applySpeedArcsPointUpdate,
    applySpeedArcsMoveUpdate,
    applyChannelPointUpdate,
    applyChannelMoveUpdate,
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
    onFibonacciRetracementPointDragRef.current = onFibonacciRetracementPointDrag;
  }, [onFibonacciRetracementPointDrag]);

  useEffect(() => {
    onFibonacciRetracementMoveRef.current = onFibonacciRetracementMove;
  }, [onFibonacciRetracementMove]);

  useEffect(() => {
    onFibonacciChannelPointDragRef.current = onFibonacciChannelPointDrag;
  }, [onFibonacciChannelPointDrag]);

  useEffect(() => {
    onFibonacciChannelMoveRef.current = onFibonacciChannelMove;
  }, [onFibonacciChannelMove]);

  useEffect(() => {
    onFibonacciExtensionPointDragRef.current = onFibonacciExtensionPointDrag;
  }, [onFibonacciExtensionPointDrag]);

  useEffect(() => {
    onFibonacciExtensionMoveRef.current = onFibonacciExtensionMove;
  }, [onFibonacciExtensionMove]);

  useEffect(() => {
    onFibonacciSpeedResistanceArcsPointDragRef.current = onFibonacciSpeedResistanceArcsPointDrag;
  }, [onFibonacciSpeedResistanceArcsPointDrag]);

  useEffect(() => {
    onFibonacciSpeedResistanceArcsMoveRef.current = onFibonacciSpeedResistanceArcsMove;
  }, [onFibonacciSpeedResistanceArcsMove]);

  useEffect(() => {
    onFibonacciOverlayClickRef.current = onFibonacciOverlayClick;
  }, [onFibonacciOverlayClick]);

  useEffect(() => {
    overlaySelectionEnabledRef.current = overlaySelectionEnabled;
  }, [overlaySelectionEnabled]);

  useEffect(() => {
    fibonacciCircleRef.current = effectiveFibonacciCircleOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciCircleOverlay, requestFibonacciSync]);

  useEffect(() => {
    fibonacciRetracementRef.current = effectiveFibonacciRetracementOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciRetracementOverlay, requestFibonacciSync]);

  useEffect(() => {
    fibonacciChannelRef.current = effectiveFibonacciChannelOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciChannelOverlay, requestFibonacciSync]);

  useEffect(() => {
    fibonacciExtensionRef.current = effectiveFibonacciExtensionOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciExtensionOverlay, requestFibonacciSync]);

  useEffect(() => {
    fibonacciSpeedArcsRef.current = effectiveFibonacciSpeedArcsOverlay;
    requestFibonacciSync();
  }, [effectiveFibonacciSpeedArcsOverlay, requestFibonacciSync]);

  useEffect(() => {
    requestFibonacciSync();
  }, [
    activeToolKind,
    pendingDrawingHover,
    pendingDrawingStart,
    requestFibonacciSync,
    selectedDrawingId,
    selectedToolFibonacci,
    selectedToolFibonacciVariant,
    toolFibonacciOverlay,
    toolFibonacciCircleOverlay,
    toolFibonacciRetracementOverlay,
    toolFibonacciExtensionOverlay,
    toolFibonacciSpeedArcsOverlay,
    userDrawings,
  ]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const isDeleteKey = event.key === "Delete" || event.key === "Backspace";
      if (!isDeleteKey) return;

      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (!selectedDrawingIdRef.current && !selectedToolFibonacciRef.current) return;
      event.preventDefault();
      handleDeleteSelected();
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [handleDeleteSelected]);

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
                <div
                  className="absolute top-2 z-20 flex items-center gap-2"
                  style={{ right: `${PRICE_SCALE_RESERVED + 18}px` }}
                >
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
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

