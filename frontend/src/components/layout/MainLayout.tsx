import type { PropsWithChildren } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { authApi } from "@/features/api";
import { useAuthStore } from "@/stores/authStore";

const menuItems = [
  { to: "/strategies/settings", label: "전략설정" },
  { to: "/strategies/open", label: "오픈 전략 보기" },
];

export function MainLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthenticated } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authApi.signOut();
    } finally {
      setAuthenticated(false);
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen overflow-x-auto text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="rounded-lg border border-sky-700/40 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-200"
            >
              스토캠
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm transition ${
                      isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/my-page")}
                  className="rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-200 hover:bg-slate-800"
                  aria-label="My Page"
                  title="My Page"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.8-3.6 5-5.5 8-5.5s6.2 1.9 8 5.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-md border border-rose-800 bg-rose-900/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/50"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
                >
                  회원가입
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
