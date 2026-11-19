import { useMemo, useState } from "react";
import { HardHat, Package, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Badge, Dialog, Empty, Field, Kebab, StackedColumns, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { maxDate, minDate, monthShort, same, TODAY } from "../../../ops/dates";
import type { Resource, ResourceType } from "../../../ops/types";
import { fmtNum, unitLabel } from "../../../lib/format";
import { spreadResource } from "./model";

const TYPE_LABEL: Record<ResourceType, string> = { LABOUR: "Labour", PLANT: "Plant", MATERIAL: "Material" };
const TYPE_ICON = { LABOUR: HardHat, PLANT: Truck, MATERIAL: Package } as const;
const UNIT_OF: Record<ResourceType, string> = { LABOUR: "man-days", PLANT: "days", MATERIAL: "t" };

/**
 * Resources the user plans by hand: the budgeted quantity of each, the activities it works on, a
 * month-by-month plan spread over those activities' dates, and the quantity used so far as recorded.
 */
export function ResourcesTab() {
  const { t, x, d, lang } = useL();
  const resources = useOps((s) => s.resources);
  const activities = useOps((s) => s.activities);
  const removeItem = useOps((s) => s.removeItem);
  const [picked, setPicked] = useState<string | null>(resources[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const r = resources.find((z) => z.id === picked) ?? resources[0];

  const span = (res: Resource) => {
    const acts = activities.filter((a) => res.activityIds.includes(a.id));
    if (!acts.length) return null;
    return { from: acts.reduce((m, a) => minDate(m, a.start), acts[0]!.start), to: acts.reduce((m, a) => maxDate(m, a.end), acts[0]!.end) };
  };

  const chart = useMemo(() => {
    if (!r) return null;
    const plan = spreadResource(
      activities.filter((a) => r.activityIds.includes(a.id)),
      r.budget,
    );
    const items = plan.map((m) => ({ key: m.month, label: `${monthShort(Number(m.month.slice(5, 7)) - 1, lang)} ${m.month.slice(2, 4)}`, values: [m.planned] }));
    const busiest = plan.reduce<(typeof plan)[number] | null>((b, m) => (!b || m.planned > b.planned ? m : b), null);
    return { items, busiest };
  }, [r, activities, lang]);

  if (!r || !chart) {
    return (
      <div className="k-panel">
        <Empty
          icon={<HardHat size={20} />}
          title={t("No resources yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)} disabled={!activities.length}>
              <Plus size={15} /> {t("New resource")}
            </button>
          }
        >
          {activities.length ? t("Add a labour, plant or material resource with its budgeted quantity and the activities it works on.") : t("Add activities to the programme first, then plan the resources they need.")}
        </Empty>
        <ResourceDialog open={adding} onClose={() => setAdding(false)} onSaved={setPicked} />
      </div>
    );
  }
  const bm = chart.busiest?.month ?? null;
  const Icon = TYPE_ICON[r.type];
  const toCome = Math.max(0, r.budget - r.used);
  const unit = unitLabel(r.unit, lang);

  return (
    <div className="k-stack">
      <section className="k-panel pp-res-chart">
        <header className="pp-res-head">
          <span className="pp-res-icon">
            <Icon size={18} />
          </span>
          <div>
            <h2>
              {x(r.name)} — {t("planned month by month")}
            </h2>
            <p className="muted small">
              {t("{n} activities", { n: r.activityIds.length })}
              {bm ? ` · ${t("busiest {m}", { m: `${monthShort(Number(bm.slice(5, 7)) - 1, lang)} ${bm.slice(0, 4)}` })}` : ""} · {t("in {u}", { u: unit })}
            </p>
          </div>
          <div className="pp-res-kpis">
            <span>
              <small>{t("Budgeted")}</small>
              <b className="num-inline">{fmtNum(r.budget, 0)}</b>
            </span>
            <span>
              <small>{t("Used")}</small>
              <b className="num-inline">{fmtNum(r.used, 0)}</b>
            </span>
            <span>
              <small>{t("To come")}</small>
              <b className="num-inline k-text-brand">{fmtNum(toCome, 0)}</b>
            </span>
          </div>
        </header>
        {chart.items.length ? (
          <div className="pp-scrollx">
            <div className="pp-res-plot" style={{ minWidth: Math.max(520, chart.items.length * 38) }}>
              <StackedColumns items={chart.items} series={[{ label: t("Planned"), tone: "brand" }]} marker={TODAY.slice(0, 7)} markerLabel={t("Today")} height={220} format={(v) => `${fmtNum(v, v < 10 ? 1 : 0)} ${unit}`} picked={bm} />
            </div>
          </div>
        ) : (
          <p className="k-note">{t("Its activities are no longer in the programme. Edit the resource to pick new ones.")}</p>
        )}
        <p className="muted small">{t("The budgeted quantity is spread evenly over the months its activities run. Used is what you record.")}</p>
      </section>

      <section className="k-panel">
        <header className="k-panel-head">
          <div className="k-panel-title">
            <h2>{t("Resources")}</h2>
            <span className="k-count">{resources.length}</span>
          </div>
          <div className="k-panel-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
              <Plus size={14} /> {t("New resource")}
            </button>
          </div>
        </header>
        <div className="pp-scrollx">
          <table className="pp-table pp-res-table">
            <thead>
              <tr>
                <th>{t("ID")}</th>
                <th>{t("Resource")}</th>
                <th>{t("Type")}</th>
                <th className="r">{t("Activities")}</th>
                <th className="r">{t("Budgeted")}</th>
                <th className="r">{t("Used")}</th>
                <th className="r">{t("To come")}</th>
                <th>{t("From")}</th>
                <th>{t("To")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map((z) => {
                const sp = span(z);
                const used = z.budget > 0 ? z.used / z.budget : 0;
                return (
                  <tr key={z.id} className={`clickable${z.id === r.id ? " sel" : ""}`} onClick={() => setPicked(z.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setPicked(z.id)}>
                    <td className="k-mono">{z.code}</td>
                    <td>
                      <strong>{x(z.name)}</strong>
                      <span className="pp-usebar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, used * 100)}%` }} />
                      </span>
                    </td>
                    <td>
                      <Badge tone={z.type === "LABOUR" ? "brand" : z.type === "PLANT" ? "warn" : "neutral"} dot={false}>
                        {t(TYPE_LABEL[z.type])}
                      </Badge>
                    </td>
                    <td className="r num-inline">{z.activityIds.length}</td>
                    <td className="r num-inline">
                      {fmtNum(z.budget, 0)} <small className="muted">{unitLabel(z.unit, lang)}</small>
                    </td>
                    <td className="r num-inline">{fmtNum(z.used, 0)}</td>
                    <td className="r num-inline k-text-brand">{fmtNum(Math.max(0, z.budget - z.used), 0)}</td>
                    <td className="num-inline">{sp ? d(sp.from) : "—"}</td>
                    <td className="num-inline">{sp ? d(sp.to) : "—"}</td>
                    <td className="r" onClick={(e) => e.stopPropagation()}>
                      <Kebab
                        items={[
                          { label: t("Edit"), icon: <Pencil size={14} />, onClick: () => setEditing(z) },
                          {
                            label: t("Delete"),
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: () => {
                              removeItem("resources", z.id);
                              toast(t("{name} deleted", { name: x(z.name) }), "muted");
                            },
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <ResourceDialog open={adding || !!editing} resource={editing} onClose={() => { setAdding(false); setEditing(null); }} onSaved={setPicked} />
    </div>
  );
}

function ResourceDialog({ open, onClose, onSaved, resource }: { open: boolean; onClose: () => void; onSaved: (id: string) => void; resource?: Resource | null }) {
  const { t, x } = useL();
  const activities = useOps((s) => s.activities);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const patchItem = useOps((s) => s.patchItem);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<ResourceType>("LABOUR");
  const [unit, setUnit] = useState(UNIT_OF.LABOUR);
  const [budget, setBudget] = useState(0);
  const [used, setUsed] = useState(0);
  const [ids, setIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [seenFor, setSeenFor] = useState<string | null>(null);
  const key = open ? (resource?.id ?? "new") : null;
  if (key !== seenFor) {
    setSeenFor(key);
    if (open) {
      setName(resource ? x(resource.name) : "");
      setCode(resource?.code ?? "");
      setType(resource?.type ?? "LABOUR");
      setUnit(resource?.unit ?? UNIT_OF.LABOUR);
      setBudget(resource?.budget ?? 0);
      setUsed(resource?.used ?? 0);
      setIds(resource?.activityIds ?? []);
      setQ("");
    }
  }
  const list = activities.filter((a) => ids.includes(a.id) || (a.status !== "COMPLETED" && (!q || `${a.code} ${a.name.en} ${a.name.az}`.toLowerCase().includes(q.toLowerCase())))).slice(0, 300);
  const ok = name.trim() && budget > 0 && ids.length > 0;
  const save = () => {
    const acts = activities.filter((a) => ids.includes(a.id));
    const monthly = spreadResource(acts, budget).map((m) => ({ month: m.month, used: 0, toCome: m.planned }));
    if (resource) {
      patchItem("resources", resource.id, { code: code.trim() || resource.code, name: resource.name.en === name.trim() ? resource.name : same(name.trim()), type, unit, budget, used: Math.max(0, used), activityIds: ids, monthly });
      onSaved(resource.id);
      toast(t("{name} saved", { name: name.trim() }));
    } else {
      const id = nextRef("RS");
      addItem("resources", { id, code: code.trim() || id, name: same(name.trim()), type, unit, budget, used: Math.max(0, used), activityIds: ids, monthly }, false);
      onSaved(id);
      toast(t("{name} added on {n} activities", { name: name.trim(), n: ids.length }));
    }
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={resource ? t("Edit resource") : t("New resource")}
      kicker={t("Planning · Resources")}
      width={600}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!ok}>
            {resource ? t("Save changes") : t("Add resource")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Name")}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Tower crane 8 t")} />
        </Field>
        <Field label={t("Code")}>
          <input className="input k-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("Optional")} />
        </Field>
        <Field label={t("Type")}>
          <select
            className="input select"
            value={type}
            onChange={(e) => {
              const v = e.target.value as ResourceType;
              setType(v);
              setUnit(UNIT_OF[v]);
            }}
          >
            {(Object.keys(TYPE_LABEL) as ResourceType[]).map((k) => (
              <option key={k} value={k}>
                {t(TYPE_LABEL[k])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Unit")}>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label={t("Budgeted quantity")} hint={t("Unit: {u}", { u: unit })}>
          <input className="input" type="number" min={0} value={budget || ""} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label={t("Used so far")} hint={t("What has really been used. Leave 0 if nothing is recorded yet.")}>
          <input className="input" type="number" min={0} value={used || ""} onChange={(e) => setUsed(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <div className="k-field k-field-wide">
          <span className="k-field-label">
            {t("Activities it works on")} <span className="k-count">{ids.length}</span>
          </span>
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search ID or name")} />
          <div className="pp-pick-list">
            {list.map((a) => (
              <label key={a.id}>
                <input type="checkbox" checked={ids.includes(a.id)} onChange={() => setIds((v) => (v.includes(a.id) ? v.filter((z) => z !== a.id) : [...v, a.id]))} />
                <span className="k-mono">{a.code}</span>
                <span className="truncate">{x(a.name)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
