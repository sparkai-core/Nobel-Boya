import { useState } from "react";
import { Download } from "lucide-react";
import { data } from "../data";
import { useBoq } from "../lib/boq";
import { exportWorkbook } from "../lib/exportXlsx";
import { fmtMoney } from "../lib/format";
import { useApp } from "../lib/store";
import { PageHead } from "../components/Shell";

export function ExportPage() {
  const boq = useBoq();
  const fixes = useApp((s) => s.fixes);
  const overrides = useApp((s) => s.qty);
  const rates = useApp((s) => s.rates);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const sources = data.items.reduce((a, i) => a + i.src.length, 0);

  const sheets = [
    { name: "Summary", what: `Collection by structure and the mark-up chain to ${fmtMoney(boq.total)} AZN.` },
    { name: "Bill", what: `${boq.lines.length} lines in Azerbaijani and English with unit, quantity, rate, amount as a live formula, evidence type and sheet numbers.` },
    { name: "Takeoff and sources", what: `${data.items.length} quantities and ${sources} sources: file, page and the printed text each number was read from.` },
    { name: "Checks", what: `${data.checks.length} findings and agreements, with what the bill uses for each.` },
    { name: "Rates", what: "The sample rate library and the rates used, including your edits." },
    { name: "Not in the package", what: `${data.gaps.length} items the drawings do not quantify.` },
  ];

  const changes = [
    Object.keys(rates).length ? `${Object.keys(rates).length} edited rates` : null,
    Object.keys(overrides).length ? `${Object.keys(overrides).length} quantity overrides` : null,
    Object.values(fixes).filter(Boolean).length ? `${Object.values(fixes).filter(Boolean).length} corrections from checks` : null,
  ].filter(Boolean);

  return (
    <div className="page">
      <PageHead title="Export" lead="One Excel workbook for the quantity surveyor. Every number keeps its sheet reference, so it can be checked without this app." />
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
          <p className="muted small">{changes.length ? `Includes ${changes.join(", ")}.` : "Uses the printed quantities and the sample rates."}</p>
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
            {state === "busy" ? "Building the workbook" : "Download Qobu-BOQ-Tutulan.xlsx"}
          </button>
          {state === "done" ? <p className="ok-text small">Downloaded.</p> : null}
          {state === "error" ? <p className="bad-text small">The workbook could not be built. Reload the page and try again.</p> : null}
        </footer>
      </section>
    </div>
  );
}
