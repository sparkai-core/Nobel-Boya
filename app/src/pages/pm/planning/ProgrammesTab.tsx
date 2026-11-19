import { ArrowRight, FileInput, Upload } from "lucide-react";
import { Badge, Empty, useL } from "../../../components/kit";
import { addDays, diffDays, maxDate, minDate, PROJECT_START, TODAY } from "../../../ops/dates";
import { useOps } from "../../../ops/store";
import type { Programme } from "../../../ops/types";
import { ToolBadge } from "./ImportDialog";

/** Every programme file of the project, with a start-to-finish span bar on one shared axis. */
export function ProgrammesTab({ programmes, fresh, onOpen, onImport }: { programmes: Programme[]; fresh: string | null; onOpen: (p: Programme) => void; onImport: () => void }) {
  const { t, d, rel } = useL();
  const contractSet = useOps((s) => s.setup.contractFinish);
  if (!programmes.length)
    return (
      <div className="k-panel">
        <Empty
          icon={<FileInput size={20} />}
          title={t("No programmes yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={onImport}>
              <Upload size={15} /> {t("Import a P6 / MS Project file")}
            </button>
          }
        >
          {t("Each imported file is listed here: its activities, data date and finish, and which one the project follows.")}
        </Empty>
      </div>
    );
  const contractOf = (p: Programme) => contractSet || p.contractFinish || null;
  const from = minDate(PROJECT_START, ...programmes.map((p) => p.dataDate).filter(Boolean));
  const to = addDays(programmes.reduce((m, p) => maxDate(m, p.finish || m, contractOf(p) ?? m), PROJECT_START), 20);
  const span = Math.max(1, diffDays(from, to));
  const X = (iso: string) => `${Math.max(0, Math.min(100, (diffDays(from, iso) / span) * 100))}%`;
  const sorted = [...programmes].sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="k-panel pp-prg">
      <div className="pp-scrollx">
        <table className="pp-table pp-prg-table">
          <thead>
            <tr>
              <th>{t("Tool")}</th>
              <th>{t("Programme")}</th>
              <th>{t("Project")}</th>
              <th className="r">{t("Activities")}</th>
              <th className="r">{t("Done")}</th>
              <th>{t("Data date")}</th>
              <th>{t("Finish")}</th>
              <th>{t("Contract")}</th>
              <th>{t("On contract")}</th>
              <th className="pp-span-h">{t("Programme span")}</th>
              <th>{t("Updated")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const contract = contractOf(p);
              const late = contract && p.finish ? diffDays(contract, p.finish) : null;
              const pastStart = late != null && late > 0 && contract ? X(contract) : null;
              return (
                <tr key={p.id} className={`${p.current ? "pp-current" : ""} ${p.id === fresh ? "pp-fresh" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
                  <td>
                    <ToolBadge tool={p.tool} />
                  </td>
                  <td className="pp-prg-name">
                    <strong>{p.name}</strong>
                    <small className="k-mono">{p.file}</small>
                    <span className="pp-pills">
                      {p.current ? <Badge tone="brand">{t("Followed")}</Badge> : null}
                      {p.id === fresh ? <Badge tone="ok">{t("New")}</Badge> : null}
                    </span>
                  </td>
                  <td className="k-mono">{p.projectCode}</td>
                  <td className="r num-inline">{p.activities}</td>
                  <td className="r num-inline">{p.donePct.toFixed(1)}%</td>
                  <td className="num-inline">{d(p.dataDate)}</td>
                  <td className="num-inline">{d(p.finish)}</td>
                  <td className="num-inline">{contract ? d(contract) : "—"}</td>
                  <td>{late == null ? <span className="muted small">{t("No contract date")}</span> : late > 0 ? <Badge tone="bad">{t("{n}d late", { n: late })}</Badge> : <Badge tone="ok">{late < 0 ? t("{n}d early", { n: -late }) : t("On time")}</Badge>}</td>
                  <td className="pp-span-cell">
                    <div className="pp-span" title={`${d(PROJECT_START)} → ${d(p.finish)}`}>
                      {p.finish ? (
                        <i className="pp-span-bar k-grow-x" style={{ left: X(PROJECT_START), width: `calc(${X(p.finish)} - ${X(PROJECT_START)})` }}>
                          {pastStart ? <em style={{ left: `calc(${pastStart} - ${X(PROJECT_START)})` }} /> : null}
                        </i>
                      ) : null}
                      <b className="pp-span-dd" style={{ left: X(p.dataDate) }} title={t("Data date")} />
                      {contract ? <b className="pp-span-ct" style={{ left: X(contract) }} title={t("Contract finish")} /> : null}
                    </div>
                  </td>
                  <td className="muted small">{rel(p.updatedAt)}</td>
                  <td className="r">
                    {p.current ? (
                      <button type="button" className="k-link-btn pp-open" onClick={() => onOpen(p)}>
                        {t("Open")} <ArrowRight size={13} />
                      </button>
                    ) : (
                      <span className="muted small" title={t("Import the file again to follow it")}>
                        {t("Earlier file")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="pp-legend">
        <span>
          <i className="pp-lg-bar" /> {t("Programme start to forecast finish")}
        </span>
        <span>
          <i className="pp-lg-late" /> {t("Past the contract finish")}
        </span>
        <span>
          <i className="pp-lg-dd" /> {t("Data date")}
        </span>
        <span>
          <i className="pp-lg-ct" /> {t("Contract finish")}
        </span>
        <span className="muted">{t("Today is {d}.", { d: d(TODAY) })}</span>
      </footer>
    </div>
  );
}
