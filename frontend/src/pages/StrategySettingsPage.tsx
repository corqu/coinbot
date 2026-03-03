import { useEffect, useMemo, useState } from "react";
import { BitcoinChart, type ChartOverlay } from "@/components/charts/BitcoinChart";
import { MainLayout } from "@/components/layout/MainLayout";
import { useActiveStrategies } from "@/features/strategy/hooks";
import type { StrategySummary } from "@/features/strategy/types";

type SchemaFieldType = "number" | "integer" | "string" | "boolean";

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

const fallbackStrategies: StrategySummary[] = [
  {
    id: 9001,
    code: "ma_rsi_volume_v1",
    name: "MA RSI Volume V1",
    alias: "MA+RSI+Volume",
    source: "app.strategy.applied_startegy.ma_rsi_volume_strategy",
    parameterSchemaJson: JSON.stringify({
      type: "object",
      properties: {
        short_window: { type: "integer", default: 7, minimum: 2, maximum: 200 },
        long_window: { type: "integer", default: 21, minimum: 5, maximum: 400 },
      },
    }),
    isActive: true,
    version: "v1",
  },
  {
    id: 9002,
    code: "pitchfork_breakout_v1",
    name: "Pitchfork Breakout V1",
    alias: "Pitchfork Breakout",
    source: "app.strategy.applied_startegy.pitchfork.pitchfork_breakout_strategy",
    parameterSchemaJson: JSON.stringify({
      type: "object",
      properties: {
        breakout_buffer: { type: "number", default: 0.001, minimum: 0, maximum: 1 },
      },
    }),
    isActive: true,
    version: "v1",
  },
];

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
        rawType === "integer" || rawType === "number" || rawType === "boolean" ? rawType : "string";

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
  for (const field of fields) {
    next[field.key] = field.defaultValue;
  }
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

export function StrategySettingsPage() {
  const activeStrategiesQuery = useActiveStrategies(true);
  const strategies =
    activeStrategiesQuery.data && activeStrategiesQuery.data.length > 0
      ? activeStrategiesQuery.data
      : fallbackStrategies;

  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [overlayEnabled, setOverlayEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (strategies.length === 0) return;
    if (selectedStrategyId === null || !strategies.some((strategy) => strategy.id === selectedStrategyId)) {
      setSelectedStrategyId(strategies[0].id);
    }
  }, [selectedStrategyId, strategies]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
    [selectedStrategyId, strategies],
  );

  const selectedPath = useMemo(() => {
    if (!selectedStrategy) return "-";
    const parts = toStrategyPathParts(selectedStrategy.source, selectedStrategy.code);
    return `${parts.root}/${parts.folder ? `${parts.folder}/` : ""}${parts.file}`;
  }, [selectedStrategy]);

  const fields = useMemo(
    () => (selectedStrategy ? readFieldsFromSchema(selectedStrategy.parameterSchemaJson) : []),
    [selectedStrategy],
  );

  useEffect(() => {
    setFieldValues(buildInitialValues(fields));

    const nextOverlayEnabled: Record<string, boolean> = {};
    for (const field of fields) {
      nextOverlayEnabled[field.key] = false;
    }
    setOverlayEnabled(nextOverlayEnabled);
  }, [fields]);

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
        onClick={() => setSelectedStrategyId(strategy.id)}
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
          <p className="mt-2 text-sm text-slate-400">왼쪽 차트, 오른쪽 Python 전략 트리와 파라미터 설정</p>
          {activeStrategiesQuery.isError && (
            <p className="mt-2 text-xs text-amber-300">/api/strategies/active 호출 실패로 임시 데이터를 표시 중입니다.</p>
          )}
        </header>

        <div className="overflow-x-auto">
          <div className="flex min-w-[1140px] items-start gap-4">
            <section className="w-[760px] shrink-0">
              <BitcoinChart overlays={chartOverlays} />
            </section>

            <aside className="w-[360px] shrink-0 space-y-4">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-semibold text-slate-100">Python 전략 트리</h2>
                <p className="mt-1 text-xs text-slate-400">active API 기반 상위/하위 폴더 구조</p>

                <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
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
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h2 className="text-sm font-semibold text-slate-100">파라미터 입력</h2>
                <p className="mt-1 text-xs text-slate-400">{selectedPath}</p>
                {selectedStrategy ? (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    선택 전략: {selectedStrategy.alias && selectedStrategy.alias.trim() ? selectedStrategy.alias : selectedStrategy.name}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-amber-300">전략을 선택해 주세요.</p>
                )}

                <div className="mt-3 space-y-3">
                  {fields.length === 0 && <p className="text-xs text-slate-500">표시할 파라미터가 없습니다.</p>}
                  {fields.map((field) => {
                    const isNumeric = field.type === "number" || field.type === "integer";
                    const value = fieldValues[field.key] ?? "";

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
                        ) : (
                          <input
                            type={isNumeric ? "number" : "text"}
                            value={value}
                            min={field.minimum}
                            max={field.maximum}
                            step={field.step}
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
              </section>
            </aside>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
