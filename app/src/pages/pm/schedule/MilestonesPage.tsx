import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Coins, Flag, GitBranch } from "lucide-react";
import { Badge, FilterChips, KeyVals, Money, PageHero, Panel, StatusBadge, useL } from "../../../components/kit";
import { addDays, diffDays, monthShort, PROJECT_FINISH, TODAY, toDate } from "../../../ops/dates";
import { R, statusMeta, type MilestoneState } from "../../../ops/select";
import { milestoneRows, MS_TONE, useSchedule } from "./model";
import { ProjectRunStrip } from "./ProjectRunStrip";

const STATES: MilestoneState[] = ["DONE", "ON_TRACK", "WATCH", "AT_RISK", "LATE"];

/**
 * Milestones: a slip chart (target ◇ vs forecast ◆ on one calendar, red when late, green when early)
 * and a detail card that explains each status from the activities that drive the date.
 */
export function MilestonesPage() {
  const { t, x, d, lang } = useL();
  const [params, setParams] = useSearchParams();
  const { activities, milestones, links, cp, byId } = useSchedule();
  const rows = useMemo(() => milestoneRows(milestones, activities).sort((a, b) => a.m.target.localeCompare(b.m.target)), [milestones, activities]);
  const state = params.get("state") as MilestoneState | null;
  const picked = params.get("m") ?? rows.find((r) => !r.f.done)?.m.id ?? rows[0]?.m.id ?? null;
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v == null) p.delete(k);
    else p.set(k, v);
    setParams(p, { replace: true });
  };
  const shown = rows.filter((r) => !state || r.f.state === state);
  const counts = STATES.reduce<Record<string, number>>((a, s) => ((a[s] = rows.filter((r) => r.f.state === s).length), a), {});

  // Axis: whole months around every date on the chart.
  const allDates = rows.flatMap((r) => [r.m.target, r.f.forecast]);
  const first = [TODAY, ...allDates].sort()[0]!;
  const last = [PROJECT_FINISH, ...allDates].sort().slice(-1)[0]!;
  const from = `${first.slice(0, 7)}-01`;
  const lastMonth = toDate(addDays(last, 31));
  const to = `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const span = Math.max(1, diffDays(from, to));
  const pos = (date: string) => (diffDays(from, date) / span) * 100;
  const months: string[] = [];
  for (let m = from; m < to; ) {
    months.push(m);
    const dt = toDate(m);
    const y = dt.getUTCMonth() === 11 ? dt.getUTCFullYear() + 1 : dt.getUTCFullYear();
    const mm = (dt.getUTCMonth() + 1) % 12;
    m = `${y}-${String(mm + 1).padStart(2, "0")}-01`;
  }

  const sel = rows.find((r) => r.m.id === picked);
  const paymentAtRisk = rows.filter((r) => !r.f.done && r.f.slip > 0 && r.m.payment).reduce((a, r) => a + (r.m.payment ?? 0), 0);

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Milestones")}
        title={t("Milestones")}
        subtitle={t("The dates the client and the payment schedule care about, forecast live from the activities that drive them.")}
        flow={["Target", "Forecast from drivers", "Slip", "Payment"]}
        art="milestone"
      />

      <ProjectRunStrip />

      <section className="pms-slip-panel">
        <header className="pms-slip-head">
          <div>
            <h2>{t("Slip chart")}</h2>
            <p className="muted small">
              {t("Hollow diamond: target. Filled: forecast or actual. The line between them is red when late, green when early.")}
              {paymentAtRisk ? (
                <>
                  {" "}
                  <b className="k-text-bad">{t("{v} AZN of payments ride on late milestones.", { v: Math.round(paymentAtRisk).toLocaleString("en-GB") })}</b>
                </>
              ) : null}
            </p>
          </div>
          <FilterChips<MilestoneState> value={state} onChange={(v) => setParam("state", v)} options={STATES.filter((s) => counts[s]).map((s) => ({ value: s, label: x(statusMeta("milestone", s).label), count: counts[s] }))} />
        </header>
        <div className="pms-slip-scroll">
          <div className="pms-slip">
            <div className="pms-slip-axis">
              <span />
              <div>
                {months.map((m) => (
                  <small key={m} style={{ left: `${pos(m)}%` }} className={m.endsWith("-01-01") ? "major" : undefined}>
                    {monthShort(toDate(m).getUTCMonth(), lang)}
                    {m.endsWith("-01-01") || m === from ? ` ${m.slice(2, 4)}` : ""}
                  </small>
                ))}
              </div>
            </div>
            <div className="pms-slip-body">
              <div className="pms-slip-lines" aria-hidden="true">
                {months.map((m) => (
                  <i key={m} style={{ left: `${pos(m)}%` }} />
                ))}
                <b className="today" style={{ left: `${pos(TODAY)}%` }}>
                  <span>{t("Today")}</span>
                </b>
                <b className="contract" style={{ left: `${pos(PROJECT_FINISH)}%` }}>
                  <span>{t("Contract completion")}</span>
                </b>
              </div>
              {shown.length ? (
                shown.map(({ m, f }, i) => {
                  const a = pos(m.target);
                  const b = pos(f.done ? (m.actual ?? f.forecast) : f.forecast);
                  const tone = MS_TONE[f.state];
                  return (
                    <button key={m.id} type="button" className={`pms-slip-row${picked === m.id ? " sel" : ""}`} onClick={() => setParam("m", m.id)} style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="pms-slip-label">
                        <span className="pms-code">{m.code}</span>
                        <span className="truncate">{x(m.name)}</span>
                      </span>
                      <span className="pms-slip-track">
                        {f.slip !== 0 ? <i className={`pms-slip-line ${f.slip > 0 ? "late" : "early"}`} style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(b - a)}%` }} /> : null}
                        <i className="pms-diamond hollow" style={{ left: `${a}%` }} title={`${t("Target")} ${d(m.target)}`} />
                        <i className={`pms-diamond filled k-tone-${tone}`} style={{ left: `${b}%` }} title={`${f.done ? t("Actual") : t("Forecast")} ${d(f.forecast)}`} />
                        <span className={`pms-slip-tag k-text-${tone}`} style={{ left: `${Math.max(a, b)}%` }}>
                          {f.done ? "✓" : f.slip > 0 ? `+${f.slip}` : f.slip < 0 ? `−${-f.slip}` : t("on time")}
                        </span>
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="k-register-empty">{t("No milestones in this state.")}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {sel ? (
        <Panel
          title={
            <>
              <span className="pms-code">{sel.m.code}</span> {x(sel.m.name)}
            </>
          }
          icon={<Flag size={15} />}
          actions={<StatusBadge kind="milestone" status={sel.f.state} />}
          className="pms-ms-detail"
        >
          <div className="k-grid-2">
            <div className="k-stack">
              <KeyVals
                cols={4}
                items={[
                  { k: t("Target"), v: d(sel.m.target) },
                  { k: t("Baseline"), v: d(sel.m.baseline) },
                  { k: sel.f.done ? t("Actual") : t("Forecast"), v: <span className={`k-text-${MS_TONE[sel.f.state]}`}>{d(sel.f.done ? (sel.m.actual ?? sel.f.forecast) : sel.f.forecast)}</span> },
                  { k: t("Slip"), v: <span className={sel.f.slip > 0 ? "k-text-bad" : "k-text-ok"}>{sel.f.slip > 0 ? t("{n} days late", { n: sel.f.slip }) : sel.f.slip < 0 ? t("{n} days early", { n: -sel.f.slip }) : t("On time")}</span> },
                ]}
              />
              <div className="pms-ms-pay">
                <Coins size={16} />
                {sel.m.payment ? (
                  <span>
                    {t("Payment tied to it")}: <Money value={sel.m.payment} />
                    {sel.f.slip > 0 && !sel.f.done ? <small className="k-text-bad"> · {t("cash arrives {n} days later", { n: sel.f.slip })}</small> : null}
                  </span>
                ) : (
                  <span className="muted">{t("No payment is tied to this milestone.")}</span>
                )}
              </div>
              <div className={`k-callout k-tone-${MS_TONE[sel.f.state]}`}>
                <div>
                  <strong>{t("Why it has this status")}</strong>
                  <p>{why(sel)}</p>
                </div>
              </div>
            </div>
            <div className="k-stack">
              <div>
                <h3 className="pms-h3">{t("What drives this date")}</h3>
                <ul className="pms-drivers-list">
                  {sel.m.drivers.map((id) => {
                    const a = byId.get(id);
                    if (!a) return null;
                    const c = cp.get(id);
                    const isLast = a.end === sel.f.forecast;
                    return (
                      <li key={id} className={isLast ? "driving" : undefined}>
                        <Link to={R.programme(id)}>
                          <span className="pms-code">{a.code}</span>
                          <span className="pms-drv-name">
                            <strong className="truncate">{x(a.name)}</strong>
                            <small>
                              {t("finishes {date}", { date: d(a.end) })} · {a.pct}% · {c ? (c.critical ? t("critical") : t("{n} days float", { n: c.tf })) : ""}
                            </small>
                          </span>
                          {isLast ? <Badge tone="brand">{t("Sets the date")}</Badge> : null}
                          <ArrowRight size={13} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={`pms-ms-crit${sel.m.drivers.some((id) => cp.get(id)?.critical && byId.get(id)?.status !== "COMPLETED") ? " on" : ""}`}>
                <GitBranch size={15} />
                {sel.m.drivers.some((id) => cp.get(id)?.critical && byId.get(id)?.status !== "COMPLETED") ? (
                  <span>
                    {t("On the critical path: every day lost here moves the finish.")}{" "}
                    <Link to={R.critical} className="k-link-btn">
                      {t("Critical path")} <ArrowRight size={12} />
                    </Link>
                  </span>
                ) : (
                  <span>{t("Not on the critical path: its drivers have float.")}</span>
                )}
              </div>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );

  function why(r: (typeof rows)[number]) {
    const drivers = r.m.drivers.map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
    const last = drivers.find((a) => a.end === r.f.forecast) ?? drivers[0];
    const name = last ? `${last.code} ${x(last.name)}` : "";
    if (r.f.done) return t("Every driving activity is complete. It was reached on {date}.", { date: d(r.m.actual ?? r.f.forecast) });
    if (r.f.slip <= 0) return t("{name} finishes {date}, on or before the target. It stays on track while that holds.", { name, date: d(r.f.forecast) });
    // Look upstream from the driving activity for anything blocked.
    const seen = new Set<string>();
    const stack = last ? [last.id] : [];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const l of links) if (l.to === cur) stack.push(l.from);
    }
    const blocked = [...drivers, ...[...seen].map((id) => byId.get(id))].find((a) => a?.status === "BLOCKED");
    const base = t("{name} now finishes {date}, {n} days after the target.", { name, date: d(r.f.forecast), n: r.f.slip });
    const band = r.f.state === "WATCH" ? t("Up to 5 days late is Watch.") : r.f.state === "AT_RISK" ? t("6 to 10 days late is At risk.") : t("More than 10 days late is Forecast late.");
    return `${base} ${band}${blocked ? ` ${t("Upstream, {code} is blocked.", { code: blocked.code })}` : ""}`;
  }
}
