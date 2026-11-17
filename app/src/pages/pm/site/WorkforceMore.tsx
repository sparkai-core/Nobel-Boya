import { Fragment, useMemo } from "react";
import { CheckCircle2, Gauge, Stamp } from "lucide-react";
import { Avatar, Badge, BarList, Panel, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { fmtMoney } from "../../../lib/format";
import type { Worker } from "../../../ops/types";
import { WEEK } from "./shared";
import { certState, crewOutput, crewsWithoutOutput, onSite, timesheetText, weekHours, type CertState } from "./workforce-model";

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

// ---------------------------------------------------------------- timesheets

export function TimesheetsTab() {
  const { t, x, d } = useL();
  const workers = useOps((s) => s.workers);
  const subs = useOps((s) => s.subs);
  const attendance = useOps((s) => s.attendance);
  const feed = useOps((s) => s.feed);
  const pushFeed = useOps((s) => s.pushFeed);
  const groups = [...new Set(workers.map((w) => w.employer))].map((emp) => {
    const sub = subs.find((s) => s.id === emp);
    const list = workers.filter((w) => w.employer === emp);
    const rows = list.map((w) => {
      const hours = weekHours(attendance, w.id);
      const days = WEEK.filter((day) => onSite(attendance.find((a) => a.date === day && a.workerId === w.id)?.status ?? null)).length;
      return { w, hours, days, cost: hours * w.rate };
    });
    const name = sub?.name ?? emp;
    const text = timesheetText(name);
    return { emp, name, rows, hours: rows.reduce((a, r) => a + r.hours, 0), cost: rows.reduce((a, r) => a + r.cost, 0), approved: feed.some((f) => f.text.en === text.en), text };
  });
  const approve = (g: (typeof groups)[number]) => {
    pushFeed("PM", g.text, "pm/workforce?tab=timesheets");
    toast(t("Timesheets approved for {name}: {h} h, {c} AZN", { name: g.name, h: fmt(g.hours), c: fmt(g.cost) }));
  };
  const total = groups.reduce((a, g) => a + g.cost, 0);

  return (
    <div className="k-stack">
      <div className="k-grid-main">
        <Panel title={t("Labour cost this week")} icon={<Gauge size={15} />} sub={t("Hours from attendance × each worker's rate, {from} – {to}.", { from: d(WEEK[0]!, false), to: d(TODAY, false) })}>
          <BarList items={groups.map((g) => ({ key: g.emp, label: g.name, sub: t("{n} workers · {h} h", { n: g.rows.length, h: fmt(g.hours) }), value: g.cost, tone: g.approved ? "ok" : "brand" }))} format={(v) => `${fmt(v)} AZN`} />
        </Panel>
        <Panel title={t("Week total")}>
          <div className="st-bigfig">
            <strong className="num-inline">{fmt(total)}</strong>
            <span>AZN</span>
          </div>
          <p className="small muted">{t("{a} of {n} employers approved", { a: groups.filter((g) => g.approved).length, n: groups.length })}</p>
        </Panel>
      </div>
      {groups.map((g) => (
        <Panel
          key={g.emp}
          title={g.name}
          count={g.rows.length}
          actions={
            g.approved ? (
              <Badge tone="ok">
                <CheckCircle2 size={12} /> {t("Approved")}
              </Badge>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(g)}>
                <Stamp size={13} />
                {t("Approve timesheets")}
              </button>
            )
          }
          pad={false}
        >
          <div className="st-grid-scroll">
            <table className="st-ts">
              <thead>
                <tr>
                  <th>{t("Worker")}</th>
                  <th className="hide-sm">{t("Trade")}</th>
                  <th className="num">{t("Days on site")}</th>
                  <th className="num">{t("Hours")}</th>
                  <th className="num hide-sm">{t("Rate")}</th>
                  <th className="num">{t("Cost, AZN")}</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.w.id}>
                    <td>
                      <span className="st-person">
                        <Avatar name={r.w.name} size={22} />
                        {r.w.name}
                      </span>
                    </td>
                    <td className="hide-sm muted">{x(r.w.trade)}</td>
                    <td className="num num-inline">{r.days}</td>
                    <td className="num num-inline">{r.hours}</td>
                    <td className="num num-inline hide-sm">{r.w.rate.toFixed(2)}</td>
                    <td className="num num-inline">{fmtMoney(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>{t("Total")}</th>
                  <td className="hide-sm" />
                  <td />
                  <td className="num num-inline">{g.hours}</td>
                  <td className="hide-sm" />
                  <td className="num num-inline">
                    <b>{fmtMoney(g.cost)}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- compliance

/** Renew a worker's certificate for a year (from its expiry, or from today when it has lapsed). */
export function useRenewCert() {
  const { t, x, d } = useL();
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  return (w: Worker, idx: number) => {
    const cert = w.certs[idx];
    if (!cert) return;
    const base = cert.expires > TODAY ? cert.expires : TODAY;
    const next = `${Number(base.slice(0, 4)) + 1}${base.slice(4)}`;
    patchItem("workers", w.id, { certs: w.certs.map((c, i) => (i === idx ? { ...c, expires: next } : c)) });
    pushFeed("PM", { en: `${cert.name.en} renewed for ${w.name} to ${next}`, az: `${w.name} üçün ${cert.name.az} ${next} tarixinədək yeniləndi` }, "pm/workforce?tab=compliance");
    toast(t("{cert} renewed to {date}", { cert: x(cert.name), date: d(next) }));
  };
}

const FROM = -14;
const TO = 90;
const SPAN = TO - FROM;
const pos = (iso: string) => ((Math.max(FROM, Math.min(TO, diffDays(TODAY, iso))) - FROM) / SPAN) * 100;
const TONE: Record<CertState, "bad" | "warn" | "ok"> = { expired: "bad", soon: "warn", ok: "ok" };

export function ComplianceTab() {
  const { t, x, d, rel } = useL();
  const workers = useOps((s) => s.workers);
  const all = useMemo(() => workers.flatMap((w) => w.certs.map((c, idx) => ({ w, c, idx, state: certState(c.expires) }))), [workers]);
  const certNames = [...new Set(all.map((a) => a.c.name.en))];
  const trades = [...new Set(workers.map((w) => w.trade.en))];
  const due = all.filter((a) => a.state !== "ok").sort((a, b) => a.c.expires.localeCompare(b.c.expires));

  const renew = useRenewCert();

  return (
    <div className="k-stack">
      <Panel title={t("Certificate expiry, next 90 days")} sub={t("Each dot is one worker's certificate. Red ones have already expired; amber ones run out within 30 days.")}>
        <div className="st-grid-scroll">
          <div className="st-expiry">
            <div className="st-expiry-axis">
              {[FROM, 0, 30, 60, 90].map((n) => (
                <span key={n} style={{ left: `${((n - FROM) / SPAN) * 100}%` }} className={n === 0 ? "today" : undefined}>
                  {n === 0 ? t("Today") : n === FROM ? t("Expired") : `+${n} ${t("d")}`}
                </span>
              ))}
            </div>
            {certNames.map((name) => {
              const list = all.filter((a) => a.c.name.en === name);
              const inside = list.filter((a) => diffDays(TODAY, a.c.expires) <= TO);
              const later = list.length - inside.length;
              const seen = new Map<number, number>();
              return (
                <div key={name} className="st-expiry-row">
                  <span className="st-expiry-label">
                    <strong>{x(list[0]!.c.name)}</strong>
                    <small>
                      {list.length} {t("held")}
                      {later ? ` · ${t("{n} later", { n: later })}` : ""}
                    </small>
                  </span>
                  <span className="st-expiry-track">
                    <i className="band-exp" style={{ width: `${((0 - FROM) / SPAN) * 100}%` }} />
                    <i className="band-soon" style={{ left: `${((0 - FROM) / SPAN) * 100}%`, width: `${(30 / SPAN) * 100}%` }} />
                    <i className="st-expiry-today" style={{ left: `${((0 - FROM) / SPAN) * 100}%` }} />
                    {inside.map((a) => {
                      const p = Math.round(pos(a.c.expires));
                      const k = seen.get(p) ?? 0;
                      seen.set(p, k + 1);
                      return (
                        <button key={`${a.w.id}-${a.idx}`} type="button" className={`st-expiry-dot k-tone-${TONE[a.state]}`} style={{ left: `${pos(a.c.expires)}%`, top: `${8 + (k % 4) * 9}px` }} title={`${a.w.name} · ${x(a.c.name)} · ${d(a.c.expires)}`} onClick={() => a.state !== "ok" && renew(a.w, a.idx)} aria-label={`${a.w.name} ${x(a.c.name)} ${d(a.c.expires)}`} />
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="k-grid-2">
        <Panel title={t("To renew")} count={due.length} pad={!due.length}>
          {due.length ? (
            <ul className="st-renew">
              {due.map((a) => (
                <li key={`${a.w.id}-${a.idx}`}>
                  <Avatar name={a.w.name} size={26} />
                  <span className="k-cell-title">
                    <strong>{a.w.name}</strong>
                    <small>
                      {x(a.c.name)} · {d(a.c.expires)} · {rel(a.c.expires)}
                    </small>
                  </span>
                  <Badge tone={TONE[a.state]}>{a.state === "expired" ? t("Expired") : t("Expiring")}</Badge>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => renew(a.w, a.idx)}>
                    {t("Renew")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">{t("Every certificate is valid for more than 30 days.")}</p>
          )}
        </Panel>
        <Panel title={t("Skill matrix")} sub={t("Valid certificates held in each trade.")} pad={false}>
          <div className="st-grid-scroll">
            <table className="st-matrix">
              <thead>
                <tr>
                  <th>{t("Trade")}</th>
                  {certNames.map((n) => (
                    <th key={n}>{x(all.find((a) => a.c.name.en === n)!.c.name)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((tr) => {
                  const crew = workers.filter((w) => w.trade.en === tr);
                  return (
                    <tr key={tr}>
                      <th scope="row">
                        {x(crew[0]!.trade)} <small className="muted">({crew.length})</small>
                      </th>
                      {certNames.map((n) => {
                        const held = crew.flatMap((w) => w.certs.filter((c) => c.name.en === n));
                        const valid = held.filter((c) => certState(c.expires) !== "expired").length;
                        const soon = held.filter((c) => certState(c.expires) === "soon").length;
                        const tone = !held.length ? "none" : valid < held.length ? "bad" : soon ? "warn" : "ok";
                        return (
                          <td key={n}>
                            <span className={`st-mx ${tone}`} title={held.length ? t("{v} valid of {h} held", { v: valid, h: held.length }) : t("Not held")}>
                              {held.length ? `${valid}/${crew.length}` : "—"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- productivity

export function ProductivityTab() {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const workers = useOps((s) => s.workers);
  const attendance = useOps((s) => s.attendance);
  const reports = useOps((s) => s.reports);
  const crews = useMemo(() => crewOutput(activities, workers, attendance, reports), [activities, workers, attendance, reports]);
  const idle = crewsWithoutOutput(activities, workers, crews);
  const scale = Math.max(1.6, ...crews.map((c) => c.ratio * 1.1));
  const normAt = (1 / scale) * 100;
  const dec = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));

  return (
    <Panel title={t("Output per man-hour by crew")} icon={<Gauge size={15} />} sub={t("Quantities from the daily reports divided by attendance hours on the same activity, {from} – {to}, against the BOQ labour norm.", { from: d(addDays(TODAY, -6), false), to: d(TODAY, false) })}>
      {crews.length ? (
        <ul className="st-prod">
          {crews.map((c, i) => {
            const tone = c.ratio >= 1 ? "ok" : c.ratio >= 0.8 ? "warn" : "bad";
            return (
              <li key={c.activity.id} style={{ animationDelay: `${i * 60}ms` }}>
                <span className="st-prod-label k-cell-title">
                  <strong>
                    {c.activity.code} · {x(c.activity.name)}
                  </strong>
                  <small>{t("{w} workers · {h} man-hours · {q} {u} in {n} days", { w: c.workers, h: fmt(c.manHours), q: fmt(c.qty), u: c.unit, n: c.days })}</small>
                </span>
                <span className="st-prod-track">
                  <i className={`st-prod-bar k-grow-x k-tone-${tone}`} style={{ width: `${Math.min(100, (c.ratio / scale) * 100)}%` }} />
                  <i className="st-prod-norm" style={{ left: `${normAt}%` }}>
                    <span>
                      {t("Norm")} {dec(c.norm)}
                    </span>
                  </i>
                </span>
                <span className="st-prod-val">
                  <strong className={`num-inline k-text-${tone}`}>
                    {dec(c.rate)} {c.unit}/{t("mh")}
                  </strong>
                  <small>{t("{p}% of norm", { p: Math.round(c.ratio * 100) })}</small>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted small">{t("No crew output was logged in the daily reports this week.")}</p>
      )}
      {idle.length ? (
        <p className="small muted st-prod-note">
          {t("No output logged this week for")}{" "}
          {idle.map((a, i) => (
            <Fragment key={a.id}>
              {i ? ", " : ""}
              <b>{a.code}</b>
            </Fragment>
          ))}
          .
        </p>
      ) : null}
    </Panel>
  );
}
