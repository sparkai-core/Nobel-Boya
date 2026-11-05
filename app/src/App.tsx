import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { BillPage } from "./pages/BillPage";
import { ChecksPage } from "./pages/ChecksPage";
import { DrawingsPage } from "./pages/DrawingsPage";
import { ExportPage } from "./pages/ExportPage";
import { GeneratePage } from "./pages/GeneratePage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RatesPage } from "./pages/RatesPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/generate" element={<GeneratePage />} />
      <Route element={<Shell />}>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/bill" element={<BillPage />} />
        <Route path="/drawings" element={<DrawingsPage />} />
        <Route path="/drawings/:sheetId" element={<DrawingsPage />} />
        <Route path="/checks" element={<ChecksPage />} />
        <Route path="/checks/:checkId" element={<ChecksPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/export" element={<ExportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
