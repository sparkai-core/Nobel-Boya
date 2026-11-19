import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ArrowRight, CalendarPlus, Check, Pause, Play, Plus, Ticket, X as XIcon, Lock } from "lucide-react";
import { Dialog, Empty, Field, toast, useL } from "../../../components/kit";
import { useOps, me } from "../../../ops/store";
import { addDays, diffDays, same, TODAY } from "../../../ops/dates";
import type { Equipment, Permit, PermitKind, Txt } from "../../../ops/types";
import { freshRef, PERMIT_KIND, siteLink, siteMeta, ZoneInput, zoneTxt } from "./shared";

const COLS: Permit["status"][] = ["DRAFT", "ACTIVE", "SUSPENDED", "CLOSED", "EXPIRED"];

/** An active permit past its end date reads as expired. */
export const permitStatus = (p: Permit): Permit["status"] => (p.status === "ACTIVE" && p.to < TODAY ? "EXPIRED" : p.status);

/** Crane out of service in the permit's zone (blocks lifting permits). */
export const blockingCrane = (p: Permit, equipment: Equipment[]) => (p.kind === "LIFTING" && p.zone.en ? equipment.find((e) => e.category === "CRANE" && e.zone.en === p.zone.en && (e.status === "BROKEN_DOWN" || e.status === "MAINTENANCE")) : undefined);

const T = (en: string, az: string): Txt => ({ en, az });
const CHECKS: Record<PermitKind, Txt[]> = {
  HOT_WORK: [T("Fire watch assigned", "Yanğın nəzarətçisi təyin edilib"), T("Extinguisher within 5 m", "5 m-də yanğınsöndürən"), T("Combustibles cleared", "Yanan materiallar götürülüb")],
  WORK_AT_HEIGHT: [T("Harnesses inspected", "Qoruyucu kəmərlər yoxlanılıb"), T("Edge protection in place", "Kənar mühafizəsi qurulub"), T("Rescue plan briefed", "Xilasetmə planı izah edilib")],
  EXCAVATION: [T("Services scanned", "Kommunikasiyalar yoxlanılıb"), T("Edge protection", "Kənar mühafizəsi"), T("Daily inspection", "Gündəlik yoxlama")],
  LIFTING: [T("Crane inspection valid", "Kran yoxlaması qüvvədədir"), T("Lift plan approved", "Qaldırma planı təsdiqlənib"), T("Banksman assigned", "Siqnalçı təyin edilib")],
  CONFINED_SPACE: [T("Gas test passed", "Qaz testi keçib"), T("Standby person posted", "Növbətçi təyin edilib"), T("Ventilation running", "Ventilyasiya işləyir")],
  ELECTRICAL: [T("Isolation locked out", "Ayırma bloklanıb"), T("Circuit proved dead", "Dövrədə gərginlik yoxdur"), T("Competent electrician named", "Səlahiyyətli elektrik təyin edilib")],
};

export function PermitsTab({ newOpen, setNewOpen }: { newOpen: boolean; setNewOpen: (v: boolean) => void }) {
  const { t, x } = useL();
  const permits = useOps((s) => s.permits);
  if (!permits.length)
    return (
      <>
        <Empty
          icon={<Ticket size={22} />}
          title={t("No permits to work yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
              <Plus size={15} />
              {t("New permit")}
            </button>
          }
        >
          {t("Draft a permit for hot work, work at height, excavation, lifting, confined spaces or electrical work. It goes active once every check is ticked.")}
        </Empty>
        <NewPermitDialog open={newOpen} onClose={() => setNewOpen(false)} />
      </>
    );
  return (
    <div className="k-stack">
      <div className="k-row">
        <span className="small muted">{t("Permits move from draft to active once every check is ticked. Click a check to tick it.")}</span>
        <span className="k-spacer" />
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
          <Plus size={14} />
          {t("New permit")}
        </button>
      </div>
      <div className="st-board">
        {COLS.map((col) => {
          const list = permits.filter((p) => permitStatus(p) === col);
          const meta = siteMeta("permit", col);
          return (
            <section key={col} className={`st-board-col k-tone-${meta.tone}`}>
              <header>
                <span className="st-board-dot" />
                <strong>{x(meta.label)}</strong>
                <b className="num-inline">{list.length}</b>
              </header>
              {list.map((p) => (
                <PermitCard key={p.id} p={p} />
              ))}
              {!list.length ? <p className="st-board-empty">{t("None")}</p> : null}
            </section>
          );
        })}
      </div>
      <NewPermitDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function PermitCard({ p }: { p: Permit }) {
  const { t, x, d } = useL();
  const equipment = useOps((s) => s.equipment);
  const activities = useOps((s) => s.activities);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const st = permitStatus(p);
  const kind = PERMIT_KIND[p.kind];
  const Icon = kind.icon;
  const crane = blockingCrane(p, equipment);
  const act = activities.find((a) => a.id === p.activityId);
  const span = Math.max(1, diffDays(p.from, p.to));
  const elapsed = Math.max(0, Math.min(1, diffDays(p.from, TODAY) / span));
  const left = diffDays(TODAY, p.to);
  const allOk = p.checks.every((c) => c.ok);
  const link = "pm/safety?tab=permits";

  const feed = (en: string, az: string) => pushFeed("PM", { en: `${p.ref} ${en}`, az: `${p.ref} ${az}` }, link);
  const activate = () => {
    if (crane) {
      toast(t("{code} is out of service. Repair it before lifting.", { code: crane.code }), "bad");
      return;
    }
    if (!allOk) {
      toast(t("Tick every check before activating."), "warn");
      return;
    }
    patchItem("permits", p.id, { status: "ACTIVE", to: p.to < TODAY ? addDays(TODAY, 7) : p.to });
    feed("activated", "qüvvəyə mindi");
    toast(t("{ref} is active", { ref: p.ref }));
  };
  const suspend = () => {
    patchItem("permits", p.id, { status: "SUSPENDED" });
    feed("suspended", "dayandırıldı");
    toast(t("{ref} suspended", { ref: p.ref }), "warn");
  };
  const close = () => {
    patchItem("permits", p.id, { status: "CLOSED" });
    feed("closed", "bağlandı");
    toast(t("{ref} closed", { ref: p.ref }));
  };
  const extend = () => {
    const to = addDays(p.to < TODAY ? TODAY : p.to, 7);
    patchItem("permits", p.id, { to });
    feed(`extended to ${to}`, `${to} tarixinədək uzadıldı`);
    toast(t("{ref} extended to {date}", { ref: p.ref, date: d(to) }));
  };
  const tick = (k: number) => {
    if (st === "CLOSED") return;
    const checks = p.checks.map((c, j) => (j === k ? { ...c, ok: !c.ok } : c));
    patchItem("permits", p.id, { checks, status: p.status === "ACTIVE" && !checks[k]!.ok ? "SUSPENDED" : p.status });
    if (p.status === "ACTIVE" && !checks[k]!.ok) {
      feed("suspended: a check failed", "dayandırıldı: yoxlama keçmədi");
      toast(t("{ref} suspended: a check is no longer met", { ref: p.ref }), "warn");
    }
  };

  return (
    <article className={`st-permit${st === "SUSPENDED" ? " bad" : ""}`}>
      <header>
        <span className="st-permit-icon">
          <Icon size={14} />
        </span>
        <span className="k-ref">{p.ref}</span>
        <span className="small muted">{x(kind.label)}</span>
      </header>
      <strong className="st-permit-title">{x(p.title)}</strong>
      <span className="small muted">
        {[x(p.zone), act?.code, p.issuedTo].filter(Boolean).join(" · ") || "—"}
      </span>
      <div className="st-validity" title={`${d(p.from)} – ${d(p.to)}`}>
        <span className="st-validity-track">
          <i className={`k-grow-x ${st === "EXPIRED" ? "warn" : st === "SUSPENDED" ? "bad" : st === "CLOSED" ? "muted" : ""}`} style={{ width: `${elapsed * 100}%` }} />
          {TODAY >= p.from && TODAY <= p.to ? <b style={{ left: `${elapsed * 100}%` }} /> : null}
        </span>
        <small>
          {d(p.from, false)} – {d(p.to, false)} · {st === "CLOSED" ? t("closed out") : left < 0 ? t("ended {n} d ago", { n: -left }) : left === 0 ? t("ends today") : t("{n} d left", { n: left })}
        </small>
      </div>
      <ul className="st-permit-checks">
        {p.checks.map((c, k) => (
          <li key={k}>
            <button type="button" className={`st-check${c.ok ? " on" : " no"}`} onClick={() => tick(k)} aria-pressed={c.ok} disabled={st === "CLOSED"} aria-label={x(c.item)}>
              {c.ok ? <Check size={11} strokeWidth={3} /> : <XIcon size={11} strokeWidth={3} />}
            </button>
            <span className={c.ok ? undefined : "k-text-bad"}>{x(c.item)}</span>
          </li>
        ))}
      </ul>
      {crane ? (
        <Link to={siteLink.equipment(crane.id)} className="st-permit-link">
          <AlertOctagon size={13} />
          <span>{t("{code} failed inspection: {state}", { code: crane.code, state: x(siteMeta("equipment", crane.status).label).toLowerCase() })}</span>
          <ArrowRight size={12} />
        </Link>
      ) : null}
      {st !== "CLOSED" ? (
        <footer>
          {st === "DRAFT" || st === "SUSPENDED" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={activate} disabled={!!crane}>
              {crane ? <Lock size={12} /> : <Play size={12} />}
              {t("Activate")}
            </button>
          ) : null}
          {st === "ACTIVE" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={suspend}>
              <Pause size={12} />
              {t("Suspend")}
            </button>
          ) : null}
          {st !== "DRAFT" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={extend}>
              <CalendarPlus size={12} />
              {t("+7 days")}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
            {t("Close")}
          </button>
        </footer>
      ) : null}
    </article>
  );
}

const BLANK_PERMIT = { kind: "HOT_WORK" as PermitKind, title: "", zone: "", from: TODAY, to: addDays(TODAY, 7), issuedTo: "", activityId: "" };

function NewPermitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, x } = useL();
  const subs = useOps((s) => s.subs);
  const company = useOps((s) => s.setup.company);
  const activities = useOps((s) => s.activities);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const [f, setF] = useState(BLANK_PERMIT);
  useEffect(() => {
    if (open) setF({ ...BLANK_PERMIT, from: TODAY, to: addDays(TODAY, 7) });
  }, [open]);
  const save = () => {
    if (!f.title.trim()) {
      toast(t("Say what work the permit covers."), "warn");
      return;
    }
    if (f.to < f.from) {
      toast(t("The end date is before the start."), "warn");
      return;
    }
    const id = freshRef(() => nextRef("PTW"), (r) => useOps.getState().permits.some((p) => p.id === r));
    const permit: Permit = {
      id,
      ref: id,
      kind: f.kind,
      title: same(f.title.trim()),
      zone: zoneTxt(f.zone),
      from: f.from,
      to: f.to,
      status: "DRAFT",
      issuedTo: f.issuedTo.trim(),
      issuedBy: me(),
      activityId: f.activityId || null,
      checks: CHECKS[f.kind].map((item) => ({ item, ok: false })),
    };
    addItem("permits", permit, true);
    pushFeed("PM", { en: `${id} drafted: ${PERMIT_KIND[f.kind].label.en.toLowerCase()}, ${f.title.trim()}`, az: `${id} hazırlandı: ${PERMIT_KIND[f.kind].label.az.toLowerCase()}, ${f.title.trim()}` }, "pm/safety?tab=permits");
    toast(t("{ref} drafted. Tick the checks to activate it.", { ref: id }));
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("New permit to work")}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Create permit")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Kind of work")}>
          <select className="input select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PermitKind })}>
            {(Object.keys(PERMIT_KIND) as PermitKind[]).map((k) => (
              <option key={k} value={k}>
                {x(PERMIT_KIND[k].label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Where")}>
          <ZoneInput id="st-ptw-zone" value={f.zone} onChange={(v) => setF({ ...f, zone: v })} />
        </Field>
        <Field label={t("Work covered")} wide>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("What work the permit covers")} />
        </Field>
        <Field label={t("Starts")}>
          <input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value || TODAY })} />
        </Field>
        <Field label={t("Ends")}>
          <input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value || f.from })} />
        </Field>
        <Field label={t("Issued to")} hint={t("The crew or company doing the work.")}>
          <input className="input" value={f.issuedTo} onChange={(e) => setF({ ...f, issuedTo: e.target.value })} list="st-ptw-to" />
          <datalist id="st-ptw-to">
            {[company, ...subs.map((s) => s.name)].filter(Boolean).map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Field>
        <Field label={t("Activity")}>
          <select className="input select" value={f.activityId} onChange={(e) => setF({ ...f, activityId: e.target.value })}>
            <option value="">{t("None")}</option>
            {activities
              .filter((a) => a.status !== "COMPLETED" && !a.isMilestone)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {x(a.name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t("Checks")} wide hint={t("Set by the kind of work; tick them on the card.")}>
          <ul className="st-newchecks">
            {CHECKS[f.kind].map((c, i) => (
              <li key={i}>{x(c)}</li>
            ))}
          </ul>
        </Field>
      </div>
    </Dialog>
  );
}

