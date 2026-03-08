import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/features/auth/constants";

type AuthStore = {
  isAuthenticated: boolean;
  loginExpiresAt: number | null;
  sessionExpiredNotice: boolean;
  setAuthenticated: (value: boolean) => void;
  setLoginSession: (durationSeconds?: number) => void;
  clearAuth: () => void;
  markSessionExpired: () => void;
  clearSessionExpiredNotice: () => void;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      loginExpiresAt: null,
      sessionExpiredNotice: false,
      setAuthenticated: (value) =>
        set((state) => ({
          ...state,
          isAuthenticated: value,
          loginExpiresAt: value ? state.loginExpiresAt : null,
        })),
      setLoginSession: (durationSeconds = ACCESS_TOKEN_TTL_SECONDS) =>
        set({
          isAuthenticated: true,
          loginExpiresAt: Date.now() + durationSeconds * 1000,
          sessionExpiredNotice: false,
        }),
      clearAuth: () =>
        set({
          isAuthenticated: false,
          loginExpiresAt: null,
          sessionExpiredNotice: false,
        }),
      markSessionExpired: () =>
        set({
          isAuthenticated: false,
          loginExpiresAt: null,
          sessionExpiredNotice: true,
        }),
      clearSessionExpiredNotice: () => set({ sessionExpiredNotice: false }),
    }),
    {
      name: "autobot-auth",
    },
  ),
);

