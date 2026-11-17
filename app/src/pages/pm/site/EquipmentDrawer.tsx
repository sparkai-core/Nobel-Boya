import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ArrowRight, CalendarPlus, LogOut, Plus, Receipt, Wrench, CheckCircle2, MapPin } from "lucide-react";
import { Badge, Field, KeyVals, Money, Sparkline, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, TODAY } from "../../../ops/dates";
import { R, statusMeta } from "../../../ops/select";
import type { Equipment } from "../../../ops/types";
import { CATEGORY, daysOnHire, DrawerSection, eqFlags, FLAG_LABEL, idleCost7, invoiceState, siteLink, SiteBadge, siteMeta, utilisation, zoneForBuilding, zoneTxt } from "./shared";

/** Live-programme impact and permits that hang off a broken-down machine. */
export function useBreakdownLinks(e: Equipment | undefined) {
  const impacts = useOps((s) => s.impacts);
  const permits = useOps((s) => s.permits);
  const activities = useOps((s) => s.activities);
  if (!e) return { impact: undefined, permit: undefined, activity: undefined };
  const activity = activities.find((a) => a.id === e.activityId);
  const impact = impacts.find((i) => i.kind === "EQUIPMENT_FAILURE" && i.activityId === e.activityId && i.status !== "RESOLVED" && i.status !== "REJECTED");
  const permit = e.category === "CRANE" ? permits.find((p) => p.kind === "LIFTING" && p.zone.en === e.zone.en && p.status !== "CLOSED") : undefined;
  return { impact, permit, activity };
}

export function EquipmentDetail({ e }: { e: Equipment }) {
  const { t, x, d, rel } = useL();
  const activities = useOps((s) => s.activities);
  const vendors = useOps((s) => s.vendors);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const links = useBreakdownLinks(e);
  const activity = links.activity;
  const vendor = vendors.find((v) => v.id === e.vendorId);
  const flags = eqFlags(e);
  const hired = e.ownership === "HIRED";

  const candidates = activities.filter((a) => a.status !== "COMPLETED" && !a.isMilestone);
  const [assignTo, setAssignTo] = useState(e.activityId ?? "");
  const [extend, setExtend] = useState(14);
  const [inv, setInv] = useState({ ref: "", period: "", days: "", billed: "" });
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    setAssignTo(e.activityId ?? "");
    setInv({ ref: "", period: "", days: "", billed: "" });
    setAdding(false);
  }, [e.id, e.activityId]);

  const feed = (en: string, az: string) => pushFeed("PM", { en: `${e.code} ${en}`, az: `${e.code} ${az}` }, `pm/equipment?eq=${e.id}`);

  const assign = () => {
    const a = activities.find((y) => y.id === assignTo);
    if (!a) return;
    patchItem("equipment", e.id, { activityId: a.id, zone: zoneForBuilding(a.building), status: e.status === "AVAILABLE" || e.status === "IDLE" ? "ON_SITE" : e.status });
    feed(`assigned to ${a.code} ${a.name.en}`, `${a.code} ${a.name.az} işinə təyin edildi`);
    toast(t("{code} assigned to {act}", { code: e.code, act: a.code }));
  };
  const toMaintenance = () => {
    patchItem("equipment", e.id, { status: "MAINTENANCE", zone: zoneTxt("Workshop") });
    feed("sent to the workshop for maintenance", "texniki xidmət üçün emalatxanaya göndərildi");
    toast(t("{code} sent to maintenance", { code: e.code }), "info");
  };
  const repaired = () => {
    const back = activity ? zoneForBuilding(activity.building) : zoneTxt("Main store");
    patchItem("equipment", e.id, { status: activity ? "ON_SITE" : "AVAILABLE", zone: back, nextService: addDays(TODAY, 90) });
    let extra = "";
    if (links.impact) {
      patchItem("impacts", links.impact.id, { status: "MITIGATED" });
      extra = t("live impact mitigated");
    }
    const s = useOps.getState();
    for (const c of s.constraints.filter((c) => c.link?.kind === "EQUIPMENT" && c.link.id === e.id && c.status === "OPEN")) patchItem("constraints", c.id, { status: "CLEARED" });
    if (links.permit) {
      patchItem("permits", links.permit.id, { checks: links.permit.checks.map((c) => (/crane|inspection/i.test(c.item.en) ? { ...c, ok: true } : c)) });
      extra = [extra, t("{ref} crane check passed", { ref: links.permit.ref })].filter(Boolean).join(" · ");
    }
    feed("repaired and back in service", "təmir olundu və yenidən işdədir");
    toast(t("{code} back in service", { code: e.code }) + (extra ? ` · ${extra}` : ""));
  };
  const offHire = () => {
    patchItem("equipment", e.id, { status: "OFF_HIRE", hireTo: TODAY, activityId: null, zone: zoneTxt("Main gate yard") });
    feed(`off-hire requested from ${vendor?.name ?? "the hire firm"}`, `${vendor?.name ?? "icarə şirkəti"} üçün icarədən çıxarılma sorğusu göndərildi`);
    toast(t("Off-hire request sent for {code}", { code: e.code }), "warn");
  };
  const extendHire = () => {
    const next = addDays(e.hireTo && e.hireTo > TODAY ? e.hireTo : TODAY, extend);
    patchItem("equipment", e.id, { hireTo: next });
    feed(`hire extended to ${next}`, `icarə ${next} tarixinədək uzadıldı`);
    toast(t("Hire of {code} extended to {date}", { code: e.code, date: d(next) }));
  };
  const days = Number(inv.days) || 0;
  const billed = Number(inv.billed) || 0;
  const accrued = Math.round(days * e.dayRate);
  const recordInvoice = () => {
    if (!inv.ref.trim() || days <= 0 || billed <= 0) {
      toast(t("Add the invoice number, days and amount billed."), "warn");
      return;
    }
    const row = { ref: inv.ref.trim(), period: inv.period.trim() || t("{n} days", { n: days }), billed, accrued };
    patchItem("equipment", e.id, { hireInvoices: [...e.hireInvoices, row] });
    const st = invoiceState(row);
    const az = st.label === "Matches" ? "uyğundur" : st.label === "Over-billed" ? "artıq fakturalanıb" : "az fakturalanıb";
    feed(`hire invoice ${row.ref} recorded: ${st.label.toLowerCase()}`, `${row.ref} icarə fakturası qeydə alındı: ${az}`);
    toast(t("Invoice {ref} recorded: {state}", { ref: row.ref, state: t(st.label) }), st.tone === "ok" ? "ok" : "warn");
    setInv({ ref: "", period: "", days: "", billed: "" });
    setAdding(false);
  };

  const util = utilisation(e);
  const hoursTotal = e.hours.reduce((a, h) => a + h, 0);
  const serviceLate = e.nextService < TODAY;
  const impactMeta = links.impact ? statusMeta("impact", links.impact.status) : null;

  return (
    <div className="k-stack st-drawer">
      <div className="k-row">
        <SiteBadge kind="equipment" status={e.status} />
        <Badge tone={hired ? "info" : "neutral"} dot={false}>
          {hired ? t("Hired") : t("Owned")}
        </Badge>
        <span className="muted small">{x(CATEGORY[e.category].label)}</span>
      </div>
      {flags.length ? (
        <div className="k-row st-flags">
          {flags.map((f) => (
            <Badge key={f} tone={FLAG_LABEL[f].tone}>
              {t(FLAG_LABEL[f].label)}
            </Badge>
          ))}
        </div>
      ) : null}

      {e.status === "BROKEN_DOWN" ? (
        <div className="k-callout k-tone-bad st-callout">
          <AlertOctagon size={16} />
          <div>
            <strong>{links.impact ? x(links.impact.text) : t("Out of service")}</strong>
            <p>
              {activity ? t("Holds {code} {name}.", { code: activity.code, name: x(activity.name) }) : null}{" "}
              {links.impact ? t("{n} days at stake on the live programme ({state}).", { n: links.impact.daysImpact, state: impactMeta ? x(impactMeta.label) : "" }) : null}
            </p>
            <div className="k-row st-callout-links">
              <Link to={R.live} className="k-link-btn">
                {t("Open the live programme")} <ArrowRight size={13} />
              </Link>
              {links.permit ? (
                <Link to={siteLink.safety("permits")} className="k-link-btn">
                  {t("Lifting permit {ref}: {state}", { ref: links.permit.ref, state: x(siteMeta("permit", links.permit.status).label) })} <ArrowRight size={13} />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <DrawerSection title={t("Passport")}>
        <KeyVals
          items={[
            { k: t("Where"), v: <span className="st-where"><MapPin size={12} />{x(e.zone)}</span> },
            { k: t("Activity"), v: activity ? <Link to={R.programme(activity.id)}>{activity.code} · {x(activity.name)}</Link> : <span className="muted">{t("Not assigned")}</span> },
            { k: t("Next service"), v: <span className={serviceLate ? "k-text-bad" : undefined}>{d(e.nextService)} · {rel(e.nextService)}</span> },
            { k: t("Day rate"), v: <Money value={e.dayRate} /> },
          ]}
        />
        <div className="st-spark">
          <div>
            <span className="muted small">{t("Hours, last 7 days")}</span>
            <strong className="num-inline">
              {hoursTotal} {t("h")} · {Math.round(util * 100)}% {t("used")}
            </strong>
          </div>
          <Sparkline values={e.hours} width={150} height={36} tone={util < 0.4 ? "warn" : "brand"} />
        </div>
      </DrawerSection>

      {hired ? (
        <DrawerSection title={t("Hire economics")} aside={vendor ? <Link to={R.vendor(vendor.id)} className="k-link-btn">{vendor.name}</Link> : null}>
          <div className="st-econ">
            <div>
              <span>{t("Day rate")}</span>
              <Money value={e.dayRate} />
            </div>
            <div>
              <span>{t("Days on hire")}</span>
              <strong className="num-inline">{daysOnHire(e)}</strong>
              <small>
                {d(e.hireFrom, false)} – {d(e.hireTo, false)}
              </small>
            </div>
            <div>
              <span>{t("Hire to date")}</span>
              <Money value={daysOnHire(e) * e.dayRate} short />
            </div>
            <div className={idleCost7(e) > e.dayRate ? "bad" : undefined}>
              <span>{t("Idle cost, past 6 days")}</span>
              <Money value={idleCost7(e)} />
            </div>
          </div>
        </DrawerSection>
      ) : null}

      {hired ? (
        <DrawerSection
          title={t("Hire invoices")}
          aside={
            !adding ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
                <Plus size={13} />
                {t("Record hire invoice")}
              </button>
            ) : null
          }
        >
          {e.hireInvoices.length ? (
            <ul className="st-invoices">
              {e.hireInvoices.map((i, k) => {
                const st = invoiceState(i);
                const diff = i.billed - i.accrued;
                return (
                  <li key={`${i.ref}-${k}`}>
                    <Receipt size={14} />
                    <span className="k-cell-title">
                      <strong>{i.ref}</strong>
                      <small>{i.period}</small>
                    </span>
                    <span className="st-inv-figs">
                      <span>
                        {t("Billed")} <Money value={i.billed} currency={false} />
                      </span>
                      <span>
                        {t("Accrued")} <Money value={i.accrued} currency={false} />
                      </span>
                    </span>
                    <Badge tone={st.tone}>
                      {t(st.label)}
                      {Math.abs(diff) > 0.5 ? ` ${diff > 0 ? "+" : "−"}${Math.abs(Math.round(diff)).toLocaleString("en-US")}` : ""}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">{t("No hire invoices yet.")}</p>
          )}
          {adding ? (
            <div className="st-inv-form k-rise">
              <div className="k-form">
                <Field label={t("Invoice number")}>
                  <input className="input" value={inv.ref} onChange={(ev) => setInv({ ...inv, ref: ev.target.value })} placeholder="ATL-H-1103" />
                </Field>
                <Field label={t("Period")}>
                  <input className="input" value={inv.period} onChange={(ev) => setInv({ ...inv, period: ev.target.value })} placeholder={t("Nov 2026 (16–30)")} />
                </Field>
                <Field label={t("Days billed")}>
                  <input className="input" type="number" min={0} value={inv.days} onChange={(ev) => setInv({ ...inv, days: ev.target.value })} />
                </Field>
                <Field label={t("Amount billed, AZN")}>
                  <input className="input" type="number" min={0} value={inv.billed} onChange={(ev) => setInv({ ...inv, billed: ev.target.value })} />
                </Field>
              </div>
              {days > 0 ? (
                <p className="small muted">
                  {t("Accrued at the day rate: {n} AZN", { n: accrued.toLocaleString("en-US") })}
                  {billed > 0 ? ` · ${t(invoiceState({ ref: "", period: "", billed, accrued }).label)}` : ""}
                </p>
              ) : null}
              <div className="k-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={recordInvoice}>
                  {t("Record invoice")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
                  {t("Cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </DrawerSection>
      ) : null}

      <DrawerSection title={t("Actions")}>
        <div className="st-assign">
          <select className="input select" value={assignTo} onChange={(ev) => setAssignTo(ev.target.value)} aria-label={t("Activity")} disabled={e.status === "OFF_HIRE"}>
            <option value="">{t("Choose an activity…")}</option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={assign} disabled={!assignTo || assignTo === e.activityId || e.status === "OFF_HIRE"}>
            {t("Assign to activity")}
          </button>
        </div>
        <div className="st-actions">
          {e.status === "MAINTENANCE" || e.status === "BROKEN_DOWN" ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={repaired}>
              <CheckCircle2 size={13} />
              {t("Mark repaired")}
            </button>
          ) : null}
          {e.status !== "MAINTENANCE" && e.status !== "OFF_HIRE" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={toMaintenance}>
              <Wrench size={13} />
              {t("Send to maintenance")}
            </button>
          ) : null}
          {hired && e.status !== "OFF_HIRE" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={offHire}>
              <LogOut size={13} />
              {t("Off-hire request")}
            </button>
          ) : null}
        </div>
        {hired && e.status !== "OFF_HIRE" ? (
          <div className="st-assign">
            <select className="input select" value={extend} onChange={(ev) => setExtend(Number(ev.target.value))} aria-label={t("Extend by")}>
              {[7, 14, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {t("+{n} days", { n })}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={extendHire}>
              <CalendarPlus size={13} />
              {t("Extend hire")}
            </button>
          </div>
        ) : null}
      </DrawerSection>
    </div>
  );
}
