import { FormEvent, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { authApi, strategyApi } from "@/features/api";
import type { StrategyGroupBacktestPayload, StrategyGroupSavePayload } from "@/features/strategy/types";
import { useAuthStore } from "@/stores/authStore";

type CallLog = {
  id: number;
  endpoint: string;
  ok: boolean;
  payload?: unknown;
  result?: unknown;
  error?: string;
  calledAt: string;
};

const defaultSavePayload: StrategyGroupSavePayload = {
  name: "Sample Group",
  description: "frontend api integration",
  isActive: false,
  items: [
    {
      strategyId: 1,
      paramsJson: "{}",
      sortOrder: 0,
      enabled: true,
    },
  ],
};

const defaultBacktestPayload: StrategyGroupBacktestPayload = {
  symbol: "BTCUSDT",
  interval: "15",
  bars: 500,
  tradeQty: 0.001,
  strategyIds: [1],
};

function formatNow(): string {
  return new Date().toLocaleTimeString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function DashboardPage() {
  const { setAuthenticated } = useAuthStore();
  const [logs, setLogs] = useState<CallLog[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [provider, setProvider] = useState("google");
  const [providerId, setProviderId] = useState("");

  const [strategyGroupId, setStrategyGroupId] = useState("1");
  const [isActive, setIsActive] = useState(false);
  const [savePayloadText, setSavePayloadText] = useState(JSON.stringify(defaultSavePayload, null, 2));
  const [backtestPayloadText, setBacktestPayloadText] = useState(JSON.stringify(defaultBacktestPayload, null, 2));

  const pushLog = (log: Omit<CallLog, "id" | "calledAt">) => {
    setLogs((prev) => [
      {
        id: prev.length + 1,
        calledAt: formatNow(),
        ...log,
      },
      ...prev,
    ]);
  };

  const runCall = async (endpoint: string, fn: () => Promise<unknown>, payload?: unknown) => {
    try {
      const result = await fn();
      if (endpoint === "POST /api/auth/sign-in") setAuthenticated(true);
      if (endpoint === "POST /api/auth/sign-out") setAuthenticated(false);
      pushLog({ endpoint, ok: true, payload, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      pushLog({ endpoint, ok: false, payload, error: message });
    }
  };

  const runJsonCall = async <T,>(
    endpoint: string,
    raw: string,
    fn: (payload: T) => Promise<unknown>,
    payloadMapper?: (payload: T) => unknown,
  ) => {
    try {
      const payload = parseJson<T>(raw);
      await runCall(endpoint, () => fn(payload), payloadMapper ? payloadMapper(payload) : payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      pushLog({ endpoint, ok: false, error: message });
    }
  };

  const handleNoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const numericGroupId = Number(strategyGroupId);

  return (
    <MainLayout>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-base font-semibold">Auth API</h2>
            <form className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2" onSubmit={handleNoSubmit}>
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="new password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm md:col-span-2"
                placeholder="providerId"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
              />
            </form>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/email/send", () => authApi.sendVerificationEmail({ email }), { email })}>email/send</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/email/verify", () => authApi.verifyEmailCode({ email, code }), { email, code })}>email/verify</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/password/reset/send", () => authApi.sendPasswordResetCode({ email }), { email })}>reset/send</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/password/reset/confirm", () => authApi.confirmPasswordReset({ email, code, newPassword }), { email, code, newPassword })}>reset/confirm</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/sign-up", () => authApi.signUp({ email, password, nickname }), { email, password, nickname })}>sign-up</button>
              <button className="rounded bg-emerald-600 px-2 py-2" onClick={() => runCall("POST /api/auth/sign-in", () => authApi.signIn({ email, password }), { email, password })}>sign-in</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("POST /api/auth/oauth2/link", () => authApi.linkSocialAccount({ email, password, provider, providerId }), { email, password, provider, providerId })}>oauth2/link</button>
              <button className="rounded bg-amber-600 px-2 py-2" onClick={() => runCall("POST /api/auth/refresh", () => authApi.refreshToken())}>refresh</button>
              <button className="rounded bg-rose-600 px-2 py-2" onClick={() => runCall("POST /api/auth/sign-out", () => authApi.signOut())}>sign-out</button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-base font-semibold">Strategy API</h2>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="strategyGroupId"
                value={strategyGroupId}
                onChange={(event) => setStrategyGroupId(event.target.value)}
              />
              <label className="flex items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                isActive
              </label>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("GET /api/strategies/active", () => strategyApi.getActiveStrategies())}>active</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall("GET /api/strategies/groups/me", () => strategyApi.getMyStrategyGroups())}>groups/me</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall(`GET /api/strategies/groups/${numericGroupId}`, () => strategyApi.getStrategyGroup(numericGroupId), { strategyGroupId: numericGroupId })}>groups/{`{id}`}</button>
              <button className="rounded bg-sky-600 px-2 py-2" onClick={() => runCall(`PATCH /api/strategies/groups/${numericGroupId}/active`, () => strategyApi.updateGroupActive(numericGroupId, { isActive }), { strategyGroupId: numericGroupId, isActive })}>groups/active</button>
              <button
                className="rounded bg-sky-600 px-2 py-2"
                onClick={() =>
                  runJsonCall<StrategyGroupSavePayload>(
                    "POST /api/strategies/groups/save",
                    savePayloadText,
                    (payload) => strategyApi.saveStrategyGroup(payload),
                  )
                }
              >
                groups/save
              </button>
              <button
                className="rounded bg-sky-600 px-2 py-2"
                onClick={() =>
                  runJsonCall<StrategyGroupBacktestPayload>(
                    `POST /api/strategies/groups/${numericGroupId}/backtest`,
                    backtestPayloadText,
                    (payload) => strategyApi.runGroupBacktest(numericGroupId, payload),
                    (payload) => ({ strategyGroupId: numericGroupId, ...payload }),
                  )
                }
              >
                groups/backtest
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-xs text-slate-400">save payload JSON</label>
              <textarea
                className="min-h-36 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                value={savePayloadText}
                onChange={(event) => setSavePayloadText(event.target.value)}
              />
              <label className="text-xs text-slate-400">backtest payload JSON</label>
              <textarea
                className="min-h-32 rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                value={backtestPayloadText}
                onChange={(event) => setBacktestPayloadText(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Call Logs</h2>
            <button className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => setLogs([])}>
              clear
            </button>
          </div>
          <div className="space-y-2">
            {logs.length === 0 && <p className="text-sm text-slate-400">아직 호출한 API가 없습니다.</p>}
            {logs.map((log) => (
              <article key={log.id} className="rounded border border-slate-800 bg-slate-950/80 p-2 text-xs">
                <p className={log.ok ? "text-emerald-300" : "text-rose-300"}>
                  [{log.calledAt}] {log.ok ? "SUCCESS" : "FAIL"}
                </p>
                <p className="mt-1 text-slate-200">{log.endpoint}</p>
                {log.payload !== undefined && (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-slate-400">
                    payload: {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
                {log.result !== undefined && (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-sky-200">
                    result: {JSON.stringify(log.result, null, 2)}
                  </pre>
                )}
                {log.error && <p className="mt-1 text-rose-300">error: {log.error}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
