import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, HardHat, Mail, Pause, Pencil, Phone, Play, Plus, Truck, Users } from "lucide-react";
import {
  Avatar,
  Dialog,
  Donut,
  Empty,
  Field,
  FilterChips,
  KeyVals,
  Meter,
  Money,
  PageHero,
  Panel,
  Register,
  SearchBox,
  StatusBadge,
  toast,
  Toolbar,
  useL,
  useSearch,
  type Column,
} from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { same } from "../../../ops/dates";
import { R, statusMeta } from "../../../ops/select";
import { fmtMoneyShort } from "../../../lib/format";
import type { Activity, Subcontractor } from "../../../ops/types";

type SubStatus = Subcontractor["status"];
const STATUSES: SubStatus[] = ["ACTIVE", "SUSPENDED", "COMPLETED"];
const live = (a: Activity) => a.status === "IN_PROGRESS" || a.status === "BLOCKED";

/** Subcontractors: crew on site against what the live programme needs, package values, and each firm's work. */
export function SubcontractorsPage() {
  const { t, x } = useL();
  const subs = useOps((s) => s.subs);
  const activities = useOps((s) => s.activities);
  const [status, setStatus] = useState<SubStatus | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const planned = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) if (live(a)) m.set(a.owner, (m.get(a.owner) ?? 0) + a.crew);
    return m;
  }, [activities]);

  const filtered = useMemo(() => subs.filter((s) => !status || s.status === status), [subs, status]);
  const rows = useSearch(filtered, q, (s) => [s.code, s.name, s.trade, s.contact, s.email]);
  const total = subs.reduce((a, s) => a + s.packageValue, 0);
  const onSite = subs.reduce((a, s) => a + s.workers, 0);
  const needed = [...planned.entries()].filter(([k]) => subs.some((s) => s.id === k)).reduce((a, [, v]) => a + v, 0);
  const crewRows = [...subs].sort((a, b) => Math.max(b.workers, planned.get(b.id) ?? 0) - Math.max(a.workers, planned.get(a.id) ?? 0));
  const crewMax = Math.max(1, ...subs.map((s) => Math.max(s.workers, planned.get(s.id) ?? 0)));

  const columns: Column<Subcontractor>[] = [
    { key: "code", header: t("Code"), sort: (s) => s.code, width: "90px", render: (s) => <span className="k-ref">{s.code}</span> },
    {
      key: "name",
      header: t("Subcontractor"),
      sort: (s) => s.name,
      render: (s) => (
        <span className="pmr-person">
          <Avatar name={s.name} size={28} />
          <span className="k-cell-title">
            <strong>{s.name}</strong>
            <small>{s.contact}</small>
          </span>
        </span>
      ),
    },
    { key: "trade", header: t("Trade"), hideBelow: 1100, render: (s) => <span className="pmr-clamp">{x(s.trade)}</span> },
    {
      key: "crew",
      header: t("Crew"),
      align: "right",
      sort: (s) => s.workers,
      render: (s) => {
        const p = planned.get(s.id) ?? 0;
        return (
          <span className="k-cell-title" style={{ justifyItems: "end" }}>
            <b className={`num-inline${p > s.workers ? " k-text-warn" : ""}`}>{s.workers}</b>
            {p ? <small>{t("{n} needed", { n: p })}</small> : null}
          </span>
        );
      },
    },
    { key: "fleet", header: t("Fleet"), align: "right", sort: (s) => s.equipment, hideBelow: 820, render: (s) => <span className="num-inline">{s.equipment}</span> },
    { key: "value", header: t("Package value"), align: "right", sort: (s) => s.packageValue, render: (s) => <Money value={s.packageValue} short /> },
    { key: "status", header: t("Status"), sort: (s) => s.status, render: (s) => <StatusBadge kind="sub" status={s.status} /> },
  ];

  const opened = openId ? subs.find((s) => s.id === openId) ?? null : null;

  return (
    <div className="k-page">
      <PageHero
        eyebrow={t("Project management · Subcontractors")}
        title={t("Subcontractors")}
        subtitle={t("The firms carrying the work packages: who is on site today against what the live programme needs, and what each package is worth.")}
        art="subs"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            {t("Add subcontractor")}
          </button>
        }
      />

      {!subs.length ? (
        <Empty
          icon={<HardHat size={22} />}
          title={t("No subcontractors yet")}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} />
              {t("Add subcontractor")}
            </button>
          }
        >
          {t("Add the firms carrying work packages: their trade, contact, crew and package value. They can then be picked as employers, permit holders and activity owners.")}
        </Empty>
      ) : (
        <>
      <section className="pmr-subs" aria-label={t("Crew and packages")}>
        <div className="pmr-crew">
          <header>
            <h2>{t("Crew on site today")}</h2>
            <p>
              <b className={onSite < needed ? "k-text-warn" : "k-text-ok"}>{onSite}</b> {t("on site against {n} needed by live activities", { n: needed })}
            </p>
          </header>
          <ul>
            {crewRows.map((s, i) => {
              const p = planned.get(s.id) ?? 0;
              const short = p > s.workers;
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => setOpenId(s.id)} className={s.status === "SUSPENDED" ? "suspended" : undefined}>
                    <span className="pmr-crew-name">
                      <b>{s.code}</b>
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="pmr-crew-track">
                      <i className={`k-grow-x ${s.status === "SUSPENDED" ? "bad" : short ? "warn" : "ok"}`} style={{ width: `${(s.workers / crewMax) * 100}%`, animationDelay: `${i * 40}ms` }} />
                      {p ? <b className="pmr-crew-need" style={{ left: `${(p / crewMax) * 100}%` }} title={t("{n} needed", { n: p })} /> : null}
                    </span>
                    <span className="pmr-crew-num num-inline">
                      {s.workers}
                      {p ? <small>/{p}</small> : null}
                      {s.equipment ? (
                        <em>
                          <Truck size={11} />
                          {s.equipment}
                        </em>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="pmr-crew-key">
            <span><i className="ok" />{t("Enough crew")}</span>
            <span><i className="warn" />{t("Short of crew")}</span>
            <span><i className="need" />{t("Needed by live activities")}</span>
          </div>
        </div>

        <div className="pmr-pack">
          <h2>{t("Package value")}</h2>
          <Donut
            size={150}
            thickness={20}
            parts={STATUSES.map((st) => ({ key: st, value: subs.filter((s) => s.status === st).reduce((a, s) => a + s.packageValue, 0), tone: st === "ACTIVE" ? "brand" : st === "SUSPENDED" ? "bad" : "muted" }))}
            center={
              <span className="pmr-pack-center">
                <b>{total ? fmtMoneyShort(total) : "—"}</b>
                <small>AZN</small>
              </span>
            }
          />
          <ul className="pmr-pack-key">
            {STATUSES.map((st) => {
              const list = subs.filter((s) => s.status === st);
              const v = list.reduce((a, s) => a + s.packageValue, 0);
              return (
                <li key={st}>
                  <button type="button" className={status === st ? "on" : undefined} onClick={() => setStatus(status === st ? null : st)}>
                    <i className={`s-${st}`} />
                    <span>{x(statusMeta("sub", st).label)}</span>
                    <b className="num-inline">{list.length}</b>
                    <em className="num-inline">{fmtMoneyShort(v)}</em>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="muted small">{total ? t("Largest package: {name}", { name: [...subs].sort((a, b) => b.packageValue - a.packageValue)[0]?.name ?? "—" }) : t("No package values entered yet.")}</p>
        </div>
      </section>

      <Register
        rows={rows}
        columns={columns}
        rowKey={(s) => s.id}
        onRowClick={(s) => setOpenId(s.id)}
        initialSort={{ key: "code", dir: "asc" }}
        rowClass={(s) => (s.status === "SUSPENDED" ? "pmr-row-late" : undefined)}
        toolbar={
          <Toolbar>
            <SearchBox value={q} onChange={setQ} placeholder="Search firms, trades, contacts" />
            <FilterChips value={status} onChange={setStatus} options={STATUSES.map((st) => ({ value: st, label: x(statusMeta("sub", st).label), count: subs.filter((s) => s.status === st).length }))} />
          </Toolbar>
        }
        empty={
          <>
            {t("No subcontractors match.")}{" "}
            <button type="button" className="k-link-btn" onClick={() => { setStatus(null); setQ(""); }}>
              {t("Clear filters")}
            </button>
          </>
        }
      />

        </>
      )}

      <Drawer open={!!opened} onClose={() => setOpenId(null)} kicker={opened?.code} title={opened?.name ?? ""} width={480}>
        {opened ? <SubDetail sub={opened} activities={activities.filter((a) => a.owner === opened.id)} needed={planned.get(opened.id) ?? 0} /> : null}
      </Drawer>
      {opened ? <div className="pmr-scrim" onClick={() => setOpenId(null)} aria-hidden="true" /> : null}

      <AddSubDialog open={adding} onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setOpenId(id); }} />
    </div>
  );
}

function SubDetail({ sub, activities, needed }: { sub: Subcontractor; activities: Activity[]; needed: number }) {
  const { t, x, d } = useL();
  const updateSub = useOps((s) => s.updateSub);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toForm(sub, x));
  useEffect(() => {
    setForm(toForm(sub, x));
    setEditing(false);
  }, [sub, x]);

  const setStatus = (status: SubStatus, msg: string) => {
    updateSub(sub.id, { status });
    toast(t(msg, { name: sub.name }), status === "SUSPENDED" ? "bad" : "ok");
  };
  const save = () => {
    updateSub(sub.id, {
      name: form.name.trim() || sub.name,
      trade: form.trade === x(sub.trade) ? sub.trade : same(form.trade),
      contact: form.contact,
      phone: form.phone,
      email: form.email,
      workers: Math.max(0, Math.round(Number(form.workers) || 0)),
      equipment: Math.max(0, Math.round(Number(form.equipment) || 0)),
      packageValue: Math.max(0, Number(form.packageValue) || 0),
    });
    setEditing(false);
    toast(t("{name} updated", { name: form.name || sub.name }));
  };
  const progress = activities.length ? activities.reduce((a, x2) => a + x2.budget * x2.pct, 0) / Math.max(1, activities.reduce((a, x2) => a + x2.budget, 0)) / 100 : 0;

  return (
    <div className="k-stack pmr-drawer">
      <div className="k-row">
        <StatusBadge kind="sub" status={sub.status} />
        <span className="muted small">{x(sub.trade)}</span>
      </div>
      {sub.notes ? <div className="k-note">{x(sub.notes)}</div> : null}

      <div className="pmr-drawer-actions">
        {sub.status === "ACTIVE" ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus("SUSPENDED", "{name} suspended")}>
              <Pause size={13} />
              {t("Suspend")}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus("COMPLETED", "{name} marked complete")}>
              <CheckCheck size={13} />
              {t("Mark complete")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus("ACTIVE", "{name} reactivated")}>
            <Play size={13} />
            {t("Reactivate")}
          </button>
        )}
        <span className="k-spacer" />
        {!editing ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={13} />
            {t("Edit")}
          </button>
        ) : null}
      </div>

      {editing ? (
        <div className="k-form">
          <Field label={t("Name")} wide>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("Trade")} wide>
            <input className="input" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
          </Field>
          <Field label={t("Contact")}>
            <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </Field>
          <Field label={t("Phone")}>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t("Email")} wide>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t("Crew on site")}>
            <input className="input num" type="number" min={0} value={form.workers} onChange={(e) => setForm({ ...form, workers: e.target.value })} />
          </Field>
          <Field label={t("Plant and vehicles")}>
            <input className="input num" type="number" min={0} value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} />
          </Field>
          <Field label={t("Package value (AZN)")} wide>
            <input className="input num" type="number" min={0} value={form.packageValue} onChange={(e) => setForm({ ...form, packageValue: e.target.value })} />
          </Field>
          <div className="k-row k-field-wide">
            <span className="k-spacer" />
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              {t("Save")}
            </button>
          </div>
        </div>
      ) : (
        <KeyVals
          items={[
            { k: t("Contact"), v: sub.contact || "—" },
            { k: t("Package value"), v: sub.packageValue ? <Money value={sub.packageValue} /> : "—" },
            { k: <Phone size={12} />, v: sub.phone ? <a href={`tel:${sub.phone.replace(/\s/g, "")}`}>{sub.phone}</a> : "—" },
            { k: <Mail size={12} />, v: sub.email ? <a href={`mailto:${sub.email}`} className="truncate">{sub.email}</a> : "—" },
            { k: <span className="k-row" style={{ gap: 4 }}><Users size={12} />{t("Crew on site")}</span>, v: <span className={needed > sub.workers ? "k-text-warn" : undefined}>{sub.workers}{needed ? ` / ${needed}` : ""}</span> },
            { k: <span className="k-row" style={{ gap: 4 }}><Truck size={12} />{t("Plant and vehicles")}</span>, v: sub.equipment },
          ]}
        />
      )}

      <Panel title={t("Activities they own")} icon={<HardHat size={15} />} count={activities.length} pad={false}>
        {activities.length ? (
          <>
            <div className="pmr-own-sum">
              <Meter value={progress} tone="brand" />
              <span className="muted small">{t("{p}% of their programme value done", { p: Math.round(progress * 100) })}</span>
            </div>
            <ul className="pmr-own">
              {activities.map((a) => (
                <li key={a.id}>
                  <Link to={R.programme(a.id)}>
                    <span className="k-ref">{a.code}</span>
                    <span className="k-cell-title">
                      <strong className="truncate">{x(a.name)}</strong>
                      <small>
                        {d(a.start, false)} – {d(a.end, false)} · {t("crew {n}", { n: a.crew })}
                      </small>
                    </span>
                    <span className="pmr-own-pct">
                      <Meter value={a.pct / 100} tone={a.status === "BLOCKED" ? "bad" : a.status === "COMPLETED" ? "ok" : "brand"} />
                      <b className="num-inline">{a.pct}%</b>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="k-panel-body muted small">{t("No programme activities are assigned to this firm.")}</p>
        )}
      </Panel>
    </div>
  );
}

function toForm(s: Subcontractor, x: (v: Subcontractor["trade"]) => string) {
  return { name: s.name, trade: x(s.trade), contact: s.contact, phone: s.phone, email: s.email, workers: String(s.workers), equipment: String(s.equipment), packageValue: String(s.packageValue) };
}

function AddSubDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const { t } = useL();
  const subs = useOps((s) => s.subs);
  const addSub = useOps((s) => s.addSub);
  const blank = { name: "", trade: "", contact: "", phone: "", email: "", workers: "0", equipment: "0", packageValue: "" };
  const [f, setF] = useState(blank);
  const [tried, setTried] = useState(false);
  const submit = () => {
    setTried(true);
    if (!f.name.trim() || !f.trade.trim()) return;
    let n = subs.length + 1;
    while (subs.some((s) => s.code === `SC-${String(n).padStart(2, "0")}`)) n++;
    const code = `SC-${String(n).padStart(2, "0")}`;
    const id = addSub({
      code,
      name: f.name.trim(),
      trade: same(f.trade.trim()),
      contact: f.contact.trim(),
      phone: f.phone.trim(),
      email: f.email.trim(),
      status: "ACTIVE",
      workers: Math.max(0, Math.round(Number(f.workers) || 0)),
      equipment: Math.max(0, Math.round(Number(f.equipment) || 0)),
      packageValue: Math.max(0, Number(f.packageValue) || 0),
      notes: null,
    });
    toast(t("{name} added as {code}", { name: f.name.trim(), code }));
    setF(blank);
    setTried(false);
    onAdded(id);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={620}
      title={t("Add subcontractor")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Add subcontractor")}
          </button>
        </>
      }
    >
      <div className="k-form pmr-dlg">
        <Field label={t("Company name")} wide error={tried && !f.name.trim() ? t("Enter the company name.") : undefined}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t("Trade")} wide error={tried && !f.trade.trim() ? t("Enter the trade.") : undefined}>
          <input className="input" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} placeholder={t("e.g. Waterproofing")} />
        </Field>
        <Field label={t("Contact")} hint={t("Optional")}>
          <input className="input" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </Field>
        <Field label={t("Phone")}>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+994 …" />
        </Field>
        <Field label={t("Email")} wide>
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label={t("Crew on site")}>
          <input className="input num" type="number" min={0} value={f.workers} onChange={(e) => setF({ ...f, workers: e.target.value })} />
        </Field>
        <Field label={t("Plant and vehicles")}>
          <input className="input num" type="number" min={0} value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} />
        </Field>
        <Field label={t("Package value (AZN)")} wide>
          <input className="input num" type="number" min={0} value={f.packageValue} onChange={(e) => setF({ ...f, packageValue: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
