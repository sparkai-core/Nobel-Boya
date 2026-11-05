import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell";
import { P } from "./data";
import { useApp } from "./lib/store";
import { BillPage } from "./pages/BillPage";
import { ChecksPage } from "./pages/ChecksPage";
import { DrawingsPage } from "./pages/DrawingsPage";
import { ExportPage } from "./pages/ExportPage";
import { GeneratePage } from "./pages/GeneratePage";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RatesPage } from "./pages/RatesPage";
import { SettingsPage } from "./pages/SettingsPage";

function RequireUser({ children }: { children: ReactNode }) {
  const user = useApp((s) => s.user);
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireBill({ children }: { children: ReactNode }) {
  const generated = useApp((s) => s.generated);
  return generated ? <>{children}</> : <Navigate to={`${P}/generate`} replace />;
}

function Home() {
  const user = useApp((s) => s.user);
  return <Navigate to={user ? "/projects" : "/login"} replace />;
}

export function App() {
  const lang = useApp((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path={`${P}/generate`}
        element={
          <RequireUser>
            <GeneratePage />
          </RequireUser>
        }
      />
      <Route
        element={
          <RequireUser>
            <Shell />
          </RequireUser>
        }
      >
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path={P} element={<Navigate to={`${P}/overview`} replace />} />
        <Route path={`${P}/bill`} element={<RequireBill><BillPage /></RequireBill>} />
        <Route path={`${P}/drawings`} element={<RequireBill><DrawingsPage /></RequireBill>} />
        <Route path={`${P}/drawings/:sheetId`} element={<RequireBill><DrawingsPage /></RequireBill>} />
        <Route path={`${P}/checks`} element={<RequireBill><ChecksPage /></RequireBill>} />
        <Route path={`${P}/checks/:checkId`} element={<RequireBill><ChecksPage /></RequireBill>} />
        <Route path={`${P}/overview`} element={<RequireBill><OverviewPage /></RequireBill>} />
        <Route path={`${P}/rates`} element={<RequireBill><RatesPage /></RequireBill>} />
        <Route path={`${P}/export`} element={<RequireBill><ExportPage /></RequireBill>} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
