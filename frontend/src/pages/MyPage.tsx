import { MainLayout } from "@/components/layout/MainLayout";

export function MyPage() {
  return (
    <MainLayout>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-xl font-semibold">마이페이지</h1>
        <p className="mt-2 text-sm text-slate-400">사용자 정보 및 계정 관리 영역은 다음 단계에서 구현 예정입니다.</p>
      </section>
    </MainLayout>
  );
}

