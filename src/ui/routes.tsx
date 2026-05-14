import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import Assets from "./pages/Assets";
import CalendarPage from "./pages/Calendar";
import Dashboard from "./pages/Dashboard";
import Heatmap from "./pages/Heatmap";
import PricingRules from "./pages/PricingRules";
import Login from "./pages/Login";
import Forbidden from "./pages/Forbidden";
import MarketIntelligence from "./pages/MarketIntelligence";
import CompetitiveSet from "./pages/CompetitiveSet";
import RevenueOptimizer from "./pages/RevenueOptimizer";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppShell from "./layout/AppShell";

function AuthedLayout({ title }: { title: string }) {
  return (
    <AppShell title={title}>
      <Outlet />
    </AppShell>
  );
}

export default function AppRoutes({ title }: { title: string }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forbidden" element={<Forbidden />} />

      <Route element={<ProtectedRoute allowRoles={["Admin", "Operator", "Owner"]} />}>
        <Route element={<AuthedLayout title={title} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<ProtectedRoute allowRoles={["Admin", "Operator"]} />}>
            <Route path="/assets" element={<Assets />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/market-intelligence" element={<MarketIntelligence />} />
            <Route path="/competitive-set" element={<CompetitiveSet />} />
            <Route path="/revenue-optimizer" element={<RevenueOptimizer />} />
            <Route path="/pricing/rules" element={<PricingRules />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
