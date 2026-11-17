import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import {
  Avatar,
  Badge,
  FilterChips,
  PageHero,
  Register,
  SearchBox,
  StagePath,
  StatusBadge,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { PATHS, R, statusMeta } from "../../../ops/select";
import { disciplineName } from "../../../lib/loc";
import type { Rfi } from "../../../ops/types";
import { ImpactIcons, rfiOverdue, rfiShownStatus, SheetChip, SheetLightbox } from "./shared";
import { RfiDialog } from "./RfiDialog";

const CLOCK_BACK = 14;
const CLOCK_SPAN = 28;

/**
 * RFI register. Signature visual: the "RFI clock", every open question drawn as a bar from the day
 * it was raised to the day it is due, overdue time running red past the due date.
 */
export function RfisPage() {
  const { t, x, d, rel, lang } = useL();
  const navigate = useNavigate();
  const rfis = useOps((s) => s.rfis);
  const activities = useOps((s) => s.activities);
  const [stage, setStage] = useState<string | null>(null);
  const [disc, setDisc] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rfis) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (rfiOverdue(r)) c.OVERDUE = (c.OVERDUE ?? 0) + 1;
    }
    return c;
  }, [rfis]);

  const filtered = useMemo(
    () => rfis.filter((r) => (!stage || (stage === "OVERDUE" ? rfiOverdue(r) : r.status === stage)) && (!disc || r.discipline === disc)),
    [rfis, stage, disc],
  );
  const rows = useSearch(filtered, q, (r) => [r.ref, r.subject, r.question, r.raisedBy, r.sheetId, disciplineName(r.discipline, lang)]);
  const disciplines = [...new Set(rfis.map((r) => r.discipline))];

  const columns: Column<Rfi>[] = [
    {
      key: "rfi",
      header: t("RFI"),
      sort: (r) => r.ref,
      render: (r) => (
        <div className="k-cell-title">
          <span className="k-row" style={{ gap: 8 }}>
            <span className="k-ref">{r.ref}</span>
            {r.priority === "URGENT" || r.priority === "HIGH" ? <Badge tone={statusMeta("priority", r.priority).tone}>{x(statusMeta("priority", r.priority).label)}</Badge> : null}
          </span>
          <strong>{x(r.subject)}</strong>
          <small className="pmr-clamp">{x(r.question)}</small>
        </div>
      ),
    },
    { key: "disc", header: t("Discipline"), sort: (r) => r.discipline, hideBelow: 1100, render: (r) => <span className="pmr-disc">{disciplineName(r.discipline, lang)}</span> },
    { key: "sheet", header: t("Sheet"), render: (r) => <SheetChip sheetId={r.sheetId} onOpen={setSheet} /> },
    {
      key: "by",
      header: t("Raised by"),
      sort: (r) => r.raisedAt,
      hideBelow: 900,
      render: (r) => (
        <span className="pmr-person">
          <Avatar name={r.raisedBy} size={24} />
          <span className="k-cell-title">
            <strong className="truncate">{r.raisedBy}</strong>
            <small>{d(r.raisedAt)}</small>
          </span>
        </span>
      ),
    },
    {
      key: "due",
      header: t("Due"),
      sort: (r) => r.dueAt,
      render: (r) => {
        const late = rfiOverdue(r);
        return (
          <span className={`pmr-due${late ? " late" : ""}`}>
            <b className="num-inline">{d(r.dueAt)}</b>
            <small>{r.status === "OPEN" ? (late ? t("{n} days overdue", { n: diffDays(r.dueAt, TODAY) }) : rel(r.dueAt)) : r.answeredAt ? t("answered {date}", { date: d(r.answeredAt, false) }) : "—"}</small>
          </span>
        );
      },
    },
    { key: "impact", header: t("Impact"), render: (r) => <ImpactIcons cost={r.costImpact} time={r.timeImpact} /> },
    { key: "status", header: t("Status"), sort: (r) => PATHS.rfi.indexOf(r.status), render: (r) => <StatusBadge kind="rfi" status={rfiShownStatus(r)} /> },
  ];

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · RFIs")}
        title={t("Requests for information")}
        subtitle={t("Questions to the designer about the drawings, each tied to the sheet it is about and the work it holds up.")}
        flow={["Raise", "Designer answers", "Close or raise a change"]}
        art="rfi"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            {t("New RFI")}
          </button>
        }
      />

      <RfiClock rfis={rfis} activityCode={(id) => activities.find((a) => a.id === id)?.code ?? null} onOpen={(id) => navigate(R.rfi(id))} />

      <StagePath kind="rfi" path={PATHS.rfi} counts={counts} value={stage} onChange={setStage} extras={["OVERDUE"]} />

      <Register
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(R.rfi(r.id))}
        initialSort={{ key: "due", dir: "asc" }}
        rowClass={(r) => (rfiOverdue(r) ? "pmr-row-late" : undefined)}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search RFIs, sheets, people" />
            <FilterChips value={disc} onChange={setDisc} options={disciplines.map((k) => ({ value: k, label: disciplineName(k, lang), count: rfis.filter((r) => r.discipline === k).length }))} />
          </Toolbar>
        }
        empty={
          <>
            {t("No RFIs match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStage(null); setDisc(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />

      <SheetLightbox sheetId={sheet} onClose={() => setSheet(null)} />
      <RfiDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          navigate(R.rfi(id));
        }}
      />
    </div>
  );
}

/** Raised → due bars on a four-week axis around today. */
function RfiClock({ rfis, activityCode, onOpen }: { rfis: Rfi[]; activityCode: (id: string) => string | null; onOpen: (id: string) => void }) {
  const { t, x, d } = useL();
  const from = addDays(TODAY, -CLOCK_BACK);
  const pos = (date: string) => Math.max(0, Math.min(1, diffDays(from, date) / CLOCK_SPAN)) * 100;

  const open = rfis.filter((r) => r.status === "OPEN").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const answered = rfis.filter((r) => r.answeredAt && r.answeredAt >= from).sort((a, b) => (b.answeredAt ?? "").localeCompare(a.answeredAt ?? ""));
  const allAnswered = rfis.filter((r) => r.answeredAt);
  const avg = allAnswered.length ? allAnswered.reduce((a, r) => a + diffDays(r.raisedAt, r.answeredAt!), 0) / allAnswered.length : 0;
  const onTime = allAnswered.filter((r) => r.answeredAt! <= r.dueAt).length;
  const overdue = open.filter(rfiOverdue);
  const dueSoon = open.filter((r) => !rfiOverdue(r) && diffDays(TODAY, r.dueAt) <= 7);
  const ticks = [0, 7, 14, 21, 28];

  return (
    <section className="pmr-clock" aria-label={t("RFI clock")}>
      <header className="pmr-clock-head">
        <div>
          <h2>{t("RFI clock")}</h2>
          <p>{t("Each open question runs from the day it was raised to its due date. Red is time past due.")}</p>
        </div>
        <div className="pmr-clock-legend">
          <span className="lg-window">{t("Waiting")}</span>
          <span className="lg-over">{t("Overdue")}</span>
          <span className="lg-done">{t("Answered")}</span>
        </div>
      </header>

      <div className="pmr-clock-body">
        <div className="pmr-clock-axis" aria-hidden="true">
          <span className="pmr-clock-gutter" />
          <div className="pmr-clock-scale">
            {ticks.map((n) => (
              <span key={n} style={{ left: `${(n / CLOCK_SPAN) * 100}%` }}>
                {d(addDays(from, n), false)}
              </span>
            ))}
          </div>
        </div>

        <div className="pmr-clock-rows">
          <div className="pmr-clock-grid" aria-hidden="true">
            <span className="pmr-clock-gutter" />
            <div>
              {ticks.map((n) => (
                <i key={n} style={{ left: `${(n / CLOCK_SPAN) * 100}%` }} />
              ))}
              <b className="pmr-clock-today" style={{ left: `${pos(TODAY)}%` }}>
                <span>{t("Today")}</span>
              </b>
            </div>
          </div>

          {open.map((r, i) => {
            const late = rfiOverdue(r);
            const a = pos(r.raisedAt);
            const due = pos(r.dueAt);
            const now = pos(TODAY);
            const left = diffDays(TODAY, r.dueAt);
            const code = r.activityId ? activityCode(r.activityId) : null;
            return (
              <button key={r.id} type="button" className={`pmr-clock-row${late ? " late" : ""}`} style={{ animationDelay: `${i * 60}ms` }} onClick={() => onOpen(r.id)}>
                <span className="pmr-clock-label">
                  <span className="k-ref">{r.ref}</span>
                  <span className="truncate">{x(r.subject)}</span>
                </span>
                <span className="pmr-clock-track">
                  <i className="pmr-bar-window" style={{ left: `${a}%`, width: `${Math.max(1.5, due - a)}%` }} />
                  <i className="pmr-bar-elapsed k-grow-x" style={{ left: `${a}%`, width: `${Math.max(0.8, Math.min(now, due) - a)}%` }} />
                  {late ? <i className="pmr-bar-over k-grow-x" style={{ left: `${due}%`, width: `${now - due}%` }} /> : null}
                  <i className="pmr-bar-cap" style={{ left: `${due}%` }} />
                  <em className={late ? "k-text-bad" : left <= 3 ? "k-text-warn" : undefined} style={labelAt(Math.max(now, due), a)}>
                    {late ? t("+{n} d late", { n: -left }) : t("{n} d left", { n: left })}
                    {code ? <small> · {code}</small> : null}
                  </em>
                </span>
              </button>
            );
          })}

          {answered.map((r, i) => {
            const a = pos(r.raisedAt);
            const b = pos(r.answeredAt!);
            return (
              <button key={r.id} type="button" className="pmr-clock-row done" style={{ animationDelay: `${(open.length + i) * 60}ms` }} onClick={() => onOpen(r.id)}>
                <span className="pmr-clock-label">
                  <span className="k-ref">{r.ref}</span>
                  <span className="truncate">{x(r.subject)}</span>
                </span>
                <span className="pmr-clock-track">
                  <i className="pmr-bar-done k-grow-x" style={{ left: `${a}%`, width: `${Math.max(1.5, b - a)}%` }} />
                  <span className="pmr-bar-tick" style={{ left: `${b}%` }}>
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <em className="k-text-ok" style={labelAt(b, a)}>
                    {t("answered in {n} d", { n: diffDays(r.raisedAt, r.answeredAt!) })}
                  </em>
                </span>
              </button>
            );
          })}

          {!open.length && !answered.length ? <p className="muted small pmr-clock-empty">{t("No questions open or answered in these four weeks.")}</p> : null}
        </div>
      </div>

      <footer className="pmr-clock-foot">
        <div>
          <small>{t("Average answer time")}</small>
          <b className="num-inline">{t("{n} days", { n: avg.toFixed(1) })}</b>
        </div>
        <div className={overdue.length ? "bad" : undefined}>
          <small>{t("Overdue now")}</small>
          <b className="num-inline">{overdue.length}</b>
        </div>
        <div>
          <small>{t("Due in the next 7 days")}</small>
          <b className="num-inline">{dueSoon.length}</b>
        </div>
        <div>
          <small>{t("Answered on time")}</small>
          <b className="num-inline">{allAnswered.length ? `${Math.round((onTime / allAnswered.length) * 100)}%` : "—"}</b>
        </div>
      </footer>
    </section>
  );
}

/** Label after the bar end, or before the bar start when the bar runs to the right edge. */
function labelAt(end: number, start: number) {
  return end > 74 ? { right: `${100 - start}%`, marginRight: 10, marginLeft: 0 } : { left: `${end}%` };
}
