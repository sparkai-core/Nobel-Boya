import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, LogOut, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { P } from "../data";
import { useT } from "../lib/i18n";
import { DEFAULT_MARKUPS, useApp } from "../lib/store";
import { PageHead } from "../components/Shell";
import { useOps } from "../ops/store";
import { usePlanExtras } from "../ops/ext/planning-p2";
import { applyBackup, exportBackup, readBackup, usePkgPlan } from "../ops/ext/proc-client";
import { Dialog, Field, toast } from "../components/kit";

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

      <ProjectSetupCard />

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

const num = (v: string) => {
  const n = Number(v.replace(/[\s,]/g, ""));
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Project setup: facts only the user can give (company name, dates, contract value, cash for pay runs),
 * a backup of the project's records (they live only in this browser) and clearing them.
 */
function ProjectSetupCard() {
  const t = useT();
  const setup = useOps((s) => s.setup);
  const setSetup = useOps((s) => s.setSetup);
  const resetDemo = useOps((s) => s.resetDemo);
  const [f, setF] = useState(() => ({
    company: setup.company,
    plannedStart: setup.plannedStart ?? "",
    contractFinish: setup.contractFinish ?? "",
    contractValue: setup.contractValue != null ? String(setup.contractValue) : "",
    cashAvailable: setup.cashAvailable != null ? String(setup.cashAvailable) : "",
  }));
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((o) => ({ ...o, [k]: v }));

  const badDates = f.plannedStart && f.contractFinish && f.contractFinish < f.plannedStart;
  const badValue = f.contractValue.trim() !== "" && num(f.contractValue) == null;
  const badCash = f.cashAvailable.trim() !== "" && num(f.cashAvailable) == null;
  const dirty =
    f.company.trim() !== setup.company ||
    (f.plannedStart || null) !== setup.plannedStart ||
    (f.contractFinish || null) !== setup.contractFinish ||
    num(f.contractValue) !== setup.contractValue ||
    num(f.cashAvailable) !== setup.cashAvailable;

  const save = () => {
    if (badDates || badValue || badCash) return;
    setSetup({ company: f.company.trim(), plannedStart: f.plannedStart || null, contractFinish: f.contractFinish || null, contractValue: num(f.contractValue), cashAvailable: num(f.cashAvailable) });
    toast(t("Project setup saved."));
  };

  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nobel-records-${useApp.getState().activeProjectId || "project"}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const load = (picked: File | undefined) => {
    if (!picked) return;
    void picked.text().then((text) => {
      const r = readBackup(text);
      if (!r.ok) {
        toast(r.reason === "json" ? t("That file is not valid JSON.") : t("That file is not a records backup from this app."), "bad");
        return;
      }
      applyBackup(r.patch);
      const s = useOps.getState().setup;
      setF({ company: s.company, plannedStart: s.plannedStart ?? "", contractFinish: s.contractFinish ?? "", contractValue: s.contractValue != null ? String(s.contractValue) : "", cashAvailable: s.cashAvailable != null ? String(s.cashAvailable) : "" });
      toast(t("Backup restored: {n} records.", { n: r.records }));
    });
    if (file.current) file.current.value = "";
  };

  const clear = () => {
    resetDemo();
    usePlanExtras.setState({ constraints: {} });
    usePkgPlan.getState().clearProject();
    try {
      localStorage.removeItem("nobel.ops.seen");
    } catch {
      /* storage blocked */
    }
    const s = useOps.getState().setup;
    setF((o) => ({ ...o, plannedStart: s.plannedStart ?? "", contractFinish: s.contractFinish ?? "", contractValue: "", cashAvailable: "" }));
    setConfirm(false);
    setCleared(true);
  };

  return (
    <section className="card settings-card">
      <header className="card-head">
        <h2>{t("Project setup")}</h2>
      </header>
      <div className="settings-row" style={{ display: "block" }}>
        <p className="muted small" style={{ marginBottom: 12 }}>{t("Facts only you can give. The dates and values are kept for the open project; the company name is shared by all projects.")}</p>
        <div className="k-form">
          <Field label={t("Company name")} wide hint={t("Printed on purchase orders and shown to vendors in the portal.")}>
            <input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder={t("Your company's legal name")} />
          </Field>
          <Field label={t("Planned start")}>
            <input className="input" type="date" value={f.plannedStart} onChange={(e) => set("plannedStart", e.target.value)} />
          </Field>
          <Field label={t("Contract finish")} error={badDates ? t("The finish is before the start.") : undefined}>
            <input className="input" type="date" value={f.contractFinish} onChange={(e) => set("contractFinish", e.target.value)} />
          </Field>
          <Field label={t("Contract value, AZN")} error={badValue ? t("Enter a number.") : undefined}>
            <input className="input num" inputMode="decimal" value={f.contractValue} onChange={(e) => set("contractValue", e.target.value)} />
          </Field>
          <Field label={t("Cash available for pay runs, AZN")} error={badCash ? t("Enter a number.") : undefined} hint={t("Used to check a pay run against the cash in the bank.")}>
            <input className="input num" inputMode="decimal" value={f.cashAvailable} onChange={(e) => set("cashAvailable", e.target.value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!dirty || !!badDates || badValue || badCash}>
            <Save size={15} /> {t("Save setup")}
          </button>
        </div>
      </div>

      <div className="settings-row" style={{ flexWrap: "wrap" }}>
        <div>
          <p className="muted small">{t("Requests, orders, deliveries, payments, the programme and site records are kept only in this browser. Export a backup now and then.")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={download}>
            <Download size={15} /> {t("Export backup")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => file.current?.click()}>
            <Upload size={15} /> {t("Import backup")}
          </button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => load(e.target.files?.[0])} />
        </div>
      </div>

      <div className="settings-row" style={{ flexWrap: "wrap" }}>
        <div>
          <p className="muted small">{t("Removes every PM and procurement record of the open project. Vendors and the company name stay.")}</p>
          {cleared ? <p className="ok-text small">{t("The project's records were cleared.")}</p> : null}
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
          <Trash2 size={15} /> {t("Clear PM and procurement records of this project")}
        </button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Clear this project's records?")}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={clear}>
              <RotateCcw size={15} /> {t("Clear records")}
            </button>
          </>
        }
      >
        <p>{t("Every material request, RFQ, quote, order, receipt, invoice, payment, programme activity and site record of the open project is deleted from this browser. This cannot be undone.")}</p>
        <p className="muted small">{t("Vendors and the company name stay. Export a backup first if you may need the records again.")}</p>
      </Dialog>
    </section>
  );
}
