import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { P, setActiveDataset } from "./data";
import { useApp } from "./lib/store";
import { fetchProject } from "./lib/api";
import { BillPage } from "./pages/BillPage";
import { ChecksPage } from "./pages/ChecksPage";
import { DrawingsPage } from "./pages/DrawingsPage";
import { ExportPage } from "./pages/ExportPage";
import { GeneratePage } from "./pages/GeneratePage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
const ProjectsPage = lazy(() => import("./pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })));
import { RatesPage } from "./pages/RatesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { opsRoutes } from "./ops/routes";
import { PageSkeleton } from "./components/kit/extra";
const VendorPortal = lazy(() => import("./pages/vendor/VendorPortal").then((m) => ({ default: m.VendorPortal })));

export function App() {
  const lang = useApp((s) => s.lang);
  const activeProjectId = useApp((s) => s.activeProjectId);
  const token = useApp((s) => s.token);
  const bumpProjectRev = useApp((s) => s.bumpProjectRev);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Load the saved project from the server after a browser refresh
  useEffect(() => {
    if (activeProjectId && token) {
      fetchProject(activeProjectId)
        .then((res) => {
          if (res && res.data) {
            setActiveDataset(res.data);
            bumpProjectRev();
          }
        })
        .catch(() => {});
    }
  }, [activeProjectId, token, bumpProjectRev]);
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/vendor/*" element={<Suspense fallback={null}><VendorPortal /></Suspense>} />
      <Route path="/generate" element={<GeneratePage />} />
      <Route path={`${P}/generate`} element={<GeneratePage />} />
      <Route element={<Shell />}>
        <Route path="/projects" element={<Suspense fallback={<PageSkeleton />}><ProjectsPage /></Suspense>} />
                                <Route path="/settings" element={<SettingsPage />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/bill" element={<BillPage />} />
        <Route path="/drawings" element={<DrawingsPage />} />
        <Route path="/drawings/:sheetId" element={<DrawingsPage />} />
        <Route path="/checks" element={<ChecksPage />} />
        <Route path="/checks/:checkId" element={<ChecksPage />} />
        <Route path="/rates" element={<RatesPage />} />
        <Route path="/export" element={<ExportPage />} />

        <Route path={P} element={<Navigate to="/overview" replace />} />
        <Route path={`${P}/bill`} element={<BillPage />} />
        <Route path={`${P}/drawings`} element={<DrawingsPage />} />
        <Route path={`${P}/drawings/:sheetId`} element={<DrawingsPage />} />
        <Route path={`${P}/checks`} element={<ChecksPage />} />
        <Route path={`${P}/checks/:checkId`} element={<ChecksPage />} />
        <Route path={`${P}/overview`} element={<OverviewPage />} />
        <Route path={`${P}/rates`} element={<RatesPage />} />
        <Route path={`${P}/export`} element={<ExportPage />} />
        {opsRoutes()}

      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
