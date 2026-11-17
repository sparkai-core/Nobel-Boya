import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Ban, FileSpreadsheet, PackagePlus } from "lucide-react";
import { Badge, KeyVals, Meter, Money, StatusBadge, toast, useL } from "../../../components/kit";
import { buildingShort } from "../../../lib/loc";
import { useOps } from "../../../ops/store";
import { diffDays, TODAY } from "../../../ops/dates";
import { R, sectionName, sectionWorth, to } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { durOf, expectedPct, lateness, linkLabel, ownerName, slipDays, useSchedule } from "./model";

/** Side panel for one activity: dates and float, logic, money, BOQ link, material requests and a progress update. */
export function TaskPanel({ task: a, onOpen }: { task: Activity; onOpen: (id: string) => void }) {
  const { t, x, d, lang } = useL();
  const navigate = useNavigate();
  const { links, byId, cp, subs } = useSchedule();
  const mrs = useOps((s) => s.mrs);
  const rfis = useOps((s) => s.rfis);
  const logProgress = useOps((s) => s.logProgress);
  const [pct, setPct] = useState(a.pct);
  const [note, setNote] = useState("");

  const c = cp.get(a.id);
  const slip = slipDays(a);
  const late = lateness(a);
  const exp = expectedPct(a);
  const preds = links.filter((l) => l.to === a.id);
  const succs = links.filter((l) => l.from === a.id);
  const requests = mrs.filter((m) => m.activityId === a.id);
  const rfi = rfis.find((r) => r.activityId === a.id && r.status === "OPEN");

  const save = () => {
    logProgress(a.id, pct, note.trim());
    setNote("");
    toast(pct >= 100 ? t("{code} marked complete", { code: a.code }) : t("{code} progress set to {n}%", { code: a.code, n: pct }));
  };

  return (
    <div className="pms-task">
      <div className="pms-task-badges">
        <StatusBadge kind="activity" status={a.status} />
        {c?.critical && a.status !== "COMPLETED" ? <Badge tone="bad">{t("Critical path")}</Badge> : c?.near ? <Badge tone="warn">{t("Near-critical")}</Badge> : null}
        {late ? <Badge tone="bad">{late === "overdue" ? t("Finish date passed") : t("Behind today's plan")}</Badge> : null}
        <span className="muted small">{buildingShort(a.building, lang)}</span>
      </div>

      {a.status === "BLOCKED" ? (
        <div className="k-callout k-tone-bad">
          <Ban size={16} />
          <div>
            <strong>{t("Blocked")}</strong>
            <p>{a.blockedReason ? x(a.blockedReason) : t("Work cannot continue until the blocker is cleared.")}</p>
            {rfi ? (
              <Link to={R.rfi(rfi.id)} className="k-link-btn">
                {t("Open {ref}", { ref: rfi.ref })} <ArrowRight size={13} />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="pms-task-progress">
        <header>
          <h3>{t("Update progress")}</h3>
          <span className="muted small">{t("Plan says {n}% today", { n: exp })}</span>
        </header>
        <div className="pms-slider">
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} aria-label={t("Percent complete")} style={{ ["--v" as string]: `${pct}%`, ["--e" as string]: `${exp}%` }} />
          <output className="num-inline">{pct}%</output>
        </div>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note for the daily report (optional)")} aria-label={t("Note")} />
        <div className="pms-task-save">
          <span className="muted small">{pct !== a.pct ? t("Was {n}%", { n: a.pct }) : t("No change yet")}</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={pct === a.pct} onClick={save}>
            {t("Save progress")}
          </button>
        </div>
      </section>

      <KeyVals
        items={[
          { k: t("Start"), v: d(a.start) },
          { k: t("Finish"), v: d(a.end) },
          { k: t("Duration"), v: t("{n} days", { n: durOf(a) }) },
          { k: t("Baseline"), v: `${d(a.bStart, false)} – ${d(a.bEnd, false)}` },
          { k: t("Variance"), v: <span className={slip > 0 ? "k-text-bad" : slip < 0 ? "k-text-ok" : undefined}>{slip > 0 ? t("{n} days late", { n: slip }) : slip < 0 ? t("{n} days early", { n: -slip }) : t("On baseline")}</span> },
          { k: t("Total float"), v: c ? <span className={c.tf <= 0 ? "k-text-bad" : c.tf <= 10 ? "k-text-warn" : undefined}>{t("{n} days", { n: c.tf })}</span> : "—" },
          { k: t("Owner"), v: ownerName(a.owner, subs) },
          { k: t("Crew"), v: t("{n} people", { n: a.crew }) },
        ]}
      />
      {a.aStart ? (
        <p className="muted small">
          {t("Started {date}", { date: d(a.aStart) })}
          {a.aEnd ? ` · ${t("finished {date}", { date: d(a.aEnd) })}` : ` · ${t("{n} days on site", { n: diffDays(a.aStart, TODAY) })}`}
        </p>
      ) : null}

      <section className="pms-task-logic">
        <div>
          <h3>{t("Predecessors")}</h3>
          {preds.length ? (
            <ul>
              {preds.map((l) => {
                const p = byId.get(l.from);
                return p ? (
                  <li key={l.id}>
                    <button type="button" onClick={() => onOpen(p.id)}>
                      <ArrowLeft size={12} />
                      <span className="pms-code">{p.code}</span>
                      <span className="truncate">{x(p.name)}</span>
                      <small>{linkLabel(l)}</small>
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="pms-open-end">{t("None: an open start")}</p>
          )}
        </div>
        <div>
          <h3>{t("Successors")}</h3>
          {succs.length ? (
            <ul>
              {succs.map((l) => {
                const p = byId.get(l.to);
                return p ? (
                  <li key={l.id}>
                    <button type="button" onClick={() => onOpen(p.id)}>
                      <ArrowRight size={12} />
                      <span className="pms-code">{p.code}</span>
                      <span className="truncate">{x(p.name)}</span>
                      <small>{linkLabel(l)}</small>
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          ) : (
            <p className="pms-open-end">{t("None: an open end")}</p>
          )}
        </div>
      </section>

      <section className="pms-task-money">
        <h3>{t("Budget")}</h3>
        <div className="pms-task-budget">
          <Money value={a.budget} />
          <span className="muted small">
            {t("earned")} <Money value={(a.budget * a.pct) / 100} short />
          </span>
        </div>
        <Meter value={a.pct / 100} marker={exp / 100} tone={a.status === "BLOCKED" ? "bad" : "brand"} label={t("Earned against budget")} />
        {a.section ? (
          <Link to={to("bill")} className="pms-task-boq">
            <FileSpreadsheet size={15} />
            <span>
              <strong>{sectionName(a.section, lang)}</strong>
              <small>
                {t("BOQ section")} · {buildingShort(a.building, lang)} · <Money value={sectionWorth(a.building, a.section)} short />
              </small>
            </span>
            <ArrowRight size={13} />
          </Link>
        ) : (
          <p className="muted small">{t("General item, not tied to a BOQ section.")}</p>
        )}
      </section>

      <section className="pms-task-mrs">
        <header>
          <h3>{t("Material requests")}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`${R.newRequest}?activity=${a.id}`)}>
            <PackagePlus size={14} />
            {t("Request materials")}
          </button>
        </header>
        {requests.length ? (
          <ul>
            {requests.map((m) => (
              <li key={m.id}>
                <Link to={R.request(m.id)}>
                  <span className="k-ref">{m.ref}</span>
                  <span className="truncate">{x(m.title)}</span>
                  <StatusBadge kind="mr" status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">{t("No requests raised for this activity yet.")}</p>
        )}
      </section>
    </div>
  );
}
