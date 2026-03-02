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

type FolderNode = {
  name: string;
  files: string[];
};

type RootNode = {
  root: string[];
  folders: FolderNode[];
};

const pythonStrategyTree: Record<string, RootNode> = {
  basic_startegy: {
    root: ["moving_average.py", "rsi.py", "volume.py"],
    folders: [
      {
        name: "fibonacci",
        files: [
          "fibonacci_channel.py",
          "fibonacci_circles.py",
          "fibonacci_retracement.py",
          "fibonacci_speed_resistance_arcs.py",
          "fibonacci_speed_resistance_fan.py",
          "fibonacci_spiral.py",
          "fibonacci_time_zones.py",
          "fibonacci_wedge.py",
          "trend_fibonacci_extension.py",
          "trend_fibonacci_time.py",
        ],
      },
      {
        name: "gann",
        files: ["gann_box.py", "gann_fan.py", "gann_square.py"],
      },
      {
        name: "indicators",
        files: [
          "accumulation_distribution.py",
          "bollinger_bands.py",
          "directional_movement.py",
          "donchian_channel.py",
          "double_exponential_moving_average.py",
          "guppy_multiple_moving_average.py",
          "historical_volatility.py",
          "know_sure_thing.py",
          "rate_of_change.py",
          "relative_vigor_index.py",
          "stochastic_oscillator.py",
          "weighted_moving_average.py",
        ],
      },
      {
        name: "pitchfork",
        files: [
          "inside_pitchfork.py",
          "modified_schiff_pitchfork.py",
          "pitchfork.py",
          "pitchfork_fan.py",
          "schiff_pitchfork.py",
        ],
      },
    ],
  },
  applied_startegy: {
    root: ["ma_rsi_volume_strategy.py"],
    folders: [
      {
        name: "fibonacci",
        files: [
          "fibonacci_channel_strategy.py",
          "fibonacci_circles_strategy.py",
          "fibonacci_retracement_strategy.py",
          "fibonacci_speed_resistance_arcs_strategy.py",
          "fibonacci_speed_resistance_fan_strategy.py",
          "fibonacci_spiral_strategy.py",
          "fibonacci_time_zones_strategy.py",
          "fibonacci_wedge_strategy.py",
          "trend_fibonacci_extension_strategy.py",
          "trend_fibonacci_time_strategy.py",
        ],
      },
      {
        name: "gann",
        files: ["gann_box_breakout_strategy.py", "gann_fan_breakout_strategy.py", "gann_square_quarter_strategy.py"],
      },
      {
        name: "pitchfork",
        files: [
          "inside_pitchfork_reentry_strategy.py",
          "modified_schiff_pitchfork_breakout_strategy.py",
          "pitchfork_breakout_strategy.py",
          "pitchfork_fan_breakout_strategy.py",
          "schiff_pitchfork_breakout_strategy.py",
        ],
      },
    ],
  },
};

const fallbackStrategies: StrategySummary[] = [
  {
    id: 9001,
    code: "moving_average",
    name: "Moving Average",
    source: "python",
    parameterSchemaJson: JSON.stringify({
      type: "object",
      properties: {
        short_period: { type: "integer", default: 7, minimum: 2, maximum: 200 },
        long_period: { type: "integer", default: 21, minimum: 5, maximum: 400 },
      },
    }),
    isActive: true,
    version: "0.1.0",
  },
  {
    id: 9002,
    code: "rsi",
    name: "RSI",
    source: "python",
    parameterSchemaJson: JSON.stringify({
      type: "object",
      properties: {
        period: { type: "integer", default: 14, minimum: 2, maximum: 100 },
        oversold: { type: "number", default: 30, minimum: 1, maximum: 50 },
        overbought: { type: "number", default: 70, minimum: 50, maximum: 99 },
      },
    }),
    isActive: true,
    version: "0.1.0",
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

function fileNameToCode(fileName: string): string {
  return fileName.replace(/\.py$/i, "");
}

function buildInitialValues(fields: StrategyField[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const field of fields) {
    next[field.key] = field.defaultValue;
  }
  return next;
}

export function StrategySettingsPage() {
  const activeStrategiesQuery = useActiveStrategies(true);
  const strategies = activeStrategiesQuery.data && activeStrategiesQuery.data.length > 0
    ? activeStrategiesQuery.data
    : fallbackStrategies;

  const [selectedPath, setSelectedPath] = useState("basic_startegy/moving_average.py");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [overlayEnabled, setOverlayEnabled] = useState<Record<string, boolean>>({});

  const selectedCode = useMemo(() => {
    const leaf = selectedPath.split("/").at(-1) ?? "";
    return fileNameToCode(leaf);
  }, [selectedPath]);

  const selectedStrategy = useMemo(() => {
    return (
      strategies.find((strategy) => strategy.code === selectedCode) ??
      strategies.find((strategy) => strategy.code === selectedCode.replace(/_strategy$/i, "")) ??
      null
    );
  }, [selectedCode, strategies]);

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
        id: `${selectedPath}-${field.key}`,
        label: field.label,
        value,
        color: overlayColors[index % overlayColors.length],
        enabled: true,
      });
      return acc;
    }, []);
  }, [fieldValues, fields, overlayEnabled, selectedPath]);

  const renderFileButton = (basePath: string, file: string) => {
    const path = `${basePath}/${file}`;
    const selected = selectedPath === path;
    return (
      <button
        key={path}
        type="button"
        onClick={() => setSelectedPath(path)}
        className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
          selected
            ? "border-sky-500 bg-sky-500/10 text-sky-100"
            : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/70"
        }`}
      >
        {file}
      </button>
    );
  };

  return (
    <MainLayout>
      <section className="space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h1 className="text-xl font-semibold">전략 설정</h1>
          <p className="mt-2 text-sm text-slate-400">가운데는 BTC 차트, 오른쪽은 파이썬 전략 폴더 트리와 파라미터 입력 영역입니다.</p>
          {activeStrategiesQuery.isError && (
            <p className="mt-2 text-xs text-amber-300">전략 API 실패로 임시 전략 정보를 사용 중입니다.</p>
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
              <p className="mt-1 text-xs text-slate-400">상위 폴더 / 하위 폴더 구조로 표시</p>

              <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {Object.entries(pythonStrategyTree).map(([rootName, rootNode]) => (
                  <details key={rootName} open className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-200">{rootName}</summary>
                    <div className="mt-2 space-y-2">
                      {rootNode.root.map((file) => renderFileButton(rootName, file))}
                      {rootNode.folders.map((folder) => (
                        <details key={`${rootName}/${folder.name}`} className="rounded-md border border-slate-800 p-2">
                          <summary className="cursor-pointer text-xs text-slate-300">{folder.name}</summary>
                          <div className="mt-2 space-y-1">
                            {folder.files.map((file) => renderFileButton(`${rootName}/${folder.name}`, file))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-semibold text-slate-100">파라미터 입력</h2>
              <p className="mt-1 text-xs text-slate-400">{selectedPath}</p>
              {selectedStrategy ? (
                <p className="mt-1 text-[11px] text-emerald-300">연결된 전략: {selectedStrategy.name}</p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-300">API 전략 코드와 매칭되지 않아 파라미터를 표시할 수 없습니다.</p>
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
