import { BitcoinChart } from "@/components/charts/BitcoinChart";
import { MainLayout } from "@/components/layout/MainLayout";

export function HomePage() {
  return (
    <MainLayout>
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-bold tracking-tight">자동매매 전략 플랫폼</h1>
        <p className="mt-2 text-sm text-slate-300">
          전략 설정, 전략 탐색, 실시간 차트 확인을 한 곳에서 진행할 수 있는 메인 화면입니다.
        </p>
      </section>

      <BitcoinChart />

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold">사이트 설명</h2>
        <p className="mt-2 text-sm text-slate-400">
          서비스 소개 문구는 추후 확정되면 이 영역에 반영하면 됩니다.
        </p>
      </section>
    </MainLayout>
  );
}

