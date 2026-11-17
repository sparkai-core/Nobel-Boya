import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge, Dialog, Field, FilterChips, KeyVals, Panel, Register, SearchBox, StatusBadge, toast, Toolbar, useL, useSearch, type Column } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps, ME } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import { statusMeta } from "../../../ops/select";
import type { Incident } from "../../../ops/types";
import { DrawerSection, freshRef, INCIDENT_KIND, SiteBadge, siteMeta, ZONES, zoneTxt } from "./shared";

const KINDS: Incident["kind"][] = ["NEAR_MISS", "FIRST_AID", "LOST_TIME", "PROPERTY", "ENVIRONMENT"];
const SEVS: Incident["severity"][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUSES: Incident["status"][] = ["OPEN", "INVESTIGATING", "CLOSED"];

/** Severity × kind matrix: one bubble per cell sized by count; click filters the register. */
function IncidentMatrix({ items, pick, onPick }: { items: Incident[]; pick: string | null; onPick: (k: string | null) => void }) {
  const { t, x } = useL();
  const max = Math.max(1, ...SEVS.flatMap((s) => KINDS.map((k) => items.filter((i) => i.severity === s && i.kind === k).length)));
  return (
    <div className="st-grid-scroll">
      <table className="st-imatrix">
        <thead>
          <tr>
            <th />
            {KINDS.map((k) => (
              <th key={k}>{x(INCIDENT_KIND[k])}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SEVS.map((s) => {
            const meta = statusMeta("priority", s);
            return (
              <tr key={s}>
                <th scope="row">
                  <Badge tone={meta.tone}>{x(meta.label)}</Badge>
                </th>
                {KINDS.map((k) => {
                  const n = items.filter((i) => i.severity === s && i.kind === k).length;
                  const key = `${s}|${k}`;
                  const on = pick === key;
                  return (
                    <td key={k}>
                      <button type="button" className={`st-bubble k-tone-${meta.tone}${on ? " on" : ""}${n ? "" : " zero"}`} disabled={!n && !on} onClick={() => onPick(on ? null : key)} aria-pressed={on} aria-label={`${x(meta.label)} · ${x(INCIDENT_KIND[k])}: ${n}`}>
                        <i style={{ width: n ? 18 + (n / max) * 22 : 8, height: n ? 18 + (n / max) * 22 : 8 }}>{n || ""}</i>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small muted st-imatrix-note">{pick ? t("Showing one cell. Click it again to clear.") : t("Click a cell to filter the register.")}</p>
    </div>
  );
}

export function IncidentsTab({ logOpen, setLogOpen }: { logOpen: boolean; setLogOpen: (v: boolean) => void }) {
  const { t, x, d } = useL();
  const incidents = useOps((s) => s.incidents);
  const [cell, setCell] = useState<string | null>(null);
  const [status, setStatus] = useState<Incident["status"] | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const filtered = useMemo(() => incidents.filter((i) => (!status || i.status === status) && (!cell || `${i.severity}|${i.kind}` === cell)), [incidents, status, cell]);
  const rows = useSearch(filtered, q, (i) => [i.ref, i.title, i.zone, i.reportedBy, i.description]);
  const opened = incidents.find((i) => i.id === openId);

  const columns: Column<Incident>[] = [
    { key: "ref", header: t("Ref"), sort: (i) => i.ref, width: "96px", render: (i) => <span className="k-ref">{i.ref}</span> },
    {
      key: "title",
      header: t("Incident"),
      sort: (i) => x(i.title),
      render: (i) => (
        <span className="k-cell-title">
          <strong>{x(i.title)}</strong>
          <small>
            {x(i.zone)} · {d(i.date, false)}
          </small>
        </span>
      ),
    },
    { key: "kind", header: t("Kind"), sort: (i) => i.kind, hideBelow: 900, render: (i) => x(INCIDENT_KIND[i.kind]) },
    { key: "sev", header: t("Severity"), sort: (i) => SEVS.length - SEVS.indexOf(i.severity), render: (i) => <StatusBadge kind="priority" status={i.severity} /> },
    { key: "actions", header: t("Actions"), hideBelow: 820, sort: (i) => i.actions.filter((a) => !a.done).length, render: (i) => <span className="num-inline small">{t("{a} of {n} done", { a: i.actions.filter((a) => a.done).length, n: i.actions.length })}</span> },
    { key: "status", header: t("Status"), sort: (i) => STATUSES.indexOf(i.status), render: (i) => <SiteBadge kind="incident" status={i.status} /> },
  ];

  return (
    <div className="k-stack">
      <div className="k-grid-main st-inc-grid">
        <Register
          rows={rows}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={(i) => setOpenId(i.id)}
          initialSort={{ key: "ref", dir: "desc" }}
          toolbar={
            <Toolbar
              end={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setLogOpen(true)}>
                  <Plus size={14} />
                  {t("Log incident")}
                </button>
              }
            >
              <SearchBox value={q} onChange={setQ} placeholder="Search incidents" />
              <FilterChips value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: x(siteMeta("incident", s).label), count: incidents.filter((i) => i.status === s).length }))} />
            </Toolbar>
          }
          empty={
            <>
              {t("No incidents match.")}{" "}
              <button type="button" className="k-link-btn" onClick={() => { setCell(null); setStatus(null); setQ(""); }}>
                {t("Clear filters")}
              </button>
            </>
          }
        />
        <Panel title={t("Severity by kind")} icon={<Search size={15} />}>
          <IncidentMatrix items={incidents} pick={cell} onPick={setCell} />
        </Panel>
      </div>
      <Drawer open={!!opened} onClose={() => setOpenId(null)} kicker={opened ? `${opened.ref} · ${x(INCIDENT_KIND[opened.kind])}` : undefined} title={opened ? x(opened.title) : ""} width={480}>
        {opened ? <IncidentDetail i={opened} /> : null}
      </Drawer>
      {opened ? <div className="st-scrim" onClick={() => setOpenId(null)} aria-hidden="true" /> : null}
      <LogIncidentDialog open={logOpen} onClose={() => setLogOpen(false)} onLogged={(id) => setOpenId(id)} />
    </div>
  );
}

function IncidentDetail({ i }: { i: Incident }) {
  const { t, x, d, rel } = useL();
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const [draft, setDraft] = useState({ text: "", owner: "", due: addDays(TODAY, 3) });
  useEffect(() => setDraft({ text: "", owner: "", due: addDays(TODAY, 3) }), [i.id]);
  const done = i.actions.filter((a) => a.done).length;
  const link = "pm/safety?tab=incidents";

  const toggle = (k: number) => {
    const actions = i.actions.map((a, j) => (j === k ? { ...a, done: !a.done } : a));
    patchItem("incidents", i.id, { actions, status: i.status === "OPEN" ? "INVESTIGATING" : i.status });
    toast(actions[k]!.done ? t("Action marked done") : t("Action reopened"), actions[k]!.done ? "ok" : "info");
  };
  const add = () => {
    if (!draft.text.trim()) return;
    patchItem("incidents", i.id, { actions: [...i.actions, { text: same(draft.text.trim()), owner: draft.owner.trim() || ME, due: draft.due, done: false }] });
    setDraft({ text: "", owner: "", due: addDays(TODAY, 3) });
    toast(t("Action added to {ref}", { ref: i.ref }));
  };
  const investigate = () => {
    patchItem("incidents", i.id, { status: "INVESTIGATING" });
    pushFeed("PM", { en: `${i.ref} under investigation: ${i.title.en}`, az: `${i.ref} araşdırılır: ${i.title.az}` }, link);
    toast(t("{ref} is under investigation", { ref: i.ref }), "info");
  };
  const close = () => {
    if (done < i.actions.length) {
      toast(t("Finish the {n} open actions before closing.", { n: i.actions.length - done }), "warn");
      return;
    }
    patchItem("incidents", i.id, { status: "CLOSED" });
    pushFeed("PM", { en: `${i.ref} closed: ${i.title.en}`, az: `${i.ref} bağlandı: ${i.title.az}` }, link);
    toast(t("{ref} closed", { ref: i.ref }));
  };

  return (
    <div className="k-stack st-drawer">
      <div className="k-row">
        <SiteBadge kind="incident" status={i.status} />
        <StatusBadge kind="priority" status={i.severity} />
        <span className="muted small">{x(INCIDENT_KIND[i.kind])}</span>
      </div>
      <div className="k-note">{x(i.description)}</div>
      <KeyVals
        items={[
          { k: t("Date"), v: `${d(i.date)} · ${rel(i.date)}` },
          { k: t("Where"), v: x(i.zone) },
          { k: t("Reported by"), v: i.reportedBy },
          { k: t("Actions"), v: t("{a} of {n} done", { a: done, n: i.actions.length }) },
        ]}
      />
      <DrawerSection title={t("Investigation actions")}>
        <ul className="st-checks">
          {i.actions.map((a, k) => {
            const late = !a.done && a.due < TODAY;
            return (
              <li key={k} className={a.done ? "done" : undefined}>
                <button type="button" className={`st-check${a.done ? " on" : ""}`} onClick={() => toggle(k)} aria-pressed={a.done} aria-label={x(a.text)} disabled={i.status === "CLOSED"}>
                  {a.done ? <Check size={12} strokeWidth={3} /> : null}
                </button>
                <span className="k-cell-title">
                  <strong>{x(a.text)}</strong>
                  <small className={late ? "k-text-bad" : undefined}>
                    {a.owner} · {t("due")} {d(a.due, false)}
                  </small>
                </span>
              </li>
            );
          })}
          {!i.actions.length ? <li className="muted small">{t("No actions yet.")}</li> : null}
        </ul>
        {i.status !== "CLOSED" ? (
          <div className="st-addaction">
            <input className="input" value={draft.text} placeholder={t("New action, e.g. brief the crew")} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
            <input className="input" value={draft.owner} placeholder={t("Action owner")} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
            <input className="input" type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} aria-label={t("Due")} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={!draft.text.trim()}>
              <Plus size={13} />
              {t("Add")}
            </button>
          </div>
        ) : null}
      </DrawerSection>
      <div className="k-row">
        {i.status === "OPEN" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={investigate}>
            <Search size={13} />
            {t("Start investigation")}
          </button>
        ) : null}
        {i.status !== "CLOSED" ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={close}>
            <ShieldCheck size={13} />
            {t("Close incident")}
          </button>
        ) : (
          <span className="small muted">{t("This incident is closed.")}</span>
        )}
      </div>
    </div>
  );
}

const BLANK_INCIDENT = { title: "", kind: "NEAR_MISS" as Incident["kind"], severity: "MEDIUM" as Incident["severity"], zone: ZONES[0]!.key, date: TODAY, description: "", action: "" };

function LogIncidentDialog({ open, onClose, onLogged }: { open: boolean; onClose: () => void; onLogged: (id: string) => void }) {
  const { t, x } = useL();
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const [f, setF] = useState(BLANK_INCIDENT);
  useEffect(() => {
    if (open) setF(BLANK_INCIDENT);
  }, [open]);
  const save = () => {
    if (!f.title.trim()) {
      toast(t("Give the incident a short title."), "warn");
      return;
    }
    const id = freshRef(() => nextRef("INC"), (r) => useOps.getState().incidents.some((i) => i.id === r));
    const inc: Incident = {
      id,
      ref: id,
      date: f.date,
      title: same(f.title.trim()),
      kind: f.kind,
      severity: f.severity,
      zone: zoneTxt(f.zone),
      status: "OPEN",
      reportedBy: ME,
      description: same(f.description.trim() || f.title.trim()),
      actions: f.action.trim() ? [{ text: same(f.action.trim()), owner: ME, due: addDays(TODAY, 2), done: false }] : [],
    };
    addItem("incidents", inc, true);
    pushFeed("PM", { en: `${id} logged: ${f.title.trim()} (${INCIDENT_KIND[f.kind].en.toLowerCase()})`, az: `${id} qeydə alındı: ${f.title.trim()} (${INCIDENT_KIND[f.kind].az.toLowerCase()})` }, "pm/safety?tab=incidents");
    toast(t("{ref} logged", { ref: id }), f.kind === "LOST_TIME" || f.severity === "CRITICAL" ? "bad" : "ok");
    onClose();
    onLogged(id);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Log incident")}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Log incident")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("What happened")} wide>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("e.g. Unsecured ladder at grid 4")} autoFocus />
        </Field>
        <Field label={t("Kind")}>
          <select className="input select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Incident["kind"] })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {x(INCIDENT_KIND[k])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Severity")}>
          <select className="input select" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Incident["severity"] })}>
            {SEVS.map((s) => (
              <option key={s} value={s}>
                {x(statusMeta("priority", s).label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Where")}>
          <select className="input select" value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })}>
            {ZONES.map((z) => (
              <option key={z.key} value={z.key}>
                {x(z.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Date")}>
          <input className="input" type="date" value={f.date} max={TODAY} onChange={(e) => setF({ ...f, date: e.target.value || TODAY })} />
        </Field>
        <Field label={t("Description")} wide>
          <textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label={t("First action")} wide hint={t("Optional. Due in two days, owned by you.")}>
          <input className="input" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
