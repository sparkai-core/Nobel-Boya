import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertOctagon, ArrowRight, CalendarRange, Coins, Hourglass, MapPin, MapPinned, Plus, Truck, Wrench } from "lucide-react";
import { Badge, CountUp, Empty, FilterChips, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { R, statusMeta } from "../../../ops/select";
import type { Equipment, EquipmentCategory, EquipmentStatus } from "../../../ops/types";
import { HireCalendar } from "./HireCalendar";
import { EquipmentDialog } from "./SiteDialogs";
import { equipmentSupplier } from "../../../ops/ext/site-p2";
import { EquipmentDetail, useBreakdownLinks } from "./EquipmentDrawer";
import { CATEGORY, eqFlags, FLAG_LABEL, hireSplit, isHired, siteLink, SiteBadge, siteMeta, type EqFlag } from "./shared";

const FLAGS: EqFlag[] = ["OFF_HIRE_SOON", "IDLE_HIRED", "INVOICE", "SERVICE", "BROKEN"];
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
const NO_ZONE = "";

/**
 * Equipment: where every machine is on site, what hired plant costs a day working and standing,
 * the hire calendar with return dates, and the register with attention flags. The drawer holds each
 * machine's passport, hire economics, hire invoices and the actions that move it.
 */
export function EquipmentPage() {
  const { t, x } = useL();
  const equipment = useOps((s) => s.equipment);
  const vendors = useOps((s) => s.vendors);
  const activities = useOps((s) => s.activities);
  const [params, setParams] = useSearchParams();
  const openId = params.get("eq");
  const setOpen = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set("eq", id);
        else n.delete("eq");
        return n;
      },
      { replace: true },
    );

  const [flag, setFlag] = useState<EqFlag | null>(null);
  const [cat, setCat] = useState<EquipmentCategory | "">("");
  const [own, setOwn] = useState<"" | "OWNED" | "HIRED">("");
  const [zone, setZone] = useState<string | null>(null);
  const [status, setStatus] = useState<EquipmentStatus | null>(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  // ------------------------------------------------------------ figures
  const split = equipment.map(hireSplit);
  const work = split.reduce((a, s) => a + s.work, 0);
  const idle = split.reduce((a, s) => a + s.idle, 0);
  const untracked = split.reduce((a, s) => a + s.untracked, 0);
  const hireToday = work + idle + untracked;
  const tracked = work + idle > 0;
  const hired = equipment.filter(isHired);
  const onSite = equipment.filter((e) => e.status === "ON_SITE" || e.status === "IDLE");
  const due = equipment.filter((e) => eqFlags(e).includes("SERVICE"));
  const idleShare = work + idle > 0 ? Math.round((idle / (work + idle)) * 100) : 0;
  const pctOf = (v: number) => (hireToday > 0 ? (v / hireToday) * 100 : 0);
  const zones = useMemo(() => {
    const m = new Map<string, Equipment[]>();
    for (const e of equipment) m.set(e.zone.en || NO_ZONE, [...(m.get(e.zone.en || NO_ZONE) ?? []), e]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [equipment]);

  const filtered = useMemo(
    () =>
      equipment.filter(
        (e) =>
          (!flag || eqFlags(e).includes(flag)) &&
          (!cat || e.category === cat) &&
          (!own || e.ownership === own) &&
          (zone == null || (e.zone.en || NO_ZONE) === zone) &&
          (!status || e.status === status),
      ),
    [equipment, flag, cat, own, zone, status],
  );
  const rows = useSearch(filtered, q, (e) => [e.code, e.name, e.zone, vendors.find((v) => v.id === e.vendorId)?.name ?? equipmentSupplier(e), activities.find((a) => a.id === e.activityId)?.code]);
  const opened = equipment.find((e) => e.id === openId);
  const broken = equipment.filter((e) => e.status === "BROKEN_DOWN");

  const columns: Column<Equipment>[] = [
    {
      key: "machine",
      header: t("Machine"),
      sort: (e) => e.code,
      render: (e) => {
        const Icon = CATEGORY[e.category].icon;
        return (
          <span className="st-machine">
            <span className={`st-machine-icon k-tone-${siteMeta("equipment", e.status).tone}`}>
              <Icon size={15} />
            </span>
            <span className="k-cell-title">
              <strong>{x(e.name)}</strong>
              <small>
                <span className="k-ref">{e.code}</span> · {x(CATEGORY[e.category].label)}
              </small>
            </span>
          </span>
        );
      },
    },
    {
      key: "where",
      header: t("Where"),
      sort: (e) => e.zone.en,
      hideBelow: 820,
      render: (e) => {
        const a = activities.find((y) => y.id === e.activityId);
        return (
          <span className="k-cell-title">
            <strong>{x(e.zone) || "—"}</strong>
            <small>{a ? a.code : t("No activity")}</small>
          </span>
        );
      },
    },
    {
      key: "hire",
      header: t("Hire"),
      sort: (e) => (e.ownership === "HIRED" ? e.dayRate : -1),
      hideBelow: 900,
      render: (e) =>
        e.ownership === "HIRED" ? (
          <span className="k-cell-title">
            <strong className="num-inline">{e.dayRate ? `${fmt(e.dayRate)} ${t("AZN/day")}` : "—"}</strong>
            <small>{vendors.find((v) => v.id === e.vendorId)?.name ?? (equipmentSupplier(e) || t("Supplier not set"))}</small>
          </span>
        ) : (
          <span className="muted small">{t("Owned")}</span>
        ),
    },
    {
      key: "attention",
      header: t("Needs attention"),
      sort: (e) => eqFlags(e).length,
      render: (e) => {
        const f = eqFlags(e);
        return f.length ? (
          <span className="st-flagcell">
            {f.map((k) => (
              <Badge key={k} tone={FLAG_LABEL[k].tone}>
                {t(FLAG_LABEL[k].label)}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="muted small">—</span>
        );
      },
    },
    { key: "status", header: t("Status"), sort: (e) => e.status, render: (e) => <SiteBadge kind="equipment" status={e.status} /> },
  ];

  const anyFilter = flag || cat || own || zone != null || status || q;

  return (
    <div className="k-page st-page">
      <PageHero
        eyebrow={t("Site · Equipment")}
        title={t("Equipment")}
        subtitle={t("Every machine on site: where it stands, what it is doing, and what hired plant costs while it works or waits.")}
        flow={["Mobilise", "Assign", "Track hours", "Service", "Off-hire"]}
        art="live"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} />
              {t("Add equipment")}
            </button>
            {equipment.some((e) => e.ownership === "HIRED") ? (
              <button type="button" className="btn btn-ghost" onClick={() => document.getElementById("st-hire")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <CalendarRange size={15} />
                {t("Hire calendar")}
              </button>
            ) : null}
          </>
        }
      />

      {!equipment.length ? (
        <Empty
          icon={<Truck size={22} />}
          title={t("No equipment registered yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} />
              {t("Add equipment")}
            </button>
          }
        >
          {t("Add the machines on site, owned or hired. Hire periods, day rates, services and hire invoices are tracked from here.")}
        </Empty>
      ) : (
        <>
      <StatTiles
        className="st-kpis"
        items={[
          { label: t("In the fleet"), icon: <Truck size={14} />, value: <CountUp value={equipment.length} />, sub: t("{o} owned · {h} hired", { o: equipment.filter((e) => e.ownership === "OWNED").length, h: equipment.filter((e) => e.ownership === "HIRED").length }) },
          { label: t("On site now"), icon: <MapPinned size={14} />, value: <CountUp value={onSite.length} />, sub: t("{w} working · {i} idle", { w: onSite.filter((e) => e.status === "ON_SITE").length, i: onSite.filter((e) => e.status === "IDLE").length }), onClick: () => setStatus(status === "ON_SITE" ? null : "ON_SITE") },
          { label: t("Maintenance due"), icon: <Wrench size={14} />, value: <CountUp value={due.length} />, sub: t("service within 7 days"), tone: due.length ? "warn" : "ok", onClick: () => setFlag(flag === "SERVICE" ? null : "SERVICE") },
          { label: t("Hired on site"), icon: <Hourglass size={14} />, value: <CountUp value={hired.length} />, sub: t("{n} AZN a day on hire", { n: fmt(hired.reduce((a, e) => a + e.dayRate, 0)) }) },
          { label: t("Hire working"), icon: <Coins size={14} />, value: tracked ? <CountUp value={work} format={(v) => fmt(v)} /> : "—", sub: tracked ? t("AZN/day earning its keep") : t("no hours logged"), tone: tracked ? "ok" : "neutral" },
          { label: t("Hire idle"), icon: <Coins size={14} />, value: tracked || idle ? <CountUp value={idle} format={(v) => fmt(v)} /> : "—", sub: tracked || idle ? t("AZN/day standing · {p}% of hire", { p: idleShare }) : t("no hours logged"), tone: idle > work ? "bad" : idle ? "warn" : "neutral", onClick: () => setFlag(flag === "IDLE_HIRED" ? null : "IDLE_HIRED") },
        ]}
      />

      <div className="st-moneybar" aria-label={t("Hire spend today")}>
        {hireToday > 0 ? (
          <>
            <span className="st-moneybar-track">
              <i className="work k-grow-x" style={{ width: `${pctOf(work)}%` }} />
              <i className="idle k-grow-x" style={{ width: `${pctOf(idle)}%` }} />
            </span>
            <span className="small muted">
              {t("Of {n} AZN of hire today, {w} works and {i} stands.", { n: fmt(hireToday), w: fmt(work), i: fmt(idle) })}
              {untracked ? ` ${t("{u} AZN has no hours logged, so it is not split.", { u: fmt(untracked) })}` : ""}
            </span>
          </>
        ) : (
          <span className="small muted">{hired.length ? t("Hired machines have no day rate yet, so hire cost is not shown.") : t("No hired machines on site, so no hire cost runs today.")}</span>
        )}
      </div>

      {broken.map((e) => (
        <BrokenCallout key={e.id} e={e} onOpen={() => setOpen(e.id)} />
      ))}

      <div className="k-grid-main">
        <Panel title={t("Where the fleet is")} icon={<MapPinned size={15} />} count={equipment.length} actions={zone != null || status ? <button type="button" className="k-link-btn" onClick={() => { setZone(null); setStatus(null); }}>{t("Show all")}</button> : null} sub={t("Machines by the place recorded on each one. Click a place to filter the register.")}>
          <ul className="st-attn">
            {zones.map(([key, list]) => (
              <li key={key || "none"} className={zone === key ? "on" : undefined}>
                <button type="button" onClick={() => setZone(zone === key ? null : key)} aria-pressed={zone === key}>
                  <span className="st-attn-n k-tone-neutral">{list.length}</span>
                  <span className="k-cell-title">
                    <strong>
                      <MapPin size={12} /> {key ? x(list[0]!.zone) : t("No place recorded")}
                    </strong>
                    <small>
                      {list.slice(0, 6).map((e) => e.code).join(", ")}
                      {list.length > 6 ? ` +${list.length - 6}` : ""} · {t("{w} working · {i} idle", { w: list.filter((e) => e.status === "ON_SITE").length, i: list.filter((e) => e.status === "IDLE").length })}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("Needs attention")} icon={<AlertOctagon size={15} />} count={equipment.filter((e) => eqFlags(e).length).length}>
          <ul className="st-attn">
            {FLAGS.map((f) => {
              const list = equipment.filter((e) => eqFlags(e).includes(f));
              return (
                <li key={f} className={flag === f ? "on" : undefined}>
                  <button type="button" onClick={() => setFlag(flag === f ? null : f)} disabled={!list.length} aria-pressed={flag === f}>
                    <span className={`st-attn-n k-tone-${list.length ? FLAG_LABEL[f].tone : "muted"}`}>{list.length}</span>
                    <span className="k-cell-title">
                      <strong>{t(FLAG_LABEL[f].label)}</strong>
                      <small>{list.length ? list.map((e) => e.code).join(", ") : t("Nothing here")}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {equipment.some((e) => e.ownership === "HIRED") ? (
        <Panel title={t("Hire calendar")} icon={<CalendarRange size={15} />} className="st-hire-panel" sub={t("Hire periods of the hired machines, from their recorded start and end dates.")}>
          <div id="st-hire" className="st-anchor" />
          <HireCalendar items={equipment} vendors={vendors} selected={openId} onSelect={setOpen} />
        </Panel>
      ) : null}

      <Register
        rows={rows}
        columns={columns}
        rowKey={(e) => e.id}
        onRowClick={(e) => setOpen(e.id)}
        rowClass={(e) => (e.id === openId ? "st-row-on" : undefined)}
        initialSort={{ key: "attention", dir: "desc" }}
        toolbar={
          <Toolbar
            end={
              <div className="st-selects">
                <select className="input select" value={cat} onChange={(ev) => setCat(ev.target.value as EquipmentCategory | "")} aria-label={t("Category")}>
                  <option value="">{t("All categories")}</option>
                  {(Object.keys(CATEGORY) as EquipmentCategory[]).filter((c) => equipment.some((e) => e.category === c)).map((c) => (
                    <option key={c} value={c}>
                      {x(CATEGORY[c].label)}
                    </option>
                  ))}
                </select>
                <select className="input select" value={own} onChange={(ev) => setOwn(ev.target.value as "" | "OWNED" | "HIRED")} aria-label={t("Ownership")}>
                  <option value="">{t("Owned and hired")}</option>
                  <option value="OWNED">{t("Owned")}</option>
                  <option value="HIRED">{t("Hired")}</option>
                </select>
              </div>
            }
          >
            <SearchBox value={q} onChange={setQ} placeholder="Search machines, zones, activities" />
            <FilterChips value={flag} onChange={setFlag} options={FLAGS.map((f) => ({ value: f, label: t(FLAG_LABEL[f].label), count: equipment.filter((e) => eqFlags(e).includes(f)).length }))} />
            {zone != null ? (
              <button type="button" className="k-chip on" onClick={() => setZone(null)}>
                {zone ? x(equipment.find((e) => e.zone.en === zone)?.zone ?? { en: zone, az: zone }) : t("No place recorded")} ×
              </button>
            ) : null}
            {status ? (
              <button type="button" className="k-chip on" onClick={() => setStatus(null)}>
                {x(siteMeta("equipment", status).label)} ×
              </button>
            ) : null}
          </Toolbar>
        }
        empty={
          <>
            {t("No machines match.")}{" "}
            {anyFilter ? (
              <button
                type="button"
                className="k-link-btn"
                onClick={() => {
                  setFlag(null);
                  setCat("");
                  setOwn("");
                  setZone(null);
                  setStatus(null);
                  setQ("");
                }}
              >
                {t("Clear filters")}
              </button>
            ) : null}
          </>
        }
      />
        </>
      )}

      <Drawer open={!!opened} onClose={() => setOpen(null)} kicker={opened ? `${opened.code} · ${x(CATEGORY[opened.category].label)}` : undefined} title={opened ? x(opened.name) : ""} width={480}>
        {opened ? <EquipmentDetail e={opened} onDeleted={() => setOpen(null)} /> : null}
      </Drawer>
      {opened ? <div className="st-scrim" onClick={() => setOpen(null)} aria-hidden="true" /> : null}
      <EquipmentDialog open={adding} onClose={() => setAdding(false)} onSaved={(id) => setOpen(id)} />
    </div>
  );
}

function BrokenCallout({ e, onOpen }: { e: Equipment; onOpen: () => void }) {
  const { t, x } = useL();
  const { impact, permit, activity } = useBreakdownLinks(e);
  return (
    <div className="k-callout k-tone-bad st-callout st-broken k-rise">
      <AlertOctagon size={17} />
      <div>
        <strong>
          {impact ? `${e.code} · ${x(impact.text)}` : `${e.code} ${x(e.name)}: ${t("broken down")}`}
        </strong>
        <p>
          {activity ? t("It holds {code} {name}", { code: activity.code, name: x(activity.name) }) : t("Not assigned to an activity")}
          {impact ? ` · ${t("{n} days at stake", { n: impact.daysImpact })} · ${x(statusMeta("impact", impact.status).label)}` : ""}
          {permit ? ` · ${t("lifting permit {ref} {state}", { ref: permit.ref, state: x(siteMeta("permit", permit.status).label).toLowerCase() })}` : ""}
        </p>
      </div>
      <div className="st-callout-acts">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>
          {t("Open machine")}
        </button>
        <Link to={R.live} className="btn btn-primary btn-sm">
          {t("Live programme")} <ArrowRight size={13} />
        </Link>
        {permit ? (
          <Link to={siteLink.safety("permits")} className="k-link-btn">
            {permit.ref}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
