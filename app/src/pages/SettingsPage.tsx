import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, RotateCcw } from "lucide-react";
import { P } from "../data";
import { useT } from "../lib/i18n";
import { DEFAULT_MARKUPS, useApp } from "../lib/store";
import { PageHead } from "../components/Shell";

export function SettingsPage() {
  const t = useT();
  const navigate = useNavigate();
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const rates = useApp((s) => s.rates);
  const qty = useApp((s) => s.qty);
  const fixes = useApp((s) => s.fixes);
  const markups = useApp((s) => s.markups);
  const [done, setDone] = useState(false);

  const nRates = Object.keys(rates).length;
  const nQty = Object.keys(qty).length;
  const nFix = Object.values(fixes).filter(Boolean).length;
  const markupEdited = (Object.keys(markups) as (keyof typeof markups)[]).some((k) => markups[k] !== DEFAULT_MARKUPS[k]);
  const anything = nRates + nQty + nFix > 0 || markupEdited;

  const reset = () => {
    useApp.setState({ rates: {}, qty: {}, fixes: {}, markups: DEFAULT_MARKUPS });
    setDone(true);
  };

  return (
    <div className="page settings">
      <PageHead title={t("Settings")} lead={t("Account, language and the data kept in this browser.")} />

      <section className="card settings-card">
        <header className="card-head">
          <h2>{t("Account")}</h2>
        </header>
        <div className="settings-row">
          <div>
            <span className="figure-label">{t("Signed in as")}</span>
            <strong>{user}</strong>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              signOut();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={15} /> {t("Sign out")}
          </button>
        </div>
      </section>

      <section className="card settings-card">
        <header className="card-head">
          <h2>{t("Interface language")}</h2>
        </header>
        <div className="settings-row">
          <p className="muted small">{t("The whole platform switches language. Line descriptions and source quotes keep the original Azerbaijani text where it is printed.")}</p>
          <div className="segmented" role="group" aria-label={t("Interface language")}>
            <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              English
            </button>
            <button type="button" aria-pressed={lang === "az"} onClick={() => setLang("az")}>
              Azərbaycanca
            </button>
          </div>
        </div>
      </section>

      <section className="card settings-card">
        <header className="card-head">
          <h2>{t("Project data")}</h2>
        </header>
        <div className="settings-row">
          <div>
            <p className="muted small">{t("Rates, mark-ups, quantity overrides and applied corrections are saved in this browser.")}</p>
            <p className="small num-inline">{t("{r} edited rates, {q} quantity overrides, {f} corrections", { r: nRates, q: nQty, f: nFix })}</p>
            {done ? <p className="ok-text small">{t("Edits were reset.")}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost" onClick={reset} disabled={!anything}>
            <RotateCcw size={15} /> {t("Reset all edits")}
          </button>
        </div>
        <div className="settings-row">
          <p className="muted small">{t("Plays the generation sequence and opens the project.")}</p>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`${P}/generate`)}>
            {t("Run the generation again")}
          </button>
        </div>
      </section>

      <section className="card settings-card">
        <header className="card-head">
          <h2>{t("About")}</h2>
        </header>
        <div className="settings-row">
          <p className="muted small">{t("Quantities come from the four PDF files of the Qobu package. Rates are a sample AZN library, not part of the package.")}</p>
        </div>
      </section>
    </div>
  );
}
