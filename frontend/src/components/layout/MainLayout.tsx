import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { authApi } from "@/features/api";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/features/auth/constants";
import { useAuthStore } from "@/stores/authStore";

const menuItems = [
  { to: "/strategies/settings", label: "전략설정" },
  { to: "/strategies/open", label: "오픈 전략 보기" },
];

export function MainLayout({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    isAuthenticated,
    loginExpiresAt,
    sessionExpiredNotice,
    clearAuth,
    markSessionExpired,
    clearSessionExpiredNotice,
  } = useAuthStore();

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !loginExpiresAt) return;
    if (Date.now() >= loginExpiresAt) {
      markSessionExpired();
    }
  }, [isAuthenticated, loginExpiresAt, now, markSessionExpired]);

  useEffect(() => {
    if (!sessionExpiredNotice) return;
    window.alert("로그아웃되었습니다.");
    clearSessionExpiredNotice();
  }, [sessionExpiredNotice, clearSessionExpiredNotice]);

  const remainingLabel = useMemo(() => {
    if (!isAuthenticated || !loginExpiresAt) return null;
    const remainMs = Math.max(0, loginExpiresAt - now);
    const totalSeconds = Math.floor(remainMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [isAuthenticated, loginExpiresAt, now]);

  const handleLogout = async () => {
    try {
      await authApi.signOut();
    } finally {
      clearAuth();
      navigate("/");
    }
  };

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      await authApi.refreshToken();
      useAuthStore.getState().setLoginSession(ACCESS_TOKEN_TTL_SECONDS);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "토큰 갱신 중 오류가 발생했습니다.";
      window.alert(message);
    } finally {
      setIsRefreshing(false);
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
                {remainingLabel ? (
                  <span className="flex h-8 items-center text-sm font-semibold leading-none text-sky-200">
                    {remainingLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                  className="rounded-md border border-sky-800 bg-sky-900/30 p-2 text-sky-200 hover:bg-sky-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Access Token Refresh"
                  title="시간 연장"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M20 11a8 8 0 1 0 2 5.3" />
                    <path d="M20 4v7h-7" />
                  </svg>
                </button>
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
