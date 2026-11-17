import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertOctagon, ArrowRight, CalendarRange, Coins, Hourglass, MapPinned, Siren, Truck, Wrench } from "lucide-react";
import { Badge, CountUp, FilterChips, PageHero, Panel, Register, SearchBox, StatTiles, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { R, statusMeta } from "../../../ops/select";
import type { Equipment, EquipmentCategory, EquipmentStatus } from "../../../ops/types";
import { FleetMap } from "./FleetMap";
import { HireCalendar } from "./HireCalendar";
import { EquipmentDetail, useBreakdownLinks } from "./EquipmentDrawer";
import { CATEGORY, eqFlags, FLAG_LABEL, hireSplit, isHired, siteLink, SiteBadge, siteMeta, type EqFlag } from "./shared";

const FLAGS: EqFlag[] = ["OFF_HIRE_SOON", "IDLE_HIRED", "INVOICE", "SERVICE", "BROKEN"];
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/**
 * Equipment: where every machine is on the site plan, what hired plant costs a day working and standing,
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

  // ------------------------------------------------------------ figures
  const split = equipment.map(hireSplit);
  const work = split.reduce((a, s) => a + s.work, 0);
  const idle = split.reduce((a, s) => a + s.idle, 0);
  const hired = equipment.filter(isHired);
  const onSite = equipment.filter((e) => e.status === "ON_SITE" || e.status === "IDLE");
  const due = equipment.filter((e) => eqFlags(e).includes("SERVICE"));
  const idleShare = work + idle > 0 ? Math.round((idle / (work + idle)) * 100) : 0;

  const filtered = useMemo(
    () =>
      equipment.filter(
        (e) =>
          (!flag || eqFlags(e).includes(flag)) &&
          (!cat || e.category === cat) &&
          (!own || e.ownership === own) &&
          (!zone || e.zone.en === zone) &&
          (!status || e.status === status),
      ),
    [equipment, flag, cat, own, zone, status],
  );
  const rows = useSearch(filtered, q, (e) => [e.code, e.name, e.zone, vendors.find((v) => v.id === e.vendorId)?.name, activities.find((a) => a.id === e.activityId)?.code]);
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
            <strong>{x(e.zone)}</strong>
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
            <strong className="num-inline">
              {fmt(e.dayRate)} {t("AZN/day")}
            </strong>
            <small>{vendors.find((v) => v.id === e.vendorId)?.name ?? t("Local hire")}</small>
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

  const anyFilter = flag || cat || own || zone || status || q;

  return (
    <div className="k-page st-page">
      <PageHero
        eyebrow={t("Site · Equipment")}
        title={t("Equipment")}
        subtitle={t("Every machine on the Qobu site: where it stands, what it is doing, and what hired plant costs while it works or waits.")}
        flow={["Mobilise", "Assign", "Track hours", "Service", "Off-hire"]}
        art="live"
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => document.getElementById("st-hire")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <CalendarRange size={15} />
              {t("Hire calendar")}
            </button>
            <Link to={R.live} className="btn btn-ghost">
              <Siren size={15} />
              {t("Live programme")}
            </Link>
          </>
        }
      />

      <StatTiles
        className="st-kpis"
        items={[
          { label: t("In the fleet"), icon: <Truck size={14} />, value: <CountUp value={equipment.length} />, sub: t("{o} owned · {h} hired", { o: equipment.filter((e) => e.ownership === "OWNED").length, h: equipment.filter((e) => e.ownership === "HIRED").length }) },
          { label: t("On site now"), icon: <MapPinned size={14} />, value: <CountUp value={onSite.length} />, sub: t("{w} working · {i} idle", { w: onSite.filter((e) => e.status === "ON_SITE").length, i: onSite.filter((e) => e.status === "IDLE").length }), onClick: () => setStatus(status === "ON_SITE" ? null : "ON_SITE") },
          { label: t("Maintenance due"), icon: <Wrench size={14} />, value: <CountUp value={due.length} />, sub: t("service within 7 days"), tone: due.length ? "warn" : "ok", onClick: () => setFlag(flag === "SERVICE" ? null : "SERVICE") },
          { label: t("Hired on site"), icon: <Hourglass size={14} />, value: <CountUp value={hired.length} />, sub: t("{n} AZN a day on hire", { n: fmt(hired.reduce((a, e) => a + e.dayRate, 0)) }) },
          { label: t("Hire working"), icon: <Coins size={14} />, value: <CountUp value={work} format={(v) => fmt(v)} />, sub: t("AZN/day earning its keep"), tone: "ok" },
          { label: t("Hire idle"), icon: <Coins size={14} />, value: <CountUp value={idle} format={(v) => fmt(v)} />, sub: t("AZN/day standing · {p}% of hire", { p: idleShare }), tone: idle > work ? "bad" : "warn", onClick: () => setFlag(flag === "IDLE_HIRED" ? null : "IDLE_HIRED") },
        ]}
      />

      <div className="st-moneybar" aria-label={t("Hire spend today")}>
        <span className="st-moneybar-track">
          <i className="work k-grow-x" style={{ width: `${100 - idleShare}%` }} />
          <i className="idle k-grow-x" style={{ width: `${idleShare}%` }} />
        </span>
        <span className="small muted">{t("Of {n} AZN of hire today, {w} works and {i} stands.", { n: fmt(work + idle), w: fmt(work), i: fmt(idle) })}</span>
      </div>

      {broken.map((e) => (
        <BrokenCallout key={e.id} e={e} onOpen={() => setOpen(e.id)} />
      ))}

      <div className="k-grid-main">
        <Panel title={t("Where the fleet is")} icon={<MapPinned size={15} />} count={equipment.length} actions={zone || status ? <button type="button" className="k-link-btn" onClick={() => { setZone(null); setStatus(null); }}>{t("Show all")}</button> : null} sub={t("Each mark is a machine, coloured by its state. Click a machine to open it, a zone to filter the register.")}>
          <FleetMap items={equipment} selected={openId} onSelect={setOpen} zone={zone} onZone={setZone} status={status} onStatus={setStatus} />
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

      <Panel title={t("Hire calendar")} icon={<CalendarRange size={15} />} className="st-hire-panel" sub={t("Hire periods from October to April. Hatched days had no hours booked.")}>
        <div id="st-hire" className="st-anchor" />
        <HireCalendar items={equipment} vendors={vendors} selected={openId} onSelect={setOpen} />
      </Panel>

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
            {zone ? (
              <button type="button" className="k-chip on" onClick={() => setZone(null)}>
                {x(equipment.find((e) => e.zone.en === zone)?.zone ?? { en: zone, az: zone })} ×
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

      <Drawer open={!!opened} onClose={() => setOpen(null)} kicker={opened ? `${opened.code} · ${x(CATEGORY[opened.category].label)}` : undefined} title={opened ? x(opened.name) : ""} width={480}>
        {opened ? <EquipmentDetail e={opened} /> : null}
      </Drawer>
      {opened ? <div className="st-scrim" onClick={() => setOpen(null)} aria-hidden="true" /> : null}
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
