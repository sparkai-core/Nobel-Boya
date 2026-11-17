import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarPlus } from "lucide-react";
import { Meter, Money, PageHero, StatTiles, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, maxDate, PROJECT_START, TODAY } from "../../../ops/dates";
import { ipcAmounts, R, sCurve } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import { prepareNextIpc } from "../../../ops/ext/records";
import type { Ipc } from "../../../ops/types";
import { WORKS_VALUE } from "./shared";

/** Days after certification that the client pays (used for the cash-in timeline). */
export const PAY_DAYS = 7;
export const ipcDue = (i: Ipc) => (i.certifiedAt ? addDays(i.certifiedAt, PAY_DAYS) : addDays(i.submittedAt ?? addDays(i.to, 2), 7 + PAY_DAYS));

/**
 * Progress billing: interim payment certificates (IPCs). Signature: cumulative billed value by month,
 * certified against claimed against the planned value of the programme, plus the cash-in timeline.
 */
export function BillingPage() {
  const { t, d } = useL();
  const navigate = useNavigate();
  const ipcs = useOps((s) => s.ipcs);
  const activities = useOps((s) => s.activities);
  const sorted = useMemo(() => [...ipcs].sort((a, b) => a.no - b.no), [ipcs]);
  const amounts = useMemo(() => new Map(sorted.map((i) => [i.id, ipcAmounts(i)])), [sorted]);

  const certified = sorted.filter((i) => i.status === "CERTIFIED" || i.status === "PAID");
  const lastCert = certified[certified.length - 1];
  const lastAny = sorted[sorted.length - 1];
  const certifiedGross = lastCert ? amounts.get(lastCert.id)!.gross : 0;
  const claimedGross = lastAny ? amounts.get(lastAny.id)!.gross : 0;
  const paid = sorted.filter((i) => i.status === "PAID").reduce((a, i) => a + amounts.get(i.id)!.due, 0);
  const retention = certified.reduce((a, i) => a + amounts.get(i.id)!.retention, 0);
  const outstanding = sorted.filter((i) => i.status === "SUBMITTED" || i.status === "CERTIFIED").reduce((a, i) => a + amounts.get(i.id)!.due, 0);

  const prepare = () => {
    const id = prepareNextIpc();
    if (!id) {
      toast(t("{id} is still a draft. Submit it before opening the next one.", { id: lastAny?.id ?? "" }), "warn");
      return;
    }
    toast(t("{id} opened as a draft from the last certificate", { id }));
    navigate(R.ipc(id));
  };

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Progress billing")}
        title={t("Progress billing (IPC)")}
        subtitle={t("Interim payment certificates measured against the BOQ: what was claimed, what the engineer certified, and when the money comes in.")}
        flow={["Measure", "Submit", "Certify", "Paid"]}
        art="billing"
        actions={
          <button type="button" className="btn btn-primary" onClick={prepare}>
            <CalendarPlus size={15} />
            {t("Prepare next IPC")}
          </button>
        }
      />

      <StatTiles
        items={[
          { label: t("Certified to date"), value: <Money value={certifiedGross} short />, sub: t("{p} of the works value", { p: `${((certifiedGross / WORKS_VALUE) * 100).toFixed(1)}%` }), tone: "brand" },
          { label: t("Claimed, not yet certified"), value: <Money value={Math.max(0, claimedGross - certifiedGross)} short />, sub: lastAny ? t("on {id}", { id: lastAny.id }) : undefined },
          { label: t("Received from the client"), value: <Money value={paid} short />, sub: t("{n} awaiting payment", { n: fmtMoneyShort(outstanding) }), tone: "ok" },
          { label: t("Retention held"), value: <Money value={retention} short />, sub: t("5% of each certified period") },
        ]}
      />

      <BillingChart ipcs={sorted} amounts={amounts} planned={sCurve(activities)} onOpen={(id) => navigate(R.ipc(id))} />

      <section className="pmr-ipcs" aria-label={t("Certificates")}>
        {[...sorted].reverse().map((i, k) => {
          const a = amounts.get(i.id)!;
          const due = ipcDue(i);
          const late = i.status === "CERTIFIED" && due < TODAY;
          return (
            <button key={i.id} type="button" className={`pmr-ipc s-${i.status}`} style={{ animationDelay: `${k * 60}ms` }} onClick={() => navigate(R.ipc(i.id))}>
              <span className="pmr-ipc-top">
                <span className="pmr-ipc-no">
                  <small>{t("IPC")}</small>
                  <b>{String(i.no).padStart(2, "0")}</b>
                </span>
                <StatusBadge kind="ipc" status={i.status} />
              </span>
              <span className="pmr-ipc-period">
                {d(i.from, false)} – {d(i.to)}
              </span>
              <span className="pmr-ipc-amt">
                <small>{t("Amount due this period")}</small>
                <Money value={a.due} />
              </span>
              <Meter value={a.gross / WORKS_VALUE} tone="brand" marker={a.prev / WORKS_VALUE} />
              <span className="pmr-ipc-foot">
                <span>{t("{p} of works to date", { p: `${((a.gross / WORKS_VALUE) * 100).toFixed(1)}%` })}</span>
                <span className={late ? "k-text-bad" : undefined}>
                  {i.status === "PAID" ? t("paid") : i.status === "DRAFT" ? t("expected {date}", { date: d(due, false) }) : t("due {date}", { date: d(due, false) })}
                </span>
              </span>
              <span className="pmr-ipc-go">
                {i.status === "DRAFT" ? t("Measure and submit") : t("Open certificate")} <ArrowRight size={13} />
              </span>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function BillingChart({ ipcs, amounts, planned, onOpen }: { ipcs: Ipc[]; amounts: Map<string, ReturnType<typeof ipcAmounts>>; planned: ReturnType<typeof sCurve>; onOpen: (id: string) => void }) {
  const { t, d } = useL();
  const last = ipcs[ipcs.length - 1];
  const end = maxDate(addDays(TODAY, 105), last ? addDays(last.to, 45) : TODAY);
  const span = diffDays(PROJECT_START, end);
  const W = 760;
  const H = 260;
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const plannedPts = planned.filter((p) => p.date <= end).map((p) => ({ date: p.date, v: p.planned * WORKS_VALUE }));
  const claimed = ipcs.map((i) => ({ ipc: i, date: i.to, v: amounts.get(i.id)!.gross }));
  const certified = claimed.filter((c) => c.ipc.status === "CERTIFIED" || c.ipc.status === "PAID");
  const maxV = Math.max(1, ...plannedPts.map((p) => p.v), ...claimed.map((c) => c.v)) * 1.1;
  const X = (date: string) => pad.l + (Math.max(0, diffDays(PROJECT_START, date)) / span) * (W - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / maxV) * (H - pad.t - pad.b);
  const step = (pts: { date: string; v: number }[]) => {
    let p = `M${X(PROJECT_START)} ${Y(0)}`;
    let prev = 0;
    for (const pt of pts) {
      p += ` L${X(pt.date)} ${Y(prev)} L${X(pt.date)} ${Y(pt.v)}`;
      prev = pt.v;
    }
    return p;
  };
  const plannedPath = plannedPts.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const months: string[] = [];
  for (let dt = PROJECT_START.slice(0, 7); `${dt}-01` <= end; ) {
    months.push(dt);
    const [y, m] = dt.split("-").map(Number) as [number, number];
    dt = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const plannedToday = (plannedPts.filter((p) => p.date <= TODAY).slice(-1)[0]?.v ?? 0);
  const certNow = certified[certified.length - 1]?.v ?? 0;

  return (
    <section className="pmr-bill">
      <header className="pmr-bill-head">
        <div>
          <h2>{t("Billed value, month by month")}</h2>
          <p>{t("Planned value comes from the programme × the BOQ works value. Steps are certificates at the end of their period.")}</p>
        </div>
        <div className="pmr-bill-gap">
          <small>{t("Certified against planned today")}</small>
          <b className={certNow < plannedToday ? "k-text-warn" : "k-text-ok"}>
            {fmtMoneyShort(certNow)} / {fmtMoneyShort(plannedToday)}
          </b>
        </div>
      </header>
      <div className="pmr-bill-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="pmr-bill-svg" role="img" aria-label={t("Billed value, month by month")}>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={pad.l} x2={W - pad.r} y1={Y(maxV * g)} y2={Y(maxV * g)} className="k-grid" />
              <text x={pad.l - 6} y={Y(maxV * g) + 4} textAnchor="end" className="k-axis">
                {fmtMoneyShort(maxV * g)}
              </text>
            </g>
          ))}
          {months.map((m) => {
            const at = `${m}-01` < PROJECT_START ? PROJECT_START : `${m}-01`;
            return (
              <g key={m}>
                <line x1={X(at)} x2={X(at)} y1={pad.t} y2={H - pad.b} className="pmr-bill-month" />
                <text x={X(at) + 4} y={H - 9} className="k-axis">
                  {d(`${m}-01`, false).replace(/^1 /, "")}
                </text>
              </g>
            );
          })}
          <path d={`${plannedPath} L${X(plannedPts[plannedPts.length - 1]?.date ?? end)} ${Y(0)} L${X(PROJECT_START)} ${Y(0)}Z`} className="k-area-planned" />
          <path d={plannedPath} className="k-line-planned" />
          <path d={step(claimed)} className="pmr-line-claimed" />
          <path d={step(certified)} className="pmr-line-certified" />
          <line x1={X(TODAY)} x2={X(TODAY)} y1={pad.t} y2={H - pad.b} className="k-today" />
          <text x={X(TODAY) + 4} y={pad.t + 10} className="pmr-bill-today">
            {t("Today")}
          </text>
          {claimed.map((c) => {
            const cert = c.ipc.status === "CERTIFIED" || c.ipc.status === "PAID";
            return (
              <g key={c.ipc.id} className="pmr-bill-pt" onClick={() => onOpen(c.ipc.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(c.ipc.id)}>
                <circle cx={X(c.date)} cy={Y(c.v)} r={cert ? 6 : 5} className={cert ? "cert" : "claim"} />
                <text x={X(c.date) - 8} y={Y(c.v) - 10} textAnchor="end" className="pmr-bill-lbl">
                  {c.ipc.id} · {fmtMoneyShort(c.v)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="k-legend">
        <span className="lg-planned">{t("Planned value")}</span>
        <span style={{ ["--lc" as string]: "#b7a6e6" }}>{t("Claimed")}</span>
        <span style={{ ["--lc" as string]: "var(--stamp)" }}>{t("Certified")}</span>
        <span className="lg-today">{t("Today")}</span>
      </div>

      <div className="pmr-cash">
        <h3>{t("Cash in")}</h3>
        {ipcs.map((i) => {
          const a = amounts.get(i.id)!;
          const due = ipcDue(i);
          const steps = [
            { key: "end", date: i.to, label: t("Period ends"), done: i.to <= TODAY },
            { key: "sub", date: i.submittedAt ?? addDays(i.to, 2), label: t("Submitted"), done: !!i.submittedAt },
            { key: "cert", date: i.certifiedAt ?? addDays(i.submittedAt ?? addDays(i.to, 2), 7), label: t("Certified"), done: !!i.certifiedAt },
            { key: "pay", date: due, label: i.status === "PAID" ? t("Paid") : t("Payment due"), done: i.status === "PAID" },
          ];
          const x0 = Math.max(0, diffDays(PROJECT_START, i.to) / span);
          const x1 = Math.min(1, diffDays(PROJECT_START, due) / span);
          return (
            <button key={i.id} type="button" className={`pmr-cash-row s-${i.status}`} onClick={() => onOpen(i.id)}>
              <span className="pmr-cash-label">
                <b>{i.id}</b>
                <Money value={a.due} short />
              </span>
              <span className="pmr-cash-track">
                <i className="pmr-cash-span" style={{ left: `${x0 * 100}%`, width: `${Math.max(0.5, (x1 - x0) * 100)}%` }} />
                {steps.map((s) => (
                  <span key={s.key} className={`pmr-cash-dot c-${s.key}${s.done ? " done" : ""}`} style={{ left: `${Math.min(1, Math.max(0, diffDays(PROJECT_START, s.date) / span)) * 100}%` }} title={`${s.label} · ${d(s.date)}`} />
                ))}
                <i className="pmr-cash-today" style={{ left: `${(diffDays(PROJECT_START, TODAY) / span) * 100}%` }} />
              </span>
            </button>
          );
        })}
        <div className="pmr-cash-key">
          <span><i className="c-end" />{t("Period ends")}</span>
          <span><i className="c-sub" />{t("Submitted")}</span>
          <span><i className="c-cert" />{t("Certified")}</span>
          <span><i className="c-pay" />{t("Paid / due")}</span>
          <span className="muted">{t("Hollow dots are expected dates. Payment is due {n} days after certification.", { n: PAY_DAYS })}</span>
        </div>
      </div>
    </section>
  );
}
