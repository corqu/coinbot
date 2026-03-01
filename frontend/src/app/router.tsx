import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { StrategySettingsPage } from "@/pages/StrategySettingsPage";
import { OpenStrategiesPage } from "@/pages/OpenStrategiesPage";
import { MyPage } from "@/pages/MyPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/api-lab" element={<DashboardPage />} />
      <Route path="/strategies/settings" element={<StrategySettingsPage />} />
      <Route path="/strategies/open" element={<OpenStrategiesPage />} />
      <Route path="/my-page" element={<MyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
