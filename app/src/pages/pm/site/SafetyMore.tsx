import { useEffect, useState } from "react";
import { Check, Megaphone, Minus, PenLine, Plus, Users, X as XIcon } from "lucide-react";
import { Badge, Columns, Dialog, Field, Panel, RingGauge, toast, useL } from "../../../components/kit";
import { useOps, ME } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import type { ToolboxTalk, Txt } from "../../../ops/types";
import { freshRef, WEEK, ZONES, zoneTxt } from "./shared";

// ---------------------------------------------------------------- toolbox talks

export function ToolboxTab({ logOpen, setLogOpen }: { logOpen: boolean; setLogOpen: (v: boolean) => void }) {
  const { t, x, d, rel } = useL();
  const talks = useOps((s) => s.toolbox);
  const workers = useOps((s) => s.workers);
  const sorted = [...talks].sort((a, b) => b.date.localeCompare(a.date));
  const max = Math.max(1, ...talks.map((k) => k.attendees));
  const thisWeek = talks.filter((k) => WEEK.includes(k.date));

  return (
    <div className="k-stack">
      <div className="k-grid-main">
        <Panel
          title={t("Toolbox talks")}
          icon={<Megaphone size={15} />}
          count={talks.length}
          actions={
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogOpen(true)}>
              <Plus size={14} />
              {t("Log toolbox talk")}
            </button>
          }
          pad={false}
        >
          <ul className="st-talks">
            {sorted.map((k, i) => (
              <li key={k.id} className={WEEK.includes(k.date) ? "week" : undefined} style={{ animationDelay: `${i * 40}ms` }}>
                <span className="st-talk-date">
                  <b className="num-inline">{Number(k.date.slice(8))}</b>
                  <small>{d(k.date, false).replace(/^\d+ /, "")}</small>
                </span>
                <span className="k-cell-title">
                  <strong>{x(k.topic)}</strong>
                  <small>
                    {x(k.zone)} · {k.by} · {rel(k.date)}
                  </small>
                </span>
                <span className="st-talk-att">
                  <span className="st-talk-bar">
                    <i className="k-grow-x" style={{ width: `${(k.attendees / max) * 100}%` }} />
                  </span>
                  <span className="num-inline small">
                    <Users size={12} /> {k.attendees}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("This week")}>
          <div className="st-bigfig">
            <strong className="num-inline">{thisWeek.length}</strong>
            <span>{t("talks")}</span>
          </div>
          <p className="small muted">{t("{n} attendances against {w} registered workers", { n: thisWeek.reduce((a, k) => a + k.attendees, 0), w: workers.length })}</p>
          <Columns
            height={120}
            items={[...talks]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-6)
              .map((k) => ({ key: k.id, label: d(k.date, false), value: k.attendees, tone: WEEK.includes(k.date) ? "brand" : "muted", title: x(k.topic) }))}
          />
        </Panel>
      </div>
      <LogTalkDialog open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}

const TOPICS: Txt[] = [
  { en: "Crane down: no lifts without a valid inspection", az: "Kran işləmir: etibarlı yoxlama olmadan qaldırma yoxdur" },
  { en: "Helmets and vests at the gate", az: "Darvazada kaska və jilet" },
  { en: "Rain and flooded pits", az: "Yağış və su basmış çuxurlar" },
];

function LogTalkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, x } = useL();
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const [f, setF] = useState({ topic: "", zone: ZONES[0]!.key, attendees: "24", date: TODAY, by: ME });
  useEffect(() => {
    if (open) setF({ topic: "", zone: ZONES[0]!.key, attendees: "24", date: TODAY, by: ME });
  }, [open]);
  const save = () => {
    if (!f.topic.trim()) {
      toast(t("Add the topic of the talk."), "warn");
      return;
    }
    const id = freshRef(() => nextRef("TBT", 1), (r) => useOps.getState().toolbox.some((k) => k.id === r));
    const talk: ToolboxTalk = { id, date: f.date, topic: same(f.topic.trim()), by: f.by.trim() || ME, attendees: Math.max(1, Math.round(Number(f.attendees) || 1)), zone: zoneTxt(f.zone) };
    addItem("toolbox", talk, true);
    pushFeed("PM", { en: `Toolbox talk held: ${talk.topic.en} (${talk.attendees} people)`, az: `Təlimat keçirildi: ${talk.topic.az} (${talk.attendees} nəfər)` }, "pm/safety?tab=toolbox");
    toast(t("Toolbox talk logged: {n} people", { n: talk.attendees }));
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Log toolbox talk")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Log talk")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Topic")} wide>
          <input className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder={t("What was covered")} />
        </Field>
        <div className="k-quick k-field-wide">
          {TOPICS.map((tp, i) => (
            <button key={i} type="button" onClick={() => setF({ ...f, topic: x(tp) })}>
              {x(tp)}
            </button>
          ))}
        </div>
        <Field label={t("Where")}>
          <select className="input select" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>
            {ZONES.map((z) => (
              <option key={z.key} value={z.key}>
                {x(z.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("People who attended")}>
          <input className="input" type="number" min={1} value={f.attendees} onChange={(e) => setF({ ...f, attendees: e.target.value })} />
        </Field>
        <Field label={t("Date")}>
          <input className="input" type="date" value={f.date} max={TODAY} onChange={(e) => setF({ ...f, date: e.target.value || TODAY })} />
        </Field>
        <Field label={t("Given by")}>
          <input className="input" value={f.by} onChange={(e) => setF({ ...f, by: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- weekly site walk

type Answer = "OK" | "ISSUE" | "NA";
const WALK: { group: Txt; items: Txt[] }[] = [
  { group: { en: "Access and housekeeping", az: "Giriş və səliqə" }, items: [{ en: "Walkways clear and lit", az: "Keçidlər açıq və işıqlıdır" }, { en: "Waste skips not overflowing", az: "Tullantı konteynerləri dolub-daşmır" }, { en: "Gate log and inductions up to date", az: "Darvaza jurnalı və təlimatlar aktualdır" }] },
  { group: { en: "Excavations and edges", az: "Qazıntılar və kənarlar" }, items: [{ en: "Open pits fenced", az: "Açıq çuxurlar hasarlanıb" }, { en: "Ladders tied at every pit", az: "Hər çuxurda nərdivan bərkidilib" }, { en: "Starter bars capped", az: "Buraxılış armaturları qapaqlıdır" }] },
  { group: { en: "Plant and lifting", az: "Texnika və qaldırma" }, items: [{ en: "Plant inspections in date", az: "Texnika yoxlamaları qüvvədədir" }, { en: "Lifting zones marked", az: "Qaldırma zonaları işarələnib" }, { en: "Drip trays under fuel and generators", az: "Yanacaq və generatorların altında damcı altlığı var" }] },
  { group: { en: "People", az: "İnsanlar" }, items: [{ en: "PPE worn across the site", az: "Bütün meydançada ƏMSV geyinilir" }, { en: "First-aid kit stocked", az: "İlk yardım dəsti tamdır" }, { en: "Welfare cabins clean", az: "Məişət kabinələri təmizdir" }] },
];
const walkText = (score: number) => ({ en: `Weekly site walk signed off, week to ${TODAY}: score ${score}%`, az: `Həftəlik meydança baxışı imzalandı, ${TODAY} tarixinədək həftə: bal ${score}%` });
const WALK_PREFIX = `Weekly site walk signed off, week to ${TODAY}`;

/** Defaults that reflect the seeded story (crane down, diesel spill, a PPE breach waiting). */
const START: Record<string, Answer> = { "2-0": "ISSUE", "2-2": "ISSUE", "3-0": "ISSUE", "1-0": "OK", "0-0": "OK" };

export function AuditsTab() {
  const { t, x, d, stamp } = useL();
  const feed = useOps((s) => s.feed);
  const pushFeed = useOps((s) => s.pushFeed);
  const [ans, setAns] = useState<Record<string, Answer>>(START);
  const signed = feed.find((f) => f.text.en.startsWith(WALK_PREFIX));
  const all = WALK.flatMap((g, gi) => g.items.map((_, ii) => `${gi}-${ii}`));
  const ok = all.filter((k) => ans[k] === "OK").length;
  const issues = all.filter((k) => ans[k] === "ISSUE").length;
  const answered = all.filter((k) => ans[k]).length;
  const score = ok + issues ? Math.round((ok / (ok + issues)) * 100) : 0;
  const left = all.length - answered;

  const sign = () => {
    if (left) {
      toast(t("Answer the {n} items left before signing off.", { n: left }), "warn");
      return;
    }
    pushFeed("PM", walkText(score), "pm/safety?tab=audits");
    toast(t("Site walk signed off with a score of {s}%", { s: score }), score >= 80 ? "ok" : "warn");
  };

  return (
    <div className="k-grid-main">
      <Panel title={t("Weekly site walk")} sub={t("Week to {date}. Mark each item as it stands on site today.", { date: d(TODAY) })} pad={false}>
        <div className="st-walk">
          {WALK.map((g, gi) => (
            <section key={gi}>
              <h4>{x(g.group)}</h4>
              <ul>
                {g.items.map((it, ii) => {
                  const k = `${gi}-${ii}`;
                  const a = ans[k];
                  const set = (v: Answer) => setAns({ ...ans, [k]: v });
                  return (
                    <li key={k} className={a ? a.toLowerCase() : undefined}>
                      <span>{x(it)}</span>
                      <span className="st-walk-btns" role="radiogroup" aria-label={x(it)}>
                        <button type="button" role="radio" aria-checked={a === "OK"} className={a === "OK" ? "on ok" : undefined} onClick={() => set("OK")} disabled={!!signed} title={t("In order")}>
                          <Check size={13} strokeWidth={3} />
                        </button>
                        <button type="button" role="radio" aria-checked={a === "ISSUE"} className={a === "ISSUE" ? "on bad" : undefined} onClick={() => set("ISSUE")} disabled={!!signed} title={t("Problem found")}>
                          <XIcon size={13} strokeWidth={3} />
                        </button>
                        <button type="button" role="radio" aria-checked={a === "NA"} className={a === "NA" ? "on na" : undefined} onClick={() => set("NA")} disabled={!!signed} title={t("Not applicable")}>
                          <Minus size={13} strokeWidth={3} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Panel>
      <Panel title={t("Walk score")}>
        <div className="st-walk-score">
          <RingGauge value={signed ? Number(/(\d+)%$/.exec(signed.text.en)?.[1] ?? score) : score} size={132} stroke={11} tone={score >= 80 ? "ok" : score >= 60 ? "warn" : "bad"} label={t("score")} />
          <div className="st-walk-figs">
            <span>
              <b className="num-inline k-text-ok">{ok}</b> {t("in order")}
            </span>
            <span>
              <b className="num-inline k-text-bad">{issues}</b> {t("issues")}
            </span>
            <span>
              <b className="num-inline">{left}</b> {t("to answer")}
            </span>
          </div>
        </div>
        {signed ? (
          <div className="k-callout k-tone-ok st-callout">
            <PenLine size={15} />
            <div>
              <strong>{t("Signed off")}</strong>
              <p>
                {signed.actor} · {stamp(signed.at)}
              </p>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-primary st-sign" onClick={sign}>
            <PenLine size={15} />
            {t("Sign off the walk")}
          </button>
        )}
        <p className="small muted">
          {t("Next walk")}: <Badge tone="neutral" dot={false}>{d(addDays(TODAY, 7))}</Badge>
        </p>
      </Panel>
    </div>
  );
}
