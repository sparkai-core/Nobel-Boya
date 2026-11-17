import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/revamp.css";
import "./styles/kit.css";
import "./styles/shell-ops.css";
import "./styles/mod-proc-sourcing.css";
import "./styles/mod-proc-orders.css";
import "./styles/mod-pm-schedule.css";
import "./styles/mod-pm-control.css";
import "./styles/mod-pm-records.css";
import "./styles/mod-vendor.css";
import "./styles/mod-proc-home.css";
import "./styles/mod-pm-planning.css";
import "./styles/mod-pm-progress.css";
import "./styles/mod-pm-site.css";
import "./styles/mod-proc-money.css";
import "./styles/mod-proc-plan.css";
import "./styles/mod-proc-purchasing.css";
import "./styles/polish.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
