import { Fragment, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Gauge, Printer, RotateCcw, Send, Wallet } from "lucide-react";
import { Kebab, NextBar, StatusBadge, StatusSteps, toast, useL } from "../../../components/kit";
import { Logo } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { PEOPLE } from "../../../ops/seed";
import { ipcAmounts, PATHS, R, sectionName, sectionWorth } from "../../../ops/select";
import { data } from "../../../data";
import { buildingName, projectName, projectPlace } from "../../../lib/loc";
import { fmtMoney } from "../../../lib/format";
import type { Ipc } from "../../../ops/types";
import { NotFound } from "./shared";
import { ipcDue } from "./BillingPage";

const ORDER = ["WH", "AD", "PS", "TK", "SITE"];
const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

/** One interim payment certificate laid out as the document itself, with the measurement editable while draft. */
export function IpcDetailPage() {
  const { id = "" } = useParams();
  const { t, d, lang } = useL();
  const ipc = useOps((s) => s.ipcs.find((i) => i.id === id));
  const parties = useOps((s) => s.parties);
  const activities = useOps((s) => s.activities);
  const setIpcLine = useOps((s) => s.setIpcLine);
  const setIpcStatus = useOps((s) => s.setIpcStatus);
  const amt = useMemo(() => (ipc ? ipcAmounts(ipc) : null), [ipc]);

  if (!ipc || !amt) return <NotFound what={t("Certificate")} back={R.billing} backLabel="Back to billing" />;

  const draft = ipc.status === "DRAFT";
  const client = parties.find((p) => p.role === "OWNER")?.name ?? data.project.client;
  const contractor = parties.find((p) => p.role === "CONTRACTOR")?.name ?? "";
  const engineer = parties.find((p) => p.role === "CONSULTANT")?.name ?? data.project.designer;
  const groups = ORDER.map((b) => ({ b, lines: ipc.lines.filter((l) => l.building === b) })).filter((g) => g.lines.length);
  const net = amt.thisPeriod - amt.retention - amt.advance;

  const move = (status: Ipc["status"], msg: string) => {
    setIpcStatus(ipc.id, status);
    toast(t(msg, { id: ipc.id }));
  };

  const fillFromSite = () => {
    let n = 0;
    for (const l of ipc.lines) {
      const acts = activities.filter((a) => a.building === l.building && a.section === l.section);
      if (!acts.length) continue;
      const tot = acts.reduce((a, x) => a + x.budget, 0) || 1;
      const p = acts.reduce((a, x) => a + x.budget * x.pct, 0) / tot / 100;
      if (p > l.pctToDate + 1e-4) {
        setIpcLine(ipc.id, l.building, l.section, Math.round(p * 1000) / 1000);
        n++;
      }
    }
    toast(n ? t("{n} lines updated from site progress", { n }) : t("The measurement already matches site progress."), n ? "ok" : "neutral");
  };

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
          </NextBar>
        ) : ipc.status === "SUBMITTED" ? (
          <NextBar tone="warn" text={t("With the engineer. Certify it as the engineer for the demo.")}>
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
            <span>{contractor}</span>
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
            <dd>{contractor}</dd>
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
              { role: t("Prepared by the contractor"), who: PEOPLE.qs, org: contractor, at: ipc.submittedAt },
              { role: t("Certified by the engineer"), who: PEOPLE.engineer, org: engineer, at: ipc.certifiedAt },
              { role: t("Accepted by the client"), who: PEOPLE.client, org: client, at: ipc.status === "PAID" ? ipc.certifiedAt : null },
            ].map((s) => (
              <div key={s.role} className={s.at ? "signed" : undefined}>
                <small>{s.role}</small>
                <b>{s.at ? s.who : " "}</b>
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
                <th>{t("Less retention {p}", { p: pc(ipc.retention) })}</th>
                <td>−{fmtMoney(amt.retention)}</td>
              </tr>
              <tr>
                <th>{t("Less advance recovery {p}", { p: pc(ipc.advanceRecovery) })}</th>
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
