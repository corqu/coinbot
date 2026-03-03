import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  BitcoinChart,
  type ChartOverlay,
  type ChartPickedPoint,
  type FibonacciCircleOverlay,
} from "@/components/charts/BitcoinChart";
import { MainLayout } from "@/components/layout/MainLayout";
import { useActiveStrategies } from "@/features/strategy/hooks";
import type { StrategySummary } from "@/features/strategy/types";

type SchemaFieldType = "number" | "integer" | "string" | "boolean" | "object" | "array";

type StrategyField = {
  key: string;
  label: string;
  type: SchemaFieldType;
  defaultValue: string;
  minimum?: number;
  maximum?: number;
  step?: number;
};

type FolderTreeNode = {
  name: string;
  strategies: StrategySummary[];
};

type RootTreeNode = {
  rootStrategies: StrategySummary[];
  folders: Map<string, FolderTreeNode>;
};

type FibPointMode = "center" | "edge";

const FIB_CIRCLE_DEFAULT_RATIOS = [0.236, 0.382, 0.5, 0.618, 1.0, 1.618, 2.0, 2.618];
const overlayColors = ["#38bdf8", "#f97316", "#22c55e", "#eab308", "#a855f7", "#f43f5e"];

function readFieldsFromSchema(schemaJson: string): StrategyField[] {
  try {
    const parsed = JSON.parse(schemaJson) as {
      properties?: Record<string, { type?: string; title?: string; default?: unknown; minimum?: number; maximum?: number }>;
    };
    const properties = parsed.properties ?? {};

    return Object.entries(properties).map(([key, value]) => {
      const rawType = value.type;
      const type: SchemaFieldType =
        rawType === "integer" ||
        rawType === "number" ||
        rawType === "boolean" ||
        rawType === "object" ||
        rawType === "array"
          ? rawType
          : "string";

      return {
        key,
        label: value.title ?? key.replaceAll("_", " "),
        type,
        minimum: value.minimum,
        maximum: value.maximum,
        defaultValue:
          value.default !== undefined
            ? String(value.default)
            : type === "boolean"
              ? "false"
              : type === "integer" || type === "number"
                ? "0"
                : type === "object"
                  ? "{}"
                  : type === "array"
                    ? "[]"
                    : "",
        step: type === "integer" ? 1 : type === "number" ? 0.1 : undefined,
      };
    });
  } catch {
    return [];
  }
}

function buildInitialValues(fields: StrategyField[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const field of fields) next[field.key] = field.defaultValue;
  return next;
}

function toStrategyPathParts(source: string, fallbackCode: string): { root: string; folder: string | null; file: string } {
  const segments = source.split(".").filter(Boolean);
  const strategyIndex = segments.indexOf("strategy");
  const relative = strategyIndex >= 0 ? segments.slice(strategyIndex + 1) : segments;
  const root = relative[0] ?? "uncategorized";
  const modulePath = relative.slice(1);
  const fileModule = modulePath[modulePath.length - 1] ?? fallbackCode;
  const folderSegments = modulePath.slice(0, -1);

  return {
    root,
    folder: folderSegments.length > 0 ? folderSegments.join("/") : null,
    file: `${fileModule}.py`,
  };
}

function buildTree(strategies: StrategySummary[]): Map<string, RootTreeNode> {
  const tree = new Map<string, RootTreeNode>();
  for (const strategy of strategies) {
    const { root, folder } = toStrategyPathParts(strategy.source, strategy.code);
    const rootNode = tree.get(root) ?? { rootStrategies: [], folders: new Map<string, FolderTreeNode>() };
    if (!folder) {
      rootNode.rootStrategies.push(strategy);
    } else {
      const folderNode = rootNode.folders.get(folder) ?? { name: folder, strategies: [] };
      folderNode.strategies.push(strategy);
      rootNode.folders.set(folder, folderNode);
    }
    tree.set(root, rootNode);
  }
  return tree;
}

function parseJsonObject<T>(value: string): T | null {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as T;
  } catch {
    return null;
  }
}

function parsePoint(value: string): ChartPickedPoint | null {
  const parsed = parseJsonObject<{ price?: unknown; ts?: unknown }>(value);
  if (!parsed) return null;
  const price = Number(parsed.price);
  const tsRaw = parsed.ts;
  const ts = tsRaw === null || tsRaw === undefined ? null : Number(tsRaw);
  if (!Number.isFinite(price)) return null;
  if (ts !== null && !Number.isFinite(ts)) return null;
  return { price, ts: ts === null ? null : Math.floor(ts) };
}

function stringifyPoint(point: ChartPickedPoint): string {
  return JSON.stringify({
    price: Number(point.price.toFixed(2)),
    ts: point.ts,
  });
}

function parseRatios(value: string): number[] {
  if (!value.trim()) return FIB_CIRCLE_DEFAULT_RATIOS;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const numbers = parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
      return numbers.length > 0 ? numbers : FIB_CIRCLE_DEFAULT_RATIOS;
    }
  } catch {
    // fallback to comma parser
  }

  const numbers = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return numbers.length > 0 ? numbers : FIB_CIRCLE_DEFAULT_RATIOS;
}

export function StrategyBuilderPage() {
  const location = useLocation();
  const activeStrategiesQuery = useActiveStrategies(true);
  const strategies = activeStrategiesQuery.data ?? [];
  const isCreateMode = location.pathname.endsWith("/strategies/settings/new");

  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [strategyName, setStrategyName] = useState("");
  const [anchorWindowBars, setAnchorWindowBars] = useState(50);
  const [edgeReference, setEdgeReference] = useState<"high" | "low">("high");
  const [breakoutRatio, setBreakoutRatio] = useState(1.26);
  const [takeProfitPercent, setTakeProfitPercent] = useState(3);
  const [stopLossPercent, setStopLossPercent] = useState(3);
  const [showParameterEditor, setShowParameterEditor] = useState(false);
  const [targetFieldKey, setTargetFieldKey] = useState<string | null>(null);
  const [fibPointMode, setFibPointMode] = useState<FibPointMode | null>(null);
  const [fibChartPickActive, setFibChartPickActive] = useState(false);
  const [fibOverlaySelected, setFibOverlaySelected] = useState(false);
  const [fibPreviewEdgePoint, setFibPreviewEdgePoint] = useState<ChartPickedPoint | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [overlayEnabled, setOverlayEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (strategies.length === 0) return;
    if (selectedStrategyId === null || !strategies.some((s) => s.id === selectedStrategyId)) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [selectedStrategyId, strategies]);

  const selectedStrategy = useMemo(
    () => strategies.find((s) => s.id === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );

  const fields = useMemo(
    () => (selectedStrategy ? readFieldsFromSchema(selectedStrategy.parameterSchemaJson) : []),
    [selectedStrategy],
  );
  const isFibonacciCircles = selectedStrategy?.code === "fibonacci_circles_v1";

  useEffect(() => {
    setFieldValues(buildInitialValues(fields));
    setTargetFieldKey(null);
    setFibPointMode(null);
    setFibChartPickActive(false);
    setFibOverlaySelected(false);
    setFibPreviewEdgePoint(null);

    const nextOverlayEnabled: Record<string, boolean> = {};
    for (const field of fields) nextOverlayEnabled[field.key] = false;
    setOverlayEnabled(nextOverlayEnabled);
  }, [fields]);

  useEffect(() => {
    if (!isFibonacciCircles) return;
    setFieldValues((prev) => {
      const ratios = (prev.ratios ?? "").trim();
      if (ratios) return prev;
      return {
        ...prev,
        ratios: JSON.stringify(FIB_CIRCLE_DEFAULT_RATIOS),
      };
    });
  }, [isFibonacciCircles]);

  const chartOverlays = useMemo<ChartOverlay[]>(() => {
    return fields.reduce<ChartOverlay[]>((acc, field, index) => {
      const isNumeric = field.type === "number" || field.type === "integer";
      if (!isNumeric || !overlayEnabled[field.key]) return acc;
      const value = Number(fieldValues[field.key]);
      if (!Number.isFinite(value)) return acc;

      acc.push({
        id: `${selectedStrategy?.id ?? "none"}-${field.key}`,
        label: field.label,
        value,
        color: overlayColors[index % overlayColors.length],
        enabled: true,
      });
      return acc;
    }, []);
  }, [fieldValues, fields, overlayEnabled, selectedStrategy]);

  const fibCenterPoint = useMemo(() => parsePoint(fieldValues.center ?? ""), [fieldValues.center]);
  const fibEdgePoint = useMemo(() => parsePoint(fieldValues.edge ?? ""), [fieldValues.edge]);
  const fibRatios = useMemo(() => parseRatios(fieldValues.ratios ?? ""), [fieldValues.ratios]);
  const hasFibOverlay = Boolean(isFibonacciCircles && fibCenterPoint && fibEdgePoint);

  const fibOverlay = useMemo<FibonacciCircleOverlay | undefined>(() => {
    if (!isFibonacciCircles) return undefined;
    const previewEdge =
      fibChartPickActive && fibPointMode === "edge" && fibCenterPoint && fibPreviewEdgePoint ? fibPreviewEdgePoint : null;
    return {
      center: fibCenterPoint,
      edge: fibEdgePoint ?? previewEdge,
      ratios: fibRatios,
    };
  }, [fibCenterPoint, fibEdgePoint, fibRatios, fibChartPickActive, fibPointMode, fibPreviewEdgePoint, isFibonacciCircles]);

  const tree = useMemo(() => buildTree(strategies), [strategies]);
  const sortedRoots = useMemo(() => Array.from(tree.entries()).sort(([a], [b]) => a.localeCompare(b)), [tree]);

  const renderStrategyButton = (strategy: StrategySummary) => {
    const { file } = toStrategyPathParts(strategy.source, strategy.code);
    const selected = selectedStrategyId === strategy.id;
    const label = strategy.alias && strategy.alias.trim() ? strategy.alias : strategy.name || file;

    return (
      <button
        key={strategy.id}
        type="button"
        onClick={() => {
          setSelectedStrategyId(strategy.id);
          setShowParameterEditor(true);
          setFibPointMode(null);
          setFibChartPickActive(false);
          setFibOverlaySelected(false);
          setFibPreviewEdgePoint(null);
        }}
        className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
          selected
            ? "border-sky-500 bg-sky-500/10 text-sky-100"
            : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/70"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <MainLayout>
      <section className="space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h1 className="text-xl font-semibold">전략 설정</h1>
          <p className="mt-2 text-sm text-slate-400">좌측 차트, 우측 전략 트리와 파라미터 입력으로 전략을 구성합니다.</p>
          {activeStrategiesQuery.isError && (
            <p className="mt-2 text-xs text-amber-300">/api/strategies/active 호출에 실패해 임시 데이터를 표시 중입니다.</p>
          )}
        </header>

        <div className="overflow-x-auto">
          <div className="flex min-w-[1140px] items-start gap-4">
            <section className="w-[760px] shrink-0">
              <BitcoinChart
                overlays={chartOverlays}
                fibonacciCircleOverlay={fibOverlay}
                overlaySelectionEnabled={!fibChartPickActive}
                showFibonacciActions={showParameterEditor && isFibonacciCircles && fibOverlaySelected}
                onFibonacciDelete={() => {
                  setFieldValues((prev) => ({ ...prev, center: "{}", edge: "{}" }));
                  setFibPointMode(null);
                  setFibChartPickActive(false);
                  setFibOverlaySelected(false);
                  setFibPreviewEdgePoint(null);
                }}
                onFibonacciOverlayClick={() => {
                  if (!hasFibOverlay) return;
                  setFibOverlaySelected(true);
                  setFibChartPickActive(false);
                  setFibPreviewEdgePoint(null);
                }}
                onFibonacciPointDrag={(target, point) => {
                  if (!isFibonacciCircles) return;
                  setFieldValues((prev) => ({
                    ...prev,
                    [target]: stringifyPoint(point),
                  }));
                  setFibOverlaySelected(false);
                  setFibChartPickActive(false);
                  setFibPointMode(null);
                  setFibPreviewEdgePoint(null);
                }}
                onHoverPointChange={(point) => {
                  if (!isFibonacciCircles || !fibChartPickActive || fibPointMode !== "edge" || !fibCenterPoint) return;
                  setFibPreviewEdgePoint(point);
                }}
                onPricePick={(price) => {
                  if (isFibonacciCircles && fibChartPickActive) return;
                  if (!targetFieldKey) return;
                  const targetField = fields.find((f) => f.key === targetFieldKey);
                  if (!targetField) return;

                  const nextValue =
                    targetField.type === "integer" ? String(Math.round(price)) : String(Number(price.toFixed(2)));

                  setFieldValues((prev) => ({
                    ...prev,
                    [targetFieldKey]: nextValue,
                  }));
                }}
                onPointPick={(point) => {
                  if (!isFibonacciCircles || !fibChartPickActive) return;
                  if (point.ts === null) return;

                  if (fibPointMode === "edge") {
                    setFieldValues((prev) => ({
                      ...prev,
                      edge: stringifyPoint(point),
                    }));
                    setFibPreviewEdgePoint(null);
                    setFibPointMode(null);
                    setFibChartPickActive(false);
                    return;
                  }

                  setFieldValues((prev) => ({
                    ...prev,
                    center: stringifyPoint(point),
                  }));
                  setFibPreviewEdgePoint(null);
                  setFibPointMode("edge");
                }}
              />
            </section>

            <aside className="w-[360px] shrink-0">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isCreateMode ? (
                      <div className="mb-2">
                        <h2 className="text-sm font-semibold text-slate-100">새 전략 만들기</h2>
                        <label className="mt-2 block text-[11px] text-slate-400">전략 이름</label>
                        <input
                          type="text"
                          value={strategyName}
                          onChange={(event) => setStrategyName(event.target.value)}
                          placeholder="예: BTC 피보나치 돌파 전략"
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                        />
                        <div className="mt-3 space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                          <div>
                            <label className="block text-[11px] text-slate-400">기준점 기간(봉 수)</label>
                            <input
                              type="number"
                              min={5}
                              step={1}
                              value={anchorWindowBars}
                              onChange={(event) => setAnchorWindowBars(Math.max(5, Number(event.target.value) || 5))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">예: 최근 50봉의 최고/최저 중간점을 center로 사용</p>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400">Edge 기준</label>
                            <select
                              value={edgeReference}
                              onChange={(event) => setEdgeReference(event.target.value as "high" | "low")}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            >
                              <option value="high">최고점 거리</option>
                              <option value="low">최저점 거리</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400">롱 진입 돌파 배율</label>
                            <input
                              type="number"
                              min={0.1}
                              step={0.01}
                              value={breakoutRatio}
                              onChange={(event) => setBreakoutRatio(Math.max(0.1, Number(event.target.value) || 0.1))}
                              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            />
                            <p className="mt-1 text-[11px] text-slate-500">예: 1.26 원 상향 돌파 시 롱</p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-slate-400">익절(%)</label>
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={takeProfitPercent}
                                onChange={(event) =>
                                  setTakeProfitPercent(Math.max(0.1, Number(event.target.value) || 0.1))
                                }
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400">손절(%)</label>
                              <input
                                type="number"
                                min={0.1}
                                step={0.1}
                                value={stopLossPercent}
                                onChange={(event) => setStopLossPercent(Math.max(0.1, Number(event.target.value) || 0.1))}
                                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className={isCreateMode ? "hidden" : ""}>
                    <h2 className="text-sm font-semibold text-slate-100">
                      {showParameterEditor ? "파라미터 입력" : "Python 전략 트리"}
                    </h2>
                    {showParameterEditor ? (
                      <p className="mt-1 text-[11px] text-emerald-300">
                        선택 전략:{" "}
                        {selectedStrategy
                          ? selectedStrategy.alias && selectedStrategy.alias.trim()
                            ? selectedStrategy.alias
                            : selectedStrategy.name
                          : "-"}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">active API 湲곕컲 ?곸쐞/?섏쐞 ?대뜑 援ъ“</p>
                    )}
                    {showParameterEditor && targetFieldKey && (
                      <p className="mt-1 text-[11px] text-sky-300">차트 클릭 반영 대상: {targetFieldKey}</p>
                    )}
                    {showParameterEditor && isFibonacciCircles && fibChartPickActive && (
                      <p className="mt-1 text-[11px] text-sky-300">차트 선택 모드: {fibPointMode === "edge" ? "edge" : "center"}</p>
                    )}
                    {showParameterEditor && !targetFieldKey && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {isFibonacciCircles
                          ? "차트 선택 버튼으로 center/edge를 순서대로 선택하세요."
                          : "숫자 입력칸을 먼저 클릭한 뒤 차트를 클릭하세요."}
                      </p>
                    )}
                    </div>
                  </div>
                  {!isCreateMode && showParameterEditor && (
                    <div className="flex items-center gap-2">
                      {isFibonacciCircles && (
                        <button
                          type="button"
                          onClick={() => {
                            setFibChartPickActive(true);
                            setFibPointMode("center");
                            setTargetFieldKey(null);
                            setFibOverlaySelected(false);
                            setFibPreviewEdgePoint(null);
                          }}
                          className={`rounded-md border px-2 py-1 text-[11px] ${
                            fibChartPickActive
                              ? "border-sky-500 bg-sky-500/10 text-sky-100"
                              : "border-slate-700 text-slate-300 hover:bg-slate-800/70"
                          }`}
                        >
                          차트 선택
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowParameterEditor(false);
                          setFibPointMode(null);
                          setFibChartPickActive(false);
                          setFibOverlaySelected(false);
                          setFibPreviewEdgePoint(null);
                        }}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800/70"
                      >
                        전략 다시 선택
                      </button>
                    </div>
                  )}
                </div>

                {showParameterEditor ? (
                  <div className="mt-3 h-[460px] space-y-3 overflow-y-auto pr-1">
                    {fields.length === 0 && <p className="text-xs text-slate-500">표시할 파라미터가 없습니다.</p>}
                    {fields.map((field) => {
                      const isNumeric = field.type === "number" || field.type === "integer";
                      const value = fieldValues[field.key] ?? "";
                      const isFibPointField =
                        isFibonacciCircles && field.type === "object" && (field.key === "center" || field.key === "edge");

                      return (
                        <div key={field.key} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-300">{field.label}</span>
                            {isNumeric && (
                              <label className="flex items-center gap-1 text-[11px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={overlayEnabled[field.key] ?? false}
                                  onChange={(event) =>
                                    setOverlayEnabled((prev) => ({
                                      ...prev,
                                      [field.key]: event.target.checked,
                                    }))
                                  }
                                />
                                차트 라인
                              </label>
                            )}
                          </div>

                          {field.type === "boolean" ? (
                            <label className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                              <input
                                type="checkbox"
                                checked={value === "true"}
                                onChange={(event) =>
                                  setFieldValues((prev) => ({
                                    ...prev,
                                    [field.key]: String(event.target.checked),
                                  }))
                                }
                              />
                              활성화
                            </label>
                          ) : field.type === "array" ? (
                            <textarea
                              value={value}
                              rows={3}
                              placeholder="예: [0.236, 0.382, 0.5, 0.618] 또는 0.236,0.382,0.5,0.618"
                              onChange={(event) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            />
                          ) : (
                            <input
                              type={isNumeric ? "number" : "text"}
                              value={value}
                              min={field.minimum}
                              max={field.maximum}
                              step={field.step}
                              readOnly={isFibPointField}
                              onFocus={() => {
                                if (isNumeric) setTargetFieldKey(field.key);
                                else setTargetFieldKey(null);
                              }}
                              onClick={() => {
                                if (isNumeric) setTargetFieldKey(field.key);
                              }}
                              onChange={(event) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 h-[460px] space-y-3 overflow-y-auto pr-1">
                    {activeStrategiesQuery.isLoading && (
                      <p className="text-xs text-slate-400">전략 목록을 불러오는 중입니다...</p>
                    )}
                    {activeStrategiesQuery.isError && (
                      <p className="text-xs text-amber-300">전략 목록 조회에 실패했습니다. 백엔드 연결 상태를 확인해주세요.</p>
                    )}
                    {!activeStrategiesQuery.isLoading && !activeStrategiesQuery.isError && sortedRoots.length === 0 && (
                      <p className="text-xs text-slate-400">생성된 전략이 없습니다.</p>
                    )}
                    {sortedRoots.map(([rootName, rootNode]) => {
                      const folderEntries = Array.from(rootNode.folders.entries()).sort(([a], [b]) => a.localeCompare(b));
                      return (
                        <details key={rootName} open className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-200">{rootName}</summary>
                          <div className="mt-2 space-y-2">
                            {rootNode.rootStrategies.map((strategy) => renderStrategyButton(strategy))}
                            {folderEntries.map(([folderKey, folderNode]) => (
                              <details key={`${rootName}/${folderKey}`} className="rounded-md border border-slate-800 p-2">
                                <summary className="cursor-pointer text-xs text-slate-300">{folderNode.name}</summary>
                                <div className="mt-2 space-y-1">
                                  {folderNode.strategies.map((strategy) => renderStrategyButton(strategy))}
                                </div>
                              </details>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}

