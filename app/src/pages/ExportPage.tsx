import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { exportWorkbook } from "../lib/exportXlsx";
import { printBill } from "../lib/printReport";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { PageHead } from "../components/Shell";
import { useT } from "../lib/i18n";

export function ExportPage() {
  const t = useT();
  const boq = useBoq();
  const fixes = useApp((s) => s.fixes);
  const overrides = useApp((s) => s.qty);
  const rates = useApp((s) => s.rates);
  const lang = useApp((s) => s.lang);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const sources = data.items.reduce((a, i) => a + i.src.length, 0);

  const sheets = [
    { name: t("Summary"), what: t("Collection by structure and the mark-up chain to {t} AZN.", { t: fmtMoney(boq.total) }) },
    { name: t("Bill"), what: t("{n} lines in Azerbaijani and English with unit, quantity, rate, amount as a live formula, evidence type and sheet numbers.", { n: boq.lines.length }) },
    { name: t("Takeoff and sources"), what: t("{q} quantities and {s} sources: file, page and the printed text each number was read from.", { q: data.items.length, s: sources }) },
    { name: t("Checks"), what: t("{n} findings and agreements, with what the bill uses for each.", { n: data.checks.length }) },
    { name: t("Rates"), what: t("The sample rate library and the rates used, including your edits.") },
    { name: t("Not in the package"), what: t("{n} items the drawings do not quantify.", { n: data.gaps.length }) },
  ];

  const changes = [
    Object.keys(rates).length ? t("{n} edited rates", { n: Object.keys(rates).length }) : null,
    Object.keys(overrides).length ? t("{n} quantity overrides", { n: Object.keys(overrides).length }) : null,
    Object.values(fixes).filter(Boolean).length ? t("{n} corrections from checks", { n: Object.values(fixes).filter(Boolean).length }) : null,
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHead title={t("Export")} lead={t("One Excel workbook for the quantity surveyor. Every number keeps its sheet reference, so it can be checked without this app.")} />
      <section className="panel export">
        <ol className="export-sheets">
          {sheets.map((s, i) => (
            <li key={s.name}>
              <span className="export-n num">{i + 1}</span>
              <div>
                <strong>{s.name}</strong>
                <p className="muted">{s.what}</p>
              </div>
            </li>
          ))}
        </ol>
        <footer className="export-foot">
          <p className="muted small">{changes.length ? t("Includes {c}.", { c: changes.join(", ") }) : t("Uses the printed quantities and the sample rates.")}</p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={state === "busy"}
            onClick={async () => {
              setState("busy");
              try {
                await exportWorkbook(boq, fixes);
                setState("done");
              } catch (e) {
                console.error(e);
                setState("error");
              }
            }}
          >
            {state === "busy" ? <span className="spinner light" /> : <Download size={18} />}
            {state === "busy" ? t("Building the workbook") : t("Download {f}", { f: "Qobu-BOQ-Nobel.xlsx" })}
          </button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => printBill(boq, lang)}>
            <Printer size={18} /> {t("Print or save the bill as PDF")}
          </button>
          {state === "done" ? <p className="ok-text small">{t("Downloaded.")}</p> : null}
          {state === "error" ? <p className="bad-text small">{t("The workbook could not be built. Reload the page and try again.")}</p> : null}
        </footer>
      </section>
    </div>
  );
}
