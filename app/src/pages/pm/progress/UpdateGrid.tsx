import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, NotebookPen, RotateCcw, Send } from "lucide-react";
import { Panel, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import type { Activity } from "../../../ops/types";
import { plannedAt } from "./shared";

type Draft = { pct: number; remaining: number; aStart: string | null; aEnd: string | null };

const baseOf = (a: Activity): Draft => ({ pct: a.pct, remaining: Math.max(0, diffDays(TODAY, a.end)), aStart: a.aStart, aEnd: a.aEnd });

/** Variance of the new % against the planned % today, in points. */
function flagOf(a: Activity, pct: number) {
  const planned = Math.round(plannedAt(a) * 100);
  const gap = pct - planned;
  if (a.status === "BLOCKED") return { tone: "bad", label: "Blocked", gap };
  if (planned === 0 && pct === 0) return { tone: "muted", label: "Not due", gap };
  if (gap >= -3) return { tone: "ok", label: "On plan", gap };
  if (gap >= -12) return { tone: "warn", label: "Watch", gap };
  return { tone: "bad", label: "Behind", gap };
}

/**
 * The weekly update grid: in-progress, blocked and next-to-start activities, with planned % today,
 * last %, a new % slider, remaining days and actual dates. Submitting writes a progress snapshot.
 */
export function UpdateGrid() {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const reports = useOps((s) => s.reports);
  const submit = useOps((s) => s.submitProgressUpdate);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [note, setNote] = useState("");

  const rows = useMemo(
    () =>
      activities
        .filter((a) => !a.isMilestone && (a.status === "IN_PROGRESS" || a.status === "BLOCKED" || (a.status === "NOT_STARTED" && a.start <= addDays(TODAY, 14))))
        .sort((a, b) => (a.status === "BLOCKED" ? -1 : 0) - (b.status === "BLOCKED" ? -1 : 0) || a.start.localeCompare(b.start)),
    [activities],
  );

  const draftOf = (a: Activity) => drafts[a.id] ?? baseOf(a);
  const changed = (a: Activity) => {
    const dr = drafts[a.id];
    if (!dr) return false;
    const b = baseOf(a);
    return dr.pct !== b.pct || dr.remaining !== b.remaining || dr.aStart !== b.aStart || dr.aEnd !== b.aEnd;
  };
  const changedRows = rows.filter(changed);

  const patch = (a: Activity, p: Partial<Draft>) =>
    setDrafts((m) => {
      const cur = m[a.id] ?? baseOf(a);
      const next = { ...cur, ...p };
      if (p.pct != null) {
        next.pct = Math.max(0, Math.min(100, Math.round(p.pct)));
        if (next.pct > 0 && !next.aStart) next.aStart = TODAY;
        if (next.pct === 0 && !a.aStart) next.aStart = null;
        if (next.pct >= 100) {
          next.aEnd = next.aEnd ?? TODAY;
          next.remaining = 0;
        } else {
          next.aEnd = null;
          if (cur.pct >= 100) next.remaining = baseOf(a).remaining || 1;
        }
      }
      return { ...m, [a.id]: next };
    });

  const fillFromReports = () => {
    const approved = reports.filter((r) => r.status === "APPROVED");
    if (!approved.length) {
      toast(t("No approved daily reports yet."), "neutral");
      return;
    }
    let n = 0;
    const next = { ...drafts };
    for (const a of rows) {
      const best = approved.reduce((m, r) => Math.max(m, ...r.entries.filter((e) => e.activityId === a.id).map((e) => e.pct)), -1);
      const cur = next[a.id] ?? baseOf(a);
      // Site reports only ever move progress forward.
      if (best <= cur.pct) continue;
      next[a.id] = { ...cur, pct: best, aStart: cur.aStart ?? (best > 0 ? (a.aStart ?? TODAY) : null), aEnd: best >= 100 ? (cur.aEnd ?? TODAY) : null, remaining: best >= 100 ? 0 : cur.remaining };
      n++;
    }
    setDrafts(next);
    toast(n ? t("{n} activities filled from {m} approved daily reports", { n, m: approved.length }) : t("The approved daily reports match what is already entered."), n ? "ok" : "neutral");
  };

  const send = () => {
    if (!changedRows.length) return;
    const id = submit({
      lines: changedRows.map((a) => {
        const dr = draftOf(a);
        return { activityId: a.id, pct: dr.pct, remaining: dr.remaining, aStart: dr.aStart, aEnd: dr.aEnd };
      }),
      note: note.trim(),
    });
    setDrafts({});
    setNote("");
    toast(t("Weekly update {id} submitted: {n} activities", { id, n: changedRows.length }));
  };

  return (
    <Panel
      title={t("This week's update")}
      icon={<ClipboardList size={15} />}
      count={rows.length}
      sub={t("In-progress, blocked and next-to-start activities (starting within 14 days). Changed rows are highlighted.")}
      actions={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={fillFromReports}>
            <NotebookPen size={13} />
            {t("Fill from approved daily reports")}
          </button>
          {changedRows.length ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrafts({})}>
              <RotateCcw size={13} />
              {t("Undo changes")}
            </button>
          ) : null}
        </>
      }
      pad={false}
    >
      <div className="pg-upd" role="table" aria-label={t("This week's update")}>
        <div className="pg-upd-head" role="row">
          <span role="columnheader">{t("Activity")}</span>
          <span role="columnheader">{t("Planned today")}</span>
          <span role="columnheader">{t("Last %")}</span>
          <span role="columnheader">{t("New %")}</span>
          <span role="columnheader">{t("Remaining (days)")}</span>
          <span role="columnheader">{t("Actual start")}</span>
          <span role="columnheader">{t("Actual finish")}</span>
          <span role="columnheader">{t("Variance")}</span>
        </div>
        {rows.map((a) => {
          const dr = draftOf(a);
          const planned = Math.round(plannedAt(a) * 100);
          const f = flagOf(a, dr.pct);
          const isChanged = changed(a);
          return (
            <div key={a.id} role="row" className={`pg-upd-row${isChanged ? " changed" : ""}${a.status === "BLOCKED" ? " blocked" : ""}`}>
              <span role="cell" className="pg-upd-act">
                <Link to={R.programme(a.id)} className="k-ref">
                  {a.code}
                </Link>
                <b className="truncate" title={x(a.name)}>
                  {x(a.name)}
                </b>
                <small>
                  {a.status === "NOT_STARTED" ? t("starts {date}", { date: d(a.start, false) }) : `${d(a.start, false)} – ${d(a.end, false)}`}
                </small>
              </span>
              <span role="cell" className="pg-upd-num" data-label={t("Planned today")}>
                <span className="pg-mini-meter">
                  <i style={{ width: `${planned}%` }} />
                </span>
                <b className="num-inline">{planned}%</b>
              </span>
              <span role="cell" className="pg-upd-num" data-label={t("Last %")}>
                <b className="num-inline muted">{a.pct}%</b>
              </span>
              <span role="cell" className="pg-upd-new" data-label={t("New %")}>
                <input type="range" min={0} max={100} step={1} value={dr.pct} onChange={(e) => patch(a, { pct: Number(e.target.value) })} aria-label={t("New % for {code}", { code: a.code })} style={{ ["--pg-fill" as string]: `${dr.pct}%`, ["--pg-plan" as string]: `${planned}%` }} />
                <input type="number" className="input pg-num-input" min={0} max={100} value={dr.pct} onChange={(e) => patch(a, { pct: Number(e.target.value) || 0 })} aria-label={t("New % for {code}", { code: a.code })} />
              </span>
              <span role="cell" data-label={t("Remaining (days)")}>
                <input type="number" className="input pg-num-input" min={0} value={dr.remaining} disabled={dr.pct >= 100} onChange={(e) => patch(a, { remaining: Math.max(0, Number(e.target.value) || 0) })} aria-label={t("Remaining days for {code}", { code: a.code })} />
              </span>
              <span role="cell" data-label={t("Actual start")}>
                <input type="date" className="input pg-date-input" value={dr.aStart ?? ""} max={TODAY} onChange={(e) => patch(a, { aStart: e.target.value || null })} aria-label={t("Actual start for {code}", { code: a.code })} />
              </span>
              <span role="cell" data-label={t("Actual finish")}>
                <input type="date" className="input pg-date-input" value={dr.aEnd ?? ""} max={TODAY} disabled={dr.pct < 100} onChange={(e) => patch(a, { aEnd: e.target.value || null })} aria-label={t("Actual finish for {code}", { code: a.code })} />
              </span>
              <span role="cell" data-label={t("Variance")}>
                <span className={`k-badge k-tone-${f.tone}`} title={t("{n} points against plan", { n: f.gap > 0 ? `+${f.gap}` : f.gap })}>
                  <i aria-hidden="true" />
                  {t(f.label)}
                  {f.tone !== "muted" && a.status !== "BLOCKED" ? <small className="num-inline">{f.gap > 0 ? `+${f.gap}` : f.gap}</small> : null}
                </span>
              </span>
            </div>
          );
        })}
        {!rows.length ? <p className="pg-empty">{t("Nothing is in progress or due to start in the next 14 days.")}</p> : null}
      </div>
      <footer className="pg-upd-foot">
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note for this update (optional): what moved, what is holding work up.")} aria-label={t("Note")} />
        <div className="pg-upd-submit">
          <span className="muted small">{changedRows.length ? t("{n} activities changed", { n: changedRows.length }) : t("Move a slider to start this week's update.")}</span>
          <button type="button" className="btn btn-primary" disabled={!changedRows.length} onClick={send}>
            <Send size={14} />
            {t("Submit weekly update")}
          </button>
        </div>
      </footer>
    </Panel>
  );
}
