import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useMyStrategyGroups } from "@/features/strategy/hooks";

export function StrategySettingsPage() {
  const navigate = useNavigate();
  const groupQuery = useMyStrategyGroups(true);
  const groups = groupQuery.data ?? [];

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => a.name.localeCompare(b.name));
  }, [groups]);

  return (
    <MainLayout>
      <section className="space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">내 전략</h1>
              <p className="mt-2 text-sm text-slate-400">내 전략 그룹을 확인하고 새 전략을 추가할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/strategies/settings/new")}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              새 전략
            </button>
          </div>
        </header>

        {groupQuery.isLoading && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
            전략 그룹 목록을 불러오는 중입니다...
          </section>
        )}

        {groupQuery.isError && (
          <section className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-5 text-sm text-amber-200">
            전략 그룹 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </section>
        )}

        {!groupQuery.isLoading && !groupQuery.isError && sortedGroups.length === 0 && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
            등록된 전략 그룹이 없습니다. 새 전략 버튼으로 전략을 추가해보세요.
          </section>
        )}

        {!groupQuery.isLoading && !groupQuery.isError && sortedGroups.length > 0 && (
          <section className="grid gap-3">
            {sortedGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => navigate(`/strategies/settings/${group.id}`)}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{group.name}</p>
                    <p className="mt-1 text-xs text-slate-400">전략 수: {group.items.length}</p>
                    {group.description ? <p className="mt-1 text-xs text-slate-500">{group.description}</p> : null}
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                      group.isActive ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700/60 text-slate-300"
                    }`}
                  >
                    {group.isActive ? "활성" : "비활성"}
                  </span>
                </div>
              </button>
            ))}
          </section>
        )}
      </section>
    </MainLayout>
  );
}
