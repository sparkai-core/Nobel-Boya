import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarOff, Clock, Eraser, Hammer, PartyPopper } from "lucide-react";
import { Badge, PageHero, Panel, StatTiles, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, diffDays, dowShort, monthLong, TODAY, toDate } from "../../../ops/dates";
import type { CalendarDay } from "../../../ops/types";
import { useSchedule } from "./model";

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09"];
type Kind = CalendarDay["kind"];

/**
 * Working calendar: the working week, a twelve-month year grid with holidays, shutdowns and extra
 * working days (click a day to change it) and the working days left before the forecast finish.
 */
export function CalendarPage() {
  const { t, x, d, lang } = useL();
  const calendar = useOps((s) => s.calendar);
  const workweek = useOps((s) => s.workweek);
  const setWorkweek = useOps((s) => s.setWorkweek);
  const setCalendarDay = useOps((s) => s.setCalendarDay);
  const { outlook } = useSchedule();
  const [pop, setPop] = useState<{ date: string; left: number; top: number } | null>(null);
  const byDate = useMemo(() => new Map(calendar.map((c) => [c.date, c])), [calendar]);

  const working = (date: string) => {
    const e = byDate.get(date);
    if (e?.kind === "EXTRA") return true;
    if (e) return false;
    return workweek.includes(toDate(date).getUTCDay());
  };

  const count = (from: string, to: string) => {
    let n = 0;
    let lost = 0;
    for (let day = from; day <= to; day = addDays(day, 1)) {
      if (working(day)) n++;
      else if (byDate.get(day) && workweek.includes(toDate(day).getUTCDay())) lost++;
    }
    return { n, lost };
  };
  const toForecast = count(TODAY, outlook.forecast);
  const toContract = count(TODAY, outlook.contract);
  const upcoming = calendar.filter((c) => c.date >= TODAY && c.kind !== "EXTRA").sort((a, b) => a.date.localeCompare(b.date));
  const extras = calendar.filter((c) => c.kind === "EXTRA").sort((a, b) => a.date.localeCompare(b.date));

  const toggleDay = (dow: number) => {
    const next = workweek.includes(dow) ? workweek.filter((x2) => x2 !== dow) : [...workweek, dow].sort();
    if (!next.length) return;
    setWorkweek(next);
    toast(workweek.includes(dow) ? t("{day} is now a day off", { day: dowName(dow) }) : t("{day} is now a working day", { day: dowName(dow) }));
  };
  function dowName(dow: number) {
    return lang === "az" ? AZ_DAYS[dow]! : EN_DAYS[dow]!;
  }

  const mark = (date: string, kind: Kind | null, name: string) => {
    const fallback = kind === "HOLIDAY" ? t("Holiday") : kind === "SHUTDOWN" ? t("Site shutdown") : t("Extra working day");
    setCalendarDay(date, kind, name.trim() || fallback);
    setPop(null);
    toast(kind ? t("{date} marked: {what}", { date: d(date), what: name.trim() || fallback }) : t("{date} cleared", { date: d(date) }));
  };

  return (
    <div className="k-page pms">
      <PageHero
        eyebrow={t("Project management · Calendar")}
        title={t("Working calendar")}
        subtitle={t("Which days the site works. Holidays and shutdowns here are what the programme counts as lost time.")}
        flow={["Working week", "Holidays", "Shutdowns", "Extra days"]}
        art="calendar"
      />

      <StatTiles
        items={[
          { label: t("Working days to the forecast finish"), value: <span className="num-inline">{toForecast.n}</span>, sub: t("{n} calendar days, finish {date}", { n: diffDays(TODAY, outlook.forecast), date: d(outlook.forecast) }), tone: "brand" },
          { label: t("Working days to the contract date"), value: <span className="num-inline">{toContract.n}</span>, sub: t("{n} fewer than the forecast needs", { n: Math.max(0, toForecast.n - toContract.n) }), tone: toForecast.n > toContract.n ? "bad" : "ok" },
          { label: t("Lost to holidays and shutdowns"), value: <span className="num-inline">{toForecast.lost}</span>, sub: t("working days before the finish") },
          { label: t("Working week"), value: <span className="num-inline">{t("{n} days", { n: workweek.length })}</span>, sub: t("08:00–18:00, one hour lunch") },
        ]}
      />

      <div className="k-grid-main">
        <section className="pms-year-panel">
          <header className="pms-year-head">
            <div>
              <h2>{t("October 2026 to September 2027")}</h2>
              <p className="muted small">{t("Click a day to mark it as a holiday, a shutdown or an extra working day.")}</p>
            </div>
            <div className="pms-week" role="group" aria-label={t("Working week")}>
              {WEEK.map((dow) => (
                <button key={dow} type="button" aria-pressed={workweek.includes(dow)} onClick={() => toggleDay(dow)} className={workweek.includes(dow) ? "on" : undefined} title={dowName(dow)}>
                  {dowShort(dow, lang)}
                </button>
              ))}
            </div>
          </header>
          <div className="pms-year">
            {MONTHS.map((ym) => {
              const first = `${ym}-01`;
              const lead = (toDate(first).getUTCDay() + 6) % 7;
              const dt = toDate(first);
              const days = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
              return (
                <div key={ym} className="pms-month">
                  <h3>
                    {monthLong(dt.getUTCMonth(), lang)} <small>{dt.getUTCFullYear()}</small>
                  </h3>
                  <div className="pms-month-grid">
                    {WEEK.map((w) => (
                      <span key={`h${w}`} className="pms-dow">
                        {dowShort(w, lang).slice(0, lang === "az" ? 3 : 1)}
                      </span>
                    ))}
                    {Array.from({ length: lead }, (_, i) => (
                      <span key={`b${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const date = `${ym}-${String(i + 1).padStart(2, "0")}`;
                      const e = byDate.get(date);
                      const off = !workweek.includes(toDate(date).getUTCDay());
                      const cls = ["pms-day", off && e?.kind !== "EXTRA" ? "off" : "", e ? e.kind.toLowerCase() : "", date === TODAY ? "today" : "", date < TODAY ? "past" : "", date === outlook.forecast ? "finish" : "", date === outlook.contract ? "contract" : ""].filter(Boolean).join(" ");
                      const title = [d(date), e ? x(e.name) : off ? t("Day off") : t("Working day"), date === outlook.forecast ? t("Forecast finish") : "", date === outlook.contract ? t("Contract completion") : ""].filter(Boolean).join(" · ");
                      return (
                        <button
                          key={date}
                          type="button"
                          className={cls}
                          title={title}
                          aria-label={title}
                          onClick={(ev) => {
                            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                            setPop({ date, left: Math.min(window.innerWidth - 276, Math.max(8, r.left - 110)), top: Math.min(window.innerHeight - 260, r.bottom + 6) });
                          }}
                        >
                          {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pms-legend pms-cal-key">
            <span className="ck-off">{t("Day off")}</span>
            <span className="ck-hol">{t("Holiday")}</span>
            <span className="ck-shut">{t("Shutdown")}</span>
            <span className="ck-extra">{t("Extra working day")}</span>
            <span className="ck-today">{t("Today")}</span>
            <span className="ck-finish">{t("Forecast finish")}</span>
          </div>
        </section>

        <div className="k-stack">
          <Panel title={t("Coming days off")} icon={<CalendarOff size={15} />} count={upcoming.length} pad={false}>
            {upcoming.length ? (
              <ul className="pms-offlist">
                {upcoming.slice(0, 10).map((c) => (
                  <li key={c.date}>
                    <span className={`pms-offdate ${c.kind.toLowerCase()}`}>
                      <b>{toDate(c.date).getUTCDate()}</b>
                      <small>{d(c.date, false).split(" ")[1]}</small>
                    </span>
                    <span className="pms-offname">
                      <strong className="truncate">{x(c.name)}</strong>
                      <small>{diffDays(TODAY, c.date) === 0 ? t("today") : t("in {n} days", { n: diffDays(TODAY, c.date) })}</small>
                    </span>
                    <Badge tone={c.kind === "SHUTDOWN" ? "warn" : "bad"} dot={false}>
                      {c.kind === "SHUTDOWN" ? t("Shutdown") : t("Holiday")}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted">{t("No holidays or shutdowns ahead.")}</p>
            )}
          </Panel>
          <Panel title={t("Extra working days")} icon={<Hammer size={15} />} count={extras.length} pad={false}>
            {extras.length ? (
              <ul className="pms-offlist">
                {extras.map((c) => (
                  <li key={c.date}>
                    <span className="pms-offdate extra">
                      <b>{toDate(c.date).getUTCDate()}</b>
                      <small>{d(c.date, false).split(" ")[1]}</small>
                    </span>
                    <span className="pms-offname">
                      <strong className="truncate">{x(c.name)}</strong>
                      <small>{d(c.date)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-panel-body muted">{t("None planned.")}</p>
            )}
          </Panel>
          <div className="k-note">
            <Clock size={13} /> {t("Days off and holidays are skipped when the programme counts working days. Sunday work needs an extra working day here.")}
          </div>
        </div>
      </div>

      {pop ? <DayPopover key={pop.date} pop={pop} entry={byDate.get(pop.date)} onClose={() => setPop(null)} onMark={mark} /> : null}
    </div>
  );
}

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AZ_DAYS = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];

function DayPopover({ pop, entry, onClose, onMark }: { pop: { date: string; left: number; top: number }; entry?: CalendarDay; onClose: () => void; onMark: (date: string, kind: Kind | null, name: string) => void }) {
  const { t, x, d } = useL();
  const [name, setName] = useState(entry ? x(entry.name) : "");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => window.addEventListener("mousedown", close), 0);
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [onClose]);
  return (
    <div className="pms-pop" ref={ref} style={{ left: pop.left, top: pop.top }} role="dialog" aria-label={d(pop.date)}>
      <strong>{d(pop.date)}</strong>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Name (optional)")} aria-label={t("Name")} autoFocus />
      <div className="pms-pop-actions">
        <button type="button" className={entry?.kind === "HOLIDAY" ? "on hol" : "hol"} onClick={() => onMark(pop.date, "HOLIDAY", name)}>
          <PartyPopper size={14} />
          {t("Holiday")}
        </button>
        <button type="button" className={entry?.kind === "SHUTDOWN" ? "on shut" : "shut"} onClick={() => onMark(pop.date, "SHUTDOWN", name)}>
          <CalendarOff size={14} />
          {t("Shutdown")}
        </button>
        <button type="button" className={entry?.kind === "EXTRA" ? "on extra" : "extra"} onClick={() => onMark(pop.date, "EXTRA", name)}>
          <CalendarCheck size={14} />
          {t("Extra working day")}
        </button>
        <button type="button" disabled={!entry} onClick={() => onMark(pop.date, null, "")}>
          <Eraser size={14} />
          {t("Clear")}
        </button>
      </div>
    </div>
  );
}
