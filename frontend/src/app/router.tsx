import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { StrategySettingsPage } from "@/pages/StrategySettingsPage";
import { OpenStrategiesPage } from "@/pages/OpenStrategiesPage";
import { MyPage } from "@/pages/MyPage";
import { useAuthStore } from "@/stores/authStore";

export function AppRouter() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<DashboardPage />} />
      <Route path="/api-lab" element={<Navigate to="/login" replace />} />
      <Route path="/strategies/settings" element={<StrategySettingsPage />} />
      <Route path="/strategies/open" element={<OpenStrategiesPage />} />
      <Route path="/my-page" element={isAuthenticated ? <MyPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
