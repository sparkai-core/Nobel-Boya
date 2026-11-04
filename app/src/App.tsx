import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { useApp } from "./lib/store";
import { BillPage } from "./pages/BillPage";
import { ChecksPage } from "./pages/ChecksPage";
import { DrawingsPage } from "./pages/DrawingsPage";
import { ExportPage } from "./pages/ExportPage";
import { GeneratePage } from "./pages/GeneratePage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RatesPage } from "./pages/RatesPage";
import { StartPage } from "./pages/StartPage";

function RequireBill({ children }: { children: ReactNode }) {
  const generated = useApp((s) => s.generated);
  return generated ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/generate" element={<GeneratePage />} />
      <Route
        element={
          <RequireBill>
            <Shell />
          </RequireBill>
        }
      >
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/bill" element={<BillPage />} />
        <Route path="/drawings" element={<DrawingsPage />} />
        <Route path="/drawings/:sheetId" element={<DrawingsPage />} />
        <Route path="/checks" element={<ChecksPage />} />
        <Route path="/checks/:checkId" element={<ChecksPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
