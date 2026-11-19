import { Fragment, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Gauge, Printer, RotateCcw, Send, Trash2, Wallet } from "lucide-react";
import { Kebab, NextBar, StatusBadge, StatusSteps, toast, useL } from "../../../components/kit";
import { Logo } from "../../../components/ui";
import { useOps, me } from "../../../ops/store";
import { removeDraftIpc, sectionProgress, setIpcTerms } from "../../../ops/ext/records";
import { ipcAmounts, PATHS, R, sectionName, sectionWorth } from "../../../ops/select";
import { data } from "../../../data";
import { buildingName, projectName, projectPlace } from "../../../lib/loc";
import { fmtMoney } from "../../../lib/format";
import type { Ipc } from "../../../ops/types";
import { NotFound } from "./shared";
import { ipcDue } from "./BillingPage";

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

/** One interim payment certificate laid out as the document itself, with the measurement editable while draft. */
export function IpcDetailPage() {
  const { id = "" } = useParams();
  const { t, d, lang } = useL();
  const navigate = useNavigate();
  const ipc = useOps((s) => s.ipcs.find((i) => i.id === id));
  const parties = useOps((s) => s.parties);
  const company = useOps((s) => s.setup.company);
  const activities = useOps((s) => s.activities);
  const setIpcLine = useOps((s) => s.setIpcLine);
  const setIpcStatus = useOps((s) => s.setIpcStatus);
  const amt = useMemo(() => (ipc ? ipcAmounts(ipc) : null), [ipc]);

  if (!ipc || !amt) return <NotFound what={t("Certificate")} back={R.billing} backLabel="Back to billing" />;

  const draft = ipc.status === "DRAFT";
  const client = parties.find((p) => p.role === "OWNER")?.name ?? data.project.client;
  const contractor = parties.find((p) => p.role === "CONTRACTOR")?.name ?? company;
  const engineer = parties.find((p) => p.role === "CONSULTANT")?.name ?? data.project.designer;
  const order = [...(data.buildings ?? []).map((b) => b.id), ...ipc.lines.map((l) => l.building)];
  const groups = [...new Set(order)].map((b) => ({ b, lines: ipc.lines.filter((l) => l.building === b) })).filter((g) => g.lines.length);
  const net = amt.thisPeriod - amt.retention - amt.advance;

  const move = (status: Ipc["status"], msg: string) => {
    setIpcStatus(ipc.id, status);
    toast(t(msg, { id: ipc.id }));
  };

  const fillFromSite = () => {
    let n = 0;
    for (const l of ipc.lines) {
      const p = sectionProgress(activities, l.building, l.section);
      if (p == null) continue;
      if (p > l.pctToDate + 1e-4) {
        setIpcLine(ipc.id, l.building, l.section, Math.round(p * 1000) / 1000);
        n++;
      }
    }
    toast(n ? t("{n} lines updated from site progress", { n }) : activities.length ? t("The measurement already matches site progress.") : t("No programme activities to read progress from. Enter the percentages by hand."), n ? "ok" : "neutral");
  };
  const deleteDraft = () => {
    if (!window.confirm(t("Delete draft {id}?", { id: ipc.id }))) return;
    removeDraftIpc(ipc.id);
    toast(t("{id} deleted", { id: ipc.id }), "neutral");
    navigate(R.billing);
  };
  const setPct = (key: "retention" | "advanceRecovery", v: string) => setIpcTerms(ipc.id, { [key]: Math.max(0, Math.min(100, Number(v) || 0)) / 100 });

  return (
    <div className="k-page pmr-cert-page">
      <Link to={R.billing} className="k-back pmr-noprint">
        <ArrowLeft size={14} />
        {t("Back to billing")}
      </Link>

      <div className="pmr-noprint pmr-ipc-steps">
        <StatusSteps kind="ipc" path={PATHS.ipc} status={ipc.status} />
      </div>

      <div className="pmr-noprint">
        {ipc.status === "DRAFT" ? (
          <NextBar text={t("Measure the progress per section, then submit the certificate to the engineer.")}>
            <button type="button" className="btn btn-primary" disabled={amt.thisPeriod <= 0} onClick={() => move("SUBMITTED", "{id} submitted to the engineer")}>
              <Send size={14} />
              {t("Submit")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={fillFromSite}>
              <Gauge size={14} />
              {t("Fill from site progress")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={14} />
              {t("Print")}
            </button>
            <Kebab items={[{ label: t("Delete draft"), icon: <Trash2 size={14} />, danger: true, onClick: deleteDraft }]} />
          </NextBar>
        ) : ipc.status === "SUBMITTED" ? (
          <NextBar tone="warn" text={t("With the engineer. Record the certification when the signed certificate comes back.")}>
            <button type="button" className="btn btn-primary" onClick={() => move("CERTIFIED", "{id} certified")}>
              <BadgeCheck size={14} />
              {t("Certify")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={14} />
              {t("Print")}
            </button>
            <Kebab items={[{ label: t("Return to draft"), icon: <RotateCcw size={14} />, onClick: () => move("DRAFT", "{id} returned to draft") }]} />
          </NextBar>
        ) : ipc.status === "CERTIFIED" ? (
          <NextBar text={t("Certified. Payment is due {date}; mark it paid when the money arrives.", { date: d(ipcDue(ipc)) })}>
            <button type="button" className="btn btn-primary" onClick={() => move("PAID", "{id} marked paid")}>
              <Wallet size={14} />
              {t("Mark paid")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={14} />
              {t("Print")}
            </button>
          </NextBar>
        ) : (
          <NextBar tone="ok" text={t("Paid. The next certificate starts from these to-date values.")}>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
              <Printer size={14} />
              {t("Print")}
            </button>
          </NextBar>
        )}
      </div>

      <article className="pmr-cert">
        <header className="pmr-cert-head">
          <div className="pmr-cert-brand">
            <Logo size={26} />
            <span>{contractor || <span className="muted small pmr-noprint">{t("Set your company name in Settings")}</span>}</span>
          </div>
          <div className="pmr-cert-title">
            <small>{t("Interim payment certificate")}</small>
            <h1>
              {t("IPC")} {String(ipc.no).padStart(2, "0")}
            </h1>
            <StatusBadge kind="ipc" status={ipc.status} />
          </div>
        </header>

        <dl className="pmr-cert-meta">
          <div>
            <dt>{t("Project")}</dt>
            <dd>
              {projectName(lang)}
              <small>{projectPlace(lang)}</small>
            </dd>
          </div>
          <div>
            <dt>{t("Client")}</dt>
            <dd>{client}</dd>
          </div>
          <div>
            <dt>{t("Contractor")}</dt>
            <dd>{contractor || "—"}</dd>
          </div>
          <div>
            <dt>{t("Engineer")}</dt>
            <dd>{engineer}</dd>
          </div>
          <div>
            <dt>{t("Period")}</dt>
            <dd>
              {d(ipc.from)} – {d(ipc.to)}
            </dd>
          </div>
          <div>
            <dt>{t("Certificate no.")}</dt>
            <dd className="num-inline">{ipc.id}</dd>
          </div>
        </dl>

        <h2 className="pmr-cert-h">{t("Measurement of work done")}</h2>
        <div className="pmr-cert-tablewrap">
          <table className="pmr-cert-table">
            <thead>
              <tr>
                <th>{t("BOQ section")}</th>
                <th className="r">{t("Section value")}</th>
                <th className="r">{t("Previous")}</th>
                <th className="r pmr-col-todate">{t("To date")}</th>
                <th className="r">{t("This period")}</th>
              </tr>
            </thead>
            <tbody>
              {!groups.length ? (
                <tr>
                  <td colSpan={5} className="muted small">
                    {t("This project has no priced BOQ sections to measure.")}
                  </td>
                </tr>
              ) : null}
              {groups.map((g) => {
                const sum = g.lines.reduce((a, l) => a + sectionWorth(l.building, l.section) * (l.pctToDate - l.pctPrev), 0);
                return (
                  <Fragment key={g.b}>
                    <tr className="pmr-cert-group">
                      <td colSpan={4}>{buildingName(g.b, lang)}</td>
                      <td className="r num-inline">{fmtMoney(sum)}</td>
                    </tr>
                    {g.lines.map((l) => {
                      const v = sectionWorth(l.building, l.section);
                      const period = v * (l.pctToDate - l.pctPrev);
                      return (
                        <tr key={`${l.building}/${l.section}`}>
                          <td>{sectionName(l.section, lang)}</td>
                          <td className="r num-inline">{fmtMoney(v)}</td>
                          <td className="r num-inline muted">{pc(l.pctPrev)}</td>
                          <td className="r pmr-col-todate">
                            {draft ? (
                              <span className="pmr-measure">
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={Math.round(l.pctToDate * 1000) / 10}
                                  onChange={(e) => setIpcLine(ipc.id, l.building, l.section, Number(e.target.value) / 100)}
                                  style={{ ["--prev" as string]: `${l.pctPrev * 100}%`, ["--val" as string]: `${l.pctToDate * 100}%` }}
                                  aria-label={t("{s} progress to date", { s: sectionName(l.section, lang) })}
                                />
                                <input
                                  className="input num"
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.5}
                                  value={Math.round(l.pctToDate * 1000) / 10}
                                  onChange={(e) => setIpcLine(ipc.id, l.building, l.section, (Number(e.target.value) || 0) / 100)}
                                  aria-label={t("{s} progress to date", { s: sectionName(l.section, lang) })}
                                />
                              </span>
                            ) : (
                              <b className="num-inline">{pc(l.pctToDate)}</b>
                            )}
                          </td>
                          <td className={`r num-inline${period > 0 ? "" : " muted"}`}>{fmtMoney(period)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pmr-cert-bottom">
          <div className="pmr-cert-sign">
            {[
              { role: t("Prepared by the contractor"), who: me(), org: contractor || "—", at: ipc.submittedAt },
              { role: t("Certified by the engineer"), who: "", org: engineer || "—", at: ipc.certifiedAt },
              { role: t("Accepted by the client"), who: "", org: client || "—", at: ipc.status === "PAID" ? ipc.certifiedAt : null },
            ].map((s) => (
              <div key={s.role} className={s.at ? "signed" : undefined}>
                <small>{s.role}</small>
                <b>{s.at && s.who ? s.who : " "}</b>
                <span>{s.org}</span>
                <em>{s.at ? d(s.at) : t("not signed")}</em>
              </div>
            ))}
            {ipc.status === "CERTIFIED" || ipc.status === "PAID" ? <span className="k-stamp-mark pmr-cert-stamp">{ipc.status === "PAID" ? t("Paid") : t("Certified")}</span> : null}
          </div>

          <table className="pmr-cert-sum">
            <tbody>
              <tr>
                <th>{t("Gross value to date")}</th>
                <td>{fmtMoney(amt.gross)}</td>
              </tr>
              <tr>
                <th>{t("Less previously certified")}</th>
                <td>−{fmtMoney(amt.prev)}</td>
              </tr>
              <tr className="sub">
                <th>{t("Value this period")}</th>
                <td>{fmtMoney(amt.thisPeriod)}</td>
              </tr>
              <tr>
                <th>
                  {draft ? (
                    <span className="k-row" style={{ gap: 6 }}>
                      {t("Less retention")}
                      <input className="input num pmr-noprint" style={{ width: 70 }} type="number" min={0} max={100} step={0.5} value={Math.round(ipc.retention * 1000) / 10} onChange={(e) => setPct("retention", e.target.value)} aria-label={t("Retention, %")} />%
                    </span>
                  ) : (
                    t("Less retention {p}", { p: pc(ipc.retention) })
                  )}
                </th>
                <td>−{fmtMoney(amt.retention)}</td>
              </tr>
              <tr>
                <th>
                  {draft ? (
                    <span className="k-row" style={{ gap: 6 }}>
                      {t("Less advance recovery")}
                      <input className="input num pmr-noprint" style={{ width: 70 }} type="number" min={0} max={100} step={0.5} value={Math.round(ipc.advanceRecovery * 1000) / 10} onChange={(e) => setPct("advanceRecovery", e.target.value)} aria-label={t("Advance recovery, %")} />%
                    </span>
                  ) : (
                    t("Less advance recovery {p}", { p: pc(ipc.advanceRecovery) })
                  )}
                </th>
                <td>−{fmtMoney(amt.advance)}</td>
              </tr>
              <tr className="sub">
                <th>{t("Net before VAT")}</th>
                <td>{fmtMoney(net)}</td>
              </tr>
              <tr>
                <th>{t("VAT 18%")}</th>
                <td>{fmtMoney(amt.vat)}</td>
              </tr>
              <tr className="due">
                <th>{t("Amount due")}</th>
                <td>
                  {fmtMoney(amt.due)} <small>AZN</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
