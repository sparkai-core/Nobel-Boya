import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CalendarClock, Clock, Sparkles, Undo2, UserX, Users, Zap } from "lucide-react";
import { Badge, Empty, PageHero, Panel, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import type { Txt } from "../../../ops/types";

type Day = "today" | "tomorrow";
type Kind = "concrete" | "rebar" | "steel" | "earth" | "elec" | "crane" | "excavator" | "pump";
type Res = { id: string; name: Txt; kind: Kind; size: number; sub: string; shift: [number, number]; plant?: boolean };
type Booking = { id: string; res: string | null; kind: Kind; code: string; task: Txt; start: number; end: number; people: number; from?: { res: string | null; start: number; end: number } };
type Fix = { key: string; type: "collision" | "unassigned" | "idle"; problem: string; change: string; saves: number; bookingId: string; to: { res: string; start: number; end: number } };

const T = (en: string, az: string): Txt => ({ en, az });
const H0 = 7;
const H1 = 19;
const SPAN = H1 - H0;

const RESOURCES: Res[] = [
  { id: "R1", name: T("Concrete crew A", "Beton briqadası A"), kind: "concrete", size: 8, sub: "SC-02", shift: [7, 17] },
  { id: "R2", name: T("Concrete crew B", "Beton briqadası B"), kind: "concrete", size: 8, sub: "SC-02", shift: [9, 19] },
  { id: "R3", name: T("Steel fixers", "Armaturçular"), kind: "rebar", size: 10, sub: "SC-02", shift: [7, 17] },
  { id: "R4", name: T("Steel erectors", "Metal quraşdırıcılar"), kind: "steel", size: 6, sub: "SC-03", shift: [7, 17] },
  { id: "R5", name: T("Earthworks crew", "Torpaq işləri briqadası"), kind: "earth", size: 6, sub: "SC-01", shift: [7, 17] },
  { id: "R6", name: T("Electricians", "Elektriklər"), kind: "elec", size: 3, sub: "SC-06", shift: [7, 15] },
  { id: "P1", name: T("Mobile crane 50 t", "Avtokran 50 t"), kind: "crane", size: 1, sub: "SC-03", shift: [7, 19], plant: true },
  { id: "P2", name: T("Excavator 21 t", "Ekskavator 21 t"), kind: "excavator", size: 1, sub: "SC-01", shift: [7, 17], plant: true },
  { id: "P3", name: T("Concrete pump 36 m", "Beton nasosu 36 m"), kind: "pump", size: 1, sub: "SC-02", shift: [7, 17], plant: true },
];

const SEED: Record<Day, Booking[]> = {
  today: [
    { id: "b1", res: "R1", kind: "concrete", code: "WH-120", task: T("Pour footings Ms-3", "Ms-3 bünövrələrinin betonlanması"), start: 7, end: 13, people: 8 },
    { id: "b2", res: "R1", kind: "concrete", code: "AD-120", task: T("Strip foundation pour, bay 2", "Lent bünövrə betonlaması, 2-ci hissə"), start: 13, end: 19, people: 8 },
    { id: "b3", res: "R2", kind: "concrete", code: "WH-130", task: T("Formwork to ground beams", "Rand tirlərinin qəlibi"), start: 9, end: 11, people: 8 },
    { id: "b4", res: "P3", kind: "pump", code: "WH-120", task: T("Pump for the Ms-3 pour", "Ms-3 betonlaması üçün nasos"), start: 8, end: 12, people: 1 },
    { id: "b5", res: "P3", kind: "pump", code: "AD-120", task: T("Pump for the strip foundation", "Lent bünövrə üçün nasos"), start: 10, end: 14, people: 1 },
    { id: "b6", res: "R3", kind: "rebar", code: "WH-125", task: T("Column starter bars", "Dirək buraxılışları"), start: 7, end: 15, people: 10 },
    { id: "b7", res: null, kind: "concrete", code: "AD-130", task: T("Kicker formwork, grid A", "Dirək altlığı qəlibi, A oxu"), start: 13, end: 17, people: 6 },
    { id: "b8", res: "R5", kind: "earth", code: "AD-120", task: T("Backfill to strip foundations", "Lent bünövrələrin geri doldurulması"), start: 9, end: 15, people: 6 },
    { id: "b9", res: "R6", kind: "elec", code: "WH-120", task: T("Temporary lighting to the pits", "Çuxurlara müvəqqəti işıqlandırma"), start: 7, end: 10, people: 3 },
    { id: "b10", res: "P2", kind: "excavator", code: "PS-110", task: T("Trial pits at the pump station", "Nasosxanada sınaq çuxurları"), start: 13, end: 16, people: 1 },
  ],
  tomorrow: [
    { id: "c1", res: "R1", kind: "concrete", code: "WH-120", task: T("Pour footings Ms-4", "Ms-4 bünövrələrinin betonlanması"), start: 7, end: 12, people: 8 },
    { id: "c2", res: "R2", kind: "concrete", code: "WH-130", task: T("Ground beam MR-2 pour", "MR-2 rand tirinin betonlanması"), start: 9, end: 14, people: 8 },
    { id: "c3", res: "P3", kind: "pump", code: "WH-120", task: T("Pump for the Ms-4 pour", "Ms-4 betonlaması üçün nasos"), start: 8, end: 11, people: 1 },
    { id: "c4", res: "P3", kind: "pump", code: "WH-130", task: T("Pump for MR-2", "MR-2 üçün nasos"), start: 10, end: 13, people: 1 },
    { id: "c5", res: "R3", kind: "rebar", code: "AD-125", task: T("Rebar to strip foundations", "Lent bünövrələrin armaturu"), start: 7, end: 15, people: 10 },
    { id: "c6", res: null, kind: "concrete", code: "AD-130", task: T("Column kickers, grid B", "Dirək altlıqları, B oxu"), start: 14, end: 17, people: 6 },
    { id: "c7", res: "R5", kind: "earth", code: "AD-120", task: T("Backfill and compaction", "Geri doldurma və sıxlaşdırma"), start: 7, end: 13, people: 6 },
    { id: "c8", res: "R4", kind: "steel", code: "WH-160", task: T("Set out truss anchor bolts", "Ferma anker boltlarının yerləşdirilməsi"), start: 8, end: 11, people: 4 },
    { id: "c9", res: "R6", kind: "elec", code: "WH-125", task: T("Site lighting upgrade", "Meydança işıqlandırmasının gücləndirilməsi"), start: 12, end: 15, people: 3 },
  ],
};

const hh = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
const L = (h: number) => `${((h - H0) / SPAN) * 100}%`;
const Wd = (a: number, b: number) => `${((b - a) / SPAN) * 100}%`;

export function AiSchedulingPage() {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const impacts = useOps((s) => s.impacts);
  const subs = useOps((s) => s.subs);
  const [day, setDay] = useState<Day>("today");
  const [all, setAll] = useState<Record<Day, Booking[]>>(() => ({
    today: SEED.today.filter((b) => activities.some((a) => a.code === b.code)),
    tomorrow: SEED.tomorrow.filter((b) => activities.some((a) => a.code === b.code)),
  }));
  const [applied, setApplied] = useState<Record<Day, { key: string; text: string; prev: Booking }[]>>({ today: [], tomorrow: [] });
  const [hover, setHover] = useState<Fix | null>(null);
  const [picked, setPicked] = useState<string | null>("b5");

  const bookings = all[day];
  const craneOut = impacts.some((i) => i.kind === "EQUIPMENT_FAILURE" && i.status !== "RESOLVED" && i.status !== "REJECTED");
  const out = (r: Res) => r.id === "P1" && craneOut;
  const resName = (id: string | null) => (id ? x(RESOURCES.find((r) => r.id === id)!.name) : t("Not assigned"));
  const actOf = (code: string) => activities.find((a) => a.code === code);
  const nowH = useMemo(() => {
    const n = new Date();
    const h = n.getHours() + n.getMinutes() / 60;
    return h >= H0 && h <= H1 ? h : 10.5;
  }, []);

  // ---------------------------------------------------------------- analysis
  const onRes = (id: string, list = bookings) => list.filter((b) => b.res === id).sort((a, b) => a.start - b.start);
  const freeFor = (r: Res, win: { start: number; end: number }, ignore: string, list = bookings) => !out(r) && win.start >= r.shift[0] && win.end <= r.shift[1] && onRes(r.id, list).every((b) => b.id === ignore || overlap(b, win) === 0);
  const gaps = (r: Res) => {
    const out2: { start: number; end: number }[] = [];
    let cur = r.shift[0];
    for (const b of onRes(r.id)) {
      if (b.start > cur) out2.push({ start: cur, end: b.start });
      cur = Math.max(cur, b.end);
    }
    if (cur < r.shift[1]) out2.push({ start: cur, end: r.shift[1] });
    return out2.filter((g) => g.end - g.start >= 2);
  };
  const earliest = (r: Res, dur: number, notBefore: number, ignore: string) => {
    for (let s = Math.max(r.shift[0], notBefore); s + dur <= r.shift[1]; s += 0.5) if (freeFor(r, { start: s, end: s + dur }, ignore)) return s;
    return null;
  };

  const collisions = useMemo(() => {
    const out2: { res: string; a: Booking; b: Booking; start: number; end: number }[] = [];
    for (const r of RESOURCES) {
      const list = onRes(r.id);
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const o = overlap(list[i]!, list[j]!);
          if (o > 0) out2.push({ res: r.id, a: list[i]!, b: list[j]!, start: Math.max(list[i]!.start, list[j]!.start), end: Math.min(list[i]!.end, list[j]!.end) });
        }
    }
    return out2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  const fixes = useMemo<Fix[]>(() => {
    const out2: Fix[] = [];
    for (const c of collisions) {
      const r = RESOURCES.find((v) => v.id === c.res)!;
      const dur = c.b.end - c.b.start;
      const s = earliest(r, dur, c.a.end, c.b.id);
      const other = RESOURCES.find((v) => v.id !== r.id && v.kind === r.kind && freeFor(v, c.b, c.b.id));
      const to = s != null ? { res: r.id, start: s, end: s + dur } : other ? { res: other.id, start: c.b.start, end: c.b.end } : null;
      if (!to) continue;
      out2.push({
        key: `col-${c.b.id}`,
        type: "collision",
        problem: t("{res} is booked twice {a}–{b}: {x} and {y}.", { res: x(r.name), a: hh(c.start), b: hh(c.end), x: c.a.code, y: c.b.code }),
        change: to.res === r.id ? t("Move {code} to {a}–{b}, straight after {other}.", { code: c.b.code, a: hh(to.start), b: hh(to.end), other: c.a.code }) : t("Give {code} to {res} at the same time.", { code: c.b.code, res: resName(to.res) }),
        saves: c.end - c.start,
        bookingId: c.b.id,
        to,
      });
    }
    for (const u of bookings.filter((b) => b.res == null)) {
      const dur = u.end - u.start;
      const cands = RESOURCES.filter((r) => r.kind === u.kind && !out(r));
      const same = cands.find((r) => freeFor(r, u, u.id));
      let to: Fix["to"] | null = same ? { res: same.id, start: u.start, end: u.end } : null;
      if (!to)
        for (const r of cands) {
          const s = earliest(r, dur, H0, u.id);
          if (s != null) {
            to = { res: r.id, start: s, end: s + dur };
            break;
          }
        }
      if (!to) continue;
      out2.push({
        key: `una-${u.id}`,
        type: "unassigned",
        problem: t("Nobody is booked for {code}: {task}.", { code: u.code, task: x(u.task) }),
        change: to.start === u.start ? t("Assign {res}, which is free {a}–{b}.", { res: resName(to.res), a: hh(to.start), b: hh(to.end) }) : t("Assign {res} and move it to {a}–{b}.", { res: resName(to.res), a: hh(to.start), b: hh(to.end) }),
        saves: dur,
        bookingId: u.id,
        to,
      });
    }
    for (const r of RESOURCES) {
      const late = onRes(r.id).filter((b) => b.end > r.shift[1] || b.start < r.shift[0]);
      for (const b of late) {
        const over = Math.max(0, b.end - r.shift[1]) + Math.max(0, r.shift[0] - b.start);
        const idle = RESOURCES.find((q) => q.id !== r.id && q.kind === r.kind && freeFor(q, b, b.id));
        if (!idle) continue;
        out2.push({
          key: `idle-${b.id}`,
          type: "idle",
          problem: t("{idle} stands idle while {busy} works {n} h past its shift on {code}.", { idle: x(idle.name), busy: x(r.name), n: over, code: b.code }),
          change: t("Hand {code} ({a}–{b}) to {idle}.", { code: b.code, a: hh(b.start), b: hh(b.end), idle: x(idle.name) }),
          saves: over,
          bookingId: b.id,
          to: { res: idle.id, start: b.start, end: b.end },
        });
      }
    }
    return out2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, collisions, craneOut, t, x]);

  const apply = (f: Fix) => {
    const prev = bookings.find((b) => b.id === f.bookingId);
    if (!prev) return;
    setAll((s) => ({ ...s, [day]: s[day].map((b) => (b.id === f.bookingId ? { ...b, res: f.to.res, start: f.to.start, end: f.to.end, from: { res: b.res, start: b.start, end: b.end } } : b)) }));
    setApplied((s) => ({ ...s, [day]: [{ key: f.key, text: f.change, prev }, ...s[day]] }));
    setHover(null);
    setPicked(f.bookingId);
    toast(t("Applied. Saves {n} crew-hours.", { n: f.saves }));
  };
  const undo = (key: string) => {
    const a = applied[day].find((v) => v.key === key);
    if (!a) return;
    setAll((s) => ({ ...s, [day]: s[day].map((b) => (b.id === a.prev.id ? a.prev : b)) }));
    setApplied((s) => ({ ...s, [day]: s[day].filter((v) => v.key !== key) }));
    toast(t("Change undone"), "muted");
  };

  // ---------------------------------------------------------------- people per hour
  const hours = Array.from({ length: SPAN }, (_, i) => H0 + i);
  const perHour = hours.map((h) => {
    const at = { start: h, end: h + 1 };
    let covered = 0;
    let short = 0;
    for (const r of RESOURCES) {
      const list = onRes(r.id).filter((b) => overlap(b, at) > 0);
      list.forEach((b, i) => {
        const ok = i === 0 && !out(r) && h >= r.shift[0] && h < r.shift[1];
        if (ok) covered += b.people;
        else short += b.people;
      });
    }
    for (const b of bookings.filter((v) => v.res == null && overlap(v, at) > 0)) short += b.people;
    const available = RESOURCES.filter((r) => !out(r) && h >= r.shift[0] && h < r.shift[1]).reduce((a, r) => a + r.size, 0);
    return { h, covered, short, available };
  });
  const peak = Math.max(1, ...perHour.map((p) => Math.max(p.covered + p.short, p.available))) * 1.1;
  const totalShort = perHour.reduce((a, p) => a + p.short, 0);
  const idleHours = RESOURCES.filter((r) => !r.plant && !out(r)).reduce((a, r) => a + gaps(r).reduce((s, g) => s + g.end - g.start, 0), 0);

  // ---------------------------------------------------------------- timeline rows
  const rows: { id: string | null; label: string; sub: string; res?: Res }[] = [
    { id: null, label: t("Not assigned"), sub: t("{n} bookings", { n: bookings.filter((b) => b.res == null).length }) },
    ...RESOURCES.map((r) => ({ id: r.id, label: x(r.name), sub: `${subs.find((s) => s.id === r.sub)?.name ?? r.sub}${r.plant ? "" : ` · ${r.size} ${t("people")}`}`, res: r })),
  ];
  const rowIdx = (id: string | null) => rows.findIndex((r) => r.id === id);
  const RH = 46;

  const sel = bookings.find((b) => b.id === picked);
  const selClashes = sel?.res ? onRes(sel.res).filter((b) => b.id !== sel.id && overlap(b, sel) > 0) : [];
  const FIX_ICON = { collision: Zap, unassigned: UserX, idle: Clock } as const;
  const FIX_LABEL = { collision: t("Collision"), unassigned: t("Nobody assigned"), idle: t("Idle crew") } as const;

  return (
    <div className="k-page pmc">
      <PageHero
        eyebrow={t("Project management · AI scheduling")}
        title={t("AI scheduling")}
        subtitle={t("Crews and plant booked hour by hour against today's work. The assistant finds clashes, gaps and idle crews and proposes the fix.")}
        flow={["Book crews and plant", "AI finds clashes", "Apply the fix", "Crew-hours saved"]}
        art="ai"
        actions={
          <Segmented
            label={t("Day")}
            value={day}
            onChange={(v) => {
              setDay(v);
              setHover(null);
              setPicked(null);
            }}
            options={[
              { value: "today", label: `${t("Today")} · ${d(TODAY, false)}` },
              { value: "tomorrow", label: `${t("Tomorrow")} · ${d(addDays(TODAY, 1), false)}` },
            ]}
          />
        }
      />

      <div className="k-grid-main">
        <Panel
          title={t("People needed per hour")}
          icon={<BarChart3 size={15} />}
          sub={t("Columns show the people the bookings need; red is the part no crew covers. The line is the crews on shift.")}
          actions={<Badge tone={totalShort ? "bad" : "ok"}>{totalShort ? t("{n} people-hours short", { n: totalShort }) : t("Fully covered")}</Badge>}
        >
          <div className="pmc-ph">
            {perHour.map((p, i) => (
              <div key={p.h} className="pmc-ph-col" title={`${hh(p.h)}–${hh(p.h + 1)} · ${t("needed")} ${p.covered + p.short} · ${t("available")} ${p.available}`}>
                <span className="pmc-ph-val num-inline">{p.covered + p.short}</span>
                <span className="pmc-ph-stack k-grow-y" style={{ height: `${((p.covered + p.short) / peak) * 100}%`, animationDelay: `${i * 30}ms` }}>
                  {p.short ? <i className="short" style={{ flexGrow: p.short }} /> : null}
                  <i className="ok" style={{ flexGrow: p.covered }} />
                </span>
                <b className="pmc-ph-avail" style={{ bottom: `${(p.available / peak) * 100}%` }} />
                <span className="pmc-ph-label">{String(p.h).padStart(2, "0")}</span>
              </div>
            ))}
          </div>
          <div className="k-legend">
            <span style={{ ["--lc" as string]: "var(--stamp)" }}>{t("Covered by a crew")}</span>
            <span style={{ ["--lc" as string]: "var(--redline)" }}>{t("Shortfall")}</span>
            <span style={{ ["--lc" as string]: "var(--graphite)" }}>{t("Crews on shift")}</span>
          </div>
        </Panel>

        <div className="k-stack">
          <div className="pmc-ai-stats">
            <span>
              <small>{t("Clashes")}</small>
              <b className={`num-inline ${collisions.length ? "k-text-bad" : "k-text-ok"}`}>{collisions.length}</b>
            </span>
            <span>
              <small>{t("Not assigned")}</small>
              <b className={`num-inline ${bookings.some((b) => b.res == null) ? "k-text-warn" : "k-text-ok"}`}>{bookings.filter((b) => b.res == null).length}</b>
            </span>
            <span>
              <small>{t("Idle crew-hours")}</small>
              <b className="num-inline">{idleHours}</b>
            </span>
          </div>
          <Panel title={t("Booking")} icon={<CalendarClock size={15} />}>
            {sel ? (
              <dl className="pmc-booking">
                <div>
                  <dt>{t("Who")}</dt>
                  <dd>
                    <strong>{resName(sel.res)}</strong>
                    {sel.res ? <small>{subs.find((s) => s.id === RESOURCES.find((r) => r.id === sel.res)?.sub)?.name}</small> : null}
                  </dd>
                </div>
                <div>
                  <dt>{t("When")}</dt>
                  <dd className="num-inline">
                    {d(day === "today" ? TODAY : addDays(TODAY, 1), false)} · {hh(sel.start)}–{hh(sel.end)}
                  </dd>
                </div>
                <div>
                  <dt>{t("Work")}</dt>
                  <dd>
                    <Link to={R.programme(actOf(sel.code)?.id)} className="pmc-code">{sel.code}</Link> {x(sel.task)}
                    <small>{t("{n} people", { n: sel.people })}</small>
                  </dd>
                </div>
                <div>
                  <dt>{t("Clashes with")}</dt>
                  <dd>
                    {selClashes.length ? (
                      selClashes.map((c) => (
                        <button key={c.id} type="button" className="pmc-chip bad" onClick={() => setPicked(c.id)}>
                          {c.code} · {hh(c.start)}–{hh(c.end)}
                        </button>
                      ))
                    ) : (
                      <span className="muted">{t("Nothing")}</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="muted small">{t("Click a bar on the timeline to see who, when and what it clashes with.")}</p>
            )}
          </Panel>
        </div>
      </div>

      <Panel title={t("Resource timeline")} icon={<Users size={15} />} sub={t("One row per crew or machine, 07:00 to 19:00. Hover an AI fix to preview it here.")} pad={false}>
        <div className="pmc-tl-wrap">
          <div className="pmc-tl" style={{ ["--rh" as string]: `${RH}px` }}>
            <div className="pmc-tl-head">
              <span />
              <div className="pmc-tl-scale">
                {hours.concat(H1).map((h) => (
                  <span key={h} style={{ left: L(h) }}>{String(h).padStart(2, "0")}:00</span>
                ))}
              </div>
            </div>
            <div className="pmc-tl-body" style={{ height: rows.length * RH }}>
              {rows.map((r, i) => (
                <div key={r.id ?? "none"} className={`pmc-tl-row${r.id == null ? " none" : ""}${r.res && out(r.res) ? " out" : ""}`} style={{ top: i * RH }}>
                  <div className="pmc-tl-label">
                    <strong className="truncate">{r.label}</strong>
                    <small className="truncate">{r.res && out(r.res) ? t("Out of service") : r.sub}</small>
                  </div>
                  <div className="pmc-tl-lane">
                    {r.res ? (
                      <>
                        <i className="pmc-tl-offshift" style={{ left: 0, width: Wd(H0, r.res.shift[0]) }} />
                        <i className="pmc-tl-offshift" style={{ left: L(r.res.shift[1]), width: Wd(r.res.shift[1], H1) }} />
                        {out(r.res) ? <span className="pmc-tl-out">{t("Out of service")}</span> : null}
                        {!out(r.res) && !r.res.plant
                          ? gaps(r.res).map((g) => (
                              <span key={g.start} className="pmc-tl-free" style={{ left: L(g.start), width: Wd(g.start, g.end) }}>
                                {t("Free {n} h", { n: g.end - g.start })}
                              </span>
                            ))
                          : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="pmc-tl-layer">
                {hours.concat(H1).map((h) => (
                  <i key={h} className="pmc-tl-grid" style={{ left: L(h) }} />
                ))}
                {collisions.map((c) => (
                  <span key={`${c.a.id}-${c.b.id}`} className="pmc-tl-clash" style={{ left: L(c.start), width: Wd(c.start, c.end), top: rowIdx(c.res) * RH + 3 }}>
                    <em>{t("Collision")}</em>
                  </span>
                ))}
                {bookings
                  .filter((b) => b.from)
                  .map((b) => (
                    <span key={`g-${b.id}`} className="pmc-tl-ghost" style={{ left: L(b.from!.start), width: Wd(b.from!.start, b.from!.end), top: rowIdx(b.from!.res) * RH + 8 }}>
                      {t("Was here")}
                    </span>
                  ))}
                {bookings.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`pmc-tl-bar k-${b.kind}${b.res == null ? " una" : ""}${picked === b.id ? " sel" : ""}${hover?.bookingId === b.id ? " src" : ""}${b.from ? " moved" : ""}`}
                    style={{ left: L(b.start), width: Wd(b.start, b.end), top: rowIdx(b.res) * RH + 8 }}
                    onClick={() => setPicked(b.id)}
                    title={`${b.code} · ${x(b.task)} · ${hh(b.start)}–${hh(b.end)}`}
                  >
                    <b>{b.code}</b>
                    <span className="truncate">{x(b.task)}</span>
                  </button>
                ))}
                {hover ? (
                  <span className="pmc-tl-preview" style={{ left: L(hover.to.start), width: Wd(hover.to.start, hover.to.end), top: rowIdx(hover.to.res) * RH + 8 }}>
                    {t("Proposed")}
                  </span>
                ) : null}
                {day === "today" ? (
                  <b className="pmc-tl-now" style={{ left: L(nowH) }}>
                    <span>{t("Now")}</span>
                  </b>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t("AI fixes")} icon={<Sparkles size={15} />} count={fixes.length} sub={t("Each card names the problem and the change. Hover to preview it on the timeline.")}>
        {fixes.length ? (
          <div className="pmc-fixes">
            {fixes.map((f, i) => {
              const Icon = FIX_ICON[f.type];
              return (
                <article key={f.key} className={`pmc-fix k-rise t-${f.type}${hover?.key === f.key ? " on" : ""}`} style={{ animationDelay: `${i * 60}ms` }} onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(f)} onBlur={() => setHover(null)}>
                  <span className="pmc-fix-kind">
                    <Icon size={13} /> {FIX_LABEL[f.type]}
                  </span>
                  <p className="pmc-fix-problem">{f.problem}</p>
                  <p className="pmc-fix-change">
                    <ArrowRight size={13} /> {f.change}
                  </p>
                  <div className="pmc-fix-foot">
                    <Badge tone="ok">{t("Saves {n} crew-hours", { n: f.saves })}</Badge>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => apply(f)}>
                      {t("Apply")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty icon={<Sparkles size={18} />} title={t("Nothing to fix")}>{t("Every booking has a crew and nothing clashes.")}</Empty>
        )}
        {applied[day].length ? (
          <ul className="pmc-applied">
            {applied[day].map((a) => (
              <li key={a.key}>
                <span className="k-text-ok">✓</span>
                <span>{a.text}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => undo(a.key)}>
                  <Undo2 size={13} />
                  {t("Undo")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}
