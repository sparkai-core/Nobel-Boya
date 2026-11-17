import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { Avatar, Badge, FilterChips, KeyVals, Meter, Register, SearchBox, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { setAttendance } from "../../../ops/ext/site-p2";
import { dowShort, TODAY, toDate } from "../../../ops/dates";
import { R } from "../../../ops/select";
import type { Activity, AttendanceStatus, Worker } from "../../../ops/types";
import { DrawerSection, isRestDay, ROLE, siteMeta, WEEK } from "./shared";
import { certState, liveActivity, onSite, statusOn, weekHours } from "./workforce-model";
import { ATT_ORDER } from "./RollCall";
import { useRenewCert } from "./WorkforceMore";

const CYCLE: (AttendanceStatus | null)[] = [null, ...ATT_ORDER];
const nextStatus = (s: AttendanceStatus | null) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length] ?? null;

function CertsCell({ w }: { w: Worker }) {
  const { t } = useL();
  const expired = w.certs.filter((c) => certState(c.expires) === "expired").length;
  const soon = w.certs.filter((c) => certState(c.expires) === "soon").length;
  return (
    <span className="st-certcell">
      <span className="num-inline">{w.certs.length}</span>
      {expired ? <Badge tone="bad">{t("{n} expired", { n: expired })}</Badge> : null}
      {soon ? <Badge tone="warn">{t("{n} expiring", { n: soon })}</Badge> : null}
    </span>
  );
}

// ---------------------------------------------------------------- workers

export function WorkersTab() {
  const { t, x } = useL();
  const workers = useOps((s) => s.workers);
  const subs = useOps((s) => s.subs);
  const activities = useOps((s) => s.activities);
  const [trade, setTrade] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const trades = [...new Set(workers.map((w) => w.trade.en))];
  const filtered = useMemo(() => workers.filter((w) => !trade || w.trade.en === trade), [workers, trade]);
  const subName = (id: string) => subs.find((s) => s.id === id)?.name ?? id;
  const rows = useSearch(filtered, q, (w) => [w.name, w.trade, subName(w.employer), activities.find((a) => a.id === w.activityId)?.code]);
  const opened = workers.find((w) => w.id === openId);

  const columns: Column<Worker>[] = [
    {
      key: "name",
      header: t("Name"),
      sort: (w) => w.name,
      render: (w) => (
        <span className="st-person">
          <Avatar name={w.name} size={28} />
          <span className="k-cell-title">
            <strong>{w.name}</strong>
            <small>{x(ROLE[w.role] ?? { en: w.role, az: w.role })}</small>
          </span>
        </span>
      ),
    },
    { key: "trade", header: t("Trade"), sort: (w) => x(w.trade), render: (w) => x(w.trade), hideBelow: 820 },
    { key: "employer", header: t("Employer"), sort: (w) => subName(w.employer), render: (w) => <span className="small">{subName(w.employer)}</span>, hideBelow: 900 },
    { key: "rate", header: t("Rate, AZN/h"), sort: (w) => w.rate, align: "right", render: (w) => <span className="num-inline">{w.rate.toFixed(2)}</span>, hideBelow: 820 },
    {
      key: "activity",
      header: t("Activity"),
      sort: (w) => activities.find((a) => a.id === w.activityId)?.code ?? "",
      render: (w) => {
        const a = activities.find((y) => y.id === w.activityId);
        return a ? <span className="k-ref">{a.code}</span> : <span className="muted small">{t("Unassigned")}</span>;
      },
    },
    { key: "certs", header: t("Certificates held"), sort: (w) => w.certs.filter((c) => certState(c.expires) !== "ok").length, render: (w) => <CertsCell w={w} /> },
  ];

  return (
    <>
      <Register
        rows={rows}
        columns={columns}
        rowKey={(w) => w.id}
        onRowClick={(w) => setOpenId(w.id)}
        pageSize={12}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search workers, trades, employers" />
            <FilterChips value={trade} onChange={setTrade} options={trades.map((tr) => ({ value: tr, label: x(workers.find((w) => w.trade.en === tr)!.trade), count: workers.filter((w) => w.trade.en === tr).length }))} />
          </Toolbar>
        }
        empty={t("No workers match.")}
      />
      <Drawer open={!!opened} onClose={() => setOpenId(null)} kicker={opened ? `${opened.id} · ${x(opened.trade)}` : undefined} title={opened?.name ?? ""} width={460}>
        {opened ? <WorkerDetail w={opened} /> : null}
      </Drawer>
      {opened ? <div className="st-scrim" onClick={() => setOpenId(null)} aria-hidden="true" /> : null}
    </>
  );
}

function WorkerDetail({ w }: { w: Worker }) {
  const { t, x, d, rel, lang } = useL();
  const subs = useOps((s) => s.subs);
  const activities = useOps((s) => s.activities);
  const attendance = useOps((s) => s.attendance);
  const a = activities.find((y) => y.id === w.activityId);
  const hours = weekHours(attendance, w.id);

  const renewCert = useRenewCert();
  const renew = (idx: number) => renewCert(w, idx);

  return (
    <div className="k-stack st-drawer">
      <div className="k-row">
        <Avatar name={w.name} size={40} />
        <div className="k-cell-title">
          <strong>{x(ROLE[w.role] ?? { en: w.role, az: w.role })}</strong>
          <small>{subs.find((s) => s.id === w.employer)?.name ?? w.employer}</small>
        </div>
      </div>
      <KeyVals
        items={[
          { k: t("Trade"), v: x(w.trade) },
          { k: t("Rate"), v: <span className="num-inline">{w.rate.toFixed(2)} {t("AZN/h")}</span> },
          { k: t("Activity"), v: a ? <Link to={R.programme(a.id)}>{a.code} · {x(a.name)}</Link> : t("Unassigned") },
          { k: t("This week"), v: <span className="num-inline">{hours} {t("h")} · {Math.round(hours * w.rate)} AZN</span> },
        ]}
      />
      <DrawerSection title={t("Last 7 days")} aside={<span className="muted small">{t("Click a day to change it")}</span>}>
        <div className="st-weekcells">
          {WEEK.map((day) => {
            const st = statusOn(attendance, w.id, day);
            return (
              <button
                key={day}
                type="button"
                className={`st-cell ${st ? `st-att-${st.toLowerCase()}` : "none"}${isRestDay(day) ? " rest" : ""}`}
                title={st ? x(siteMeta("attendance", st).label) : t("No record")}
                onClick={() => {
                  const n = nextStatus(st);
                  setAttendance(day, w.id, n);
                  toast(t("{name}: {status} on {date}", { name: w.name, status: n ? x(siteMeta("attendance", n).label) : t("No record"), date: d(day, false) }), "info");
                }}
              >
                <small>{dowShort(toDate(day).getUTCDay(), lang)}</small>
                <b>{toDate(day).getUTCDate()}</b>
              </button>
            );
          })}
        </div>
      </DrawerSection>
      <DrawerSection title={t("Certificates held")}>
        <ul className="st-certs">
          {w.certs.map((c, i) => {
            const st = certState(c.expires);
            return (
              <li key={i} className={st}>
                <BadgeCheck size={15} />
                <span className="k-cell-title">
                  <strong>{x(c.name)}</strong>
                  <small>
                    {d(c.expires)} · {rel(c.expires)}
                  </small>
                </span>
                {st !== "ok" ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => renew(i)}>
                    {t("Renew")}
                  </button>
                ) : (
                  <Badge tone="ok">{t("Valid")}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </DrawerSection>
    </div>
  );
}

// ---------------------------------------------------------------- attendance grid

export function AttendanceTab() {
  const { t, x, d, lang } = useL();
  const workers = useOps((s) => s.workers);
  const attendance = useOps((s) => s.attendance);
  const [trade, setTrade] = useState<string | null>(null);
  const trades = [...new Set(workers.map((w) => w.trade.en))];
  const shown = workers.filter((w) => !trade || w.trade.en === trade);

  const perDay = WEEK.map((day) => {
    const rows = attendance.filter((a) => a.date === day && shown.some((w) => w.id === a.workerId));
    return { day, present: rows.filter((r) => onSite(r.status)).length, hours: rows.reduce((s, r) => s + r.hours, 0) };
  });
  const total = perDay.reduce((s, p) => s + p.hours, 0);
  const maxH = Math.max(1, ...perDay.map((p) => p.hours));

  const cycle = (workerId: string, name: string, day: string) => {
    const n = nextStatus(statusOn(attendance, workerId, day));
    setAttendance(day, workerId, n);
    toast(t("{name}: {status} on {date}", { name, status: n ? x(siteMeta("attendance", n).label) : t("No record"), date: d(day, false) }), "info");
  };

  return (
    <div className="k-stack">
      <div className="k-row st-att-top">
        <FilterChips value={trade} onChange={setTrade} options={trades.map((tr) => ({ value: tr, label: x(workers.find((w) => w.trade.en === tr)!.trade), count: workers.filter((w) => w.trade.en === tr).length }))} />
        <span className="k-spacer" />
        <span className="small muted">
          {t("Click a cell to change it.")} <b className="num-inline">{total.toLocaleString("en-US")}</b> {t("man-hours this week")}
        </span>
      </div>
      <div className="st-grid-scroll">
        <table className="st-attgrid">
          <thead>
            <tr>
              <th>{t("Worker")}</th>
              {WEEK.map((day) => (
                <th key={day} className={`${isRestDay(day) ? "rest" : ""}${day === TODAY ? " today" : ""}`}>
                  <small>{dowShort(toDate(day).getUTCDay(), lang)}</small>
                  <b>{toDate(day).getUTCDate()}</b>
                </th>
              ))}
              <th className="num">{t("Hours")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((w, i) => (
              <tr key={w.id} style={{ animationDelay: `${Math.min(i, 16) * 18}ms` }}>
                <th scope="row">
                  <span className="st-person">
                    <Avatar name={w.name} size={22} />
                    <span>{w.name}</span>
                  </span>
                </th>
                {WEEK.map((day) => {
                  const st = statusOn(attendance, w.id, day);
                  return (
                    <td key={day} className={`${isRestDay(day) ? "rest" : ""}${day === TODAY ? " today" : ""}`}>
                      <button type="button" className={`st-cell ${st ? `st-att-${st.toLowerCase()}` : "none"}`} title={`${w.name} · ${d(day, false)} · ${st ? x(siteMeta("attendance", st).label) : t("No record")}`} onClick={() => cycle(w.id, w.name, day)} aria-label={`${w.name} ${d(day, false)}`}>
                        {st === "HALF" ? "½" : st ? x(siteMeta("attendance", st).label).slice(0, 1) : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="num num-inline">{weekHours(attendance, w.id)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t("On site")}</th>
              {perDay.map((p) => (
                <td key={p.day} className={`num-inline${isRestDay(p.day) ? " rest" : ""}`}>
                  {p.present}
                </td>
              ))}
              <td />
            </tr>
            <tr>
              <th scope="row">{t("Man-hours")}</th>
              {perDay.map((p) => (
                <td key={p.day} className={isRestDay(p.day) ? "rest" : undefined}>
                  <span className="st-mh">
                    <i className="k-grow-y" style={{ height: `${(p.hours / maxH) * 100}%` }} />
                    <b className="num-inline">{p.hours}</b>
                  </span>
                </td>
              ))}
              <td className="num num-inline">
                <b>{total}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <AttLegend />
    </div>
  );
}

export function AttLegend() {
  const { t, x } = useL();
  return (
    <div className="st-attlegend">
      {ATT_ORDER.map((st) => (
        <span key={st}>
          <i className={`st-att-${st.toLowerCase()}`} />
          {x(siteMeta("attendance", st).label)}
        </span>
      ))}
      <span>
        <i className="none" />
        {t("No record")}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- allocations

export function AllocationsTab() {
  const { t, x } = useL();
  const workers = useOps((s) => s.workers);
  const activities = useOps((s) => s.activities);
  const attendance = useOps((s) => s.attendance);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);

  const lanes: (Activity | null)[] = [
    ...activities.filter((a) => liveActivity(a) || workers.some((w) => w.activityId === a.id)).sort((a, b) => b.crew - a.crew),
    ...(workers.some((w) => !w.activityId) ? [null] : []),
  ];
  const options = activities.filter((a) => a.status !== "COMPLETED" && !a.isMilestone);

  const move = (w: Worker, to: string) => {
    const a = activities.find((y) => y.id === to) ?? null;
    patchItem("workers", w.id, { activityId: a?.id ?? null });
    pushFeed("PM", a ? { en: `${w.name} moved to ${a.code} ${a.name.en}`, az: `${w.name} ${a.code} ${a.name.az} işinə keçirildi` } : { en: `${w.name} taken off their activity`, az: `${w.name} işdən ayrıldı` }, "pm/workforce?tab=allocations");
    toast(a ? t("{name} moved to {code}", { name: w.name, code: a.code }) : t("{name} is now unassigned", { name: w.name }));
  };

  return (
    <div className="st-lanes">
      {lanes.map((a, i) => {
        const crew = workers.filter((w) => (a ? w.activityId === a.id : !w.activityId));
        const here = crew.filter((w) => onSite(statusOn(attendance, w.id, TODAY))).length;
        const planned = a?.crew ?? 0;
        const short = a && liveActivity(a) ? Math.max(0, planned - here) : 0;
        return (
          <section key={a?.id ?? "none"} className={`st-lane${short ? " short" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
            <header>
              <div className="k-cell-title">
                <strong>{a ? `${a.code} · ${x(a.name)}` : t("Unassigned")}</strong>
                <small>{a ? (liveActivity(a) ? t("{h} on site today of {p} planned", { h: here, p: planned }) : t("Not running now")) : t("Waiting for an activity")}</small>
              </div>
              {short ? <Badge tone={short > planned / 2 ? "bad" : "warn"}>{t("{n} short", { n: short })}</Badge> : null}
            </header>
            {a && planned ? <Meter value={here / planned} tone={short > planned / 2 ? "bad" : short ? "warn" : "ok"} /> : null}
            <div className="st-lane-stack">
              <span className="k-avatars">
                {crew.slice(0, 8).map((w) => (
                  <Avatar key={w.id} name={w.name} size={26} />
                ))}
              </span>
              {crew.length > 8 ? <span className="small muted">+{crew.length - 8}</span> : null}
              {!crew.length ? <span className="small muted">{t("Nobody assigned")}</span> : null}
            </div>
            {crew.length ? (
              <ul>
                {crew.map((w) => {
                  const st = statusOn(attendance, w.id, TODAY);
                  return (
                    <li key={w.id}>
                      <i className={`st-dot ${st ? `st-att-${st.toLowerCase()}` : "none"}`} title={st ? x(siteMeta("attendance", st).label) : t("No record")} />
                      <span className="k-cell-title">
                        <strong>{w.name}</strong>
                        <small>{x(w.trade)}</small>
                      </span>
                      <select className="input select" value={w.activityId ?? ""} onChange={(e) => move(w, e.target.value)} aria-label={t("Reassign {name}", { name: w.name })}>
                        <option value="">{t("Unassigned")}</option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.code}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

