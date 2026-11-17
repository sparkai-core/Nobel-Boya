import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { Dialog, Field, Meter, StatusBadge, toast, useL } from "../../../components/kit";
import { Drawer } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import { R } from "../../../ops/select";
import { PEOPLE } from "../../../ops/seed/pm";
import type { Activity, Constraint, ConstraintKind } from "../../../ops/types";
import { cellOf, KINDS, type Issue } from "./lookahead-model";
import { freshRef, RP } from "./shared";

export function useClearConstraint() {
  const { t } = useL();
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  return (c: { constraintId: string | null; text: { en: string; az: string } }, code: string) => {
    if (!c.constraintId) return;
    patchItem("constraints", c.constraintId, { status: "CLEARED" });
    pushFeed("PM", { en: `Constraint cleared on ${code}: ${c.text.en}`, az: `${code} üzrə məhdudiyyət aradan qaldırıldı: ${c.text.az}` }, "pm/lookahead");
    toast(t("Constraint cleared on {code}", { code }));
  };
}

/** Side panel for one activity: every constraint kind, what holds it, and the actions to clear it. */
export function ActivityDrawer({ activity, issues, onClose, onAdd }: { activity: Activity | null; issues: Issue[]; onClose: () => void; onAdd: (activityId: string) => void }) {
  const { t, x, d } = useL();
  const navigate = useNavigate();
  const clear = useClearConstraint();
  const a = activity;
  const open = issues.filter((i) => i.open).length;
  return (
    <Drawer open={!!a} onClose={onClose} kicker={a ? a.code : undefined} title={a ? x(a.name) : ""} width={460}>
      {a ? (
        <div className="k-stack pg-drawer">
          <div className="pg-drawer-top">
            <StatusBadge kind="activity" status={a.status} />
            <span className={`k-badge k-tone-${open ? "bad" : "ok"}`}>
              <i aria-hidden="true" />
              {open ? t("Constrained: {n}", { n: open }) : t("Ready")}
            </span>
            <span className="muted small">
              {d(a.start, false)} – {d(a.end, false)}
            </span>
          </div>
          <Meter value={a.pct / 100} tone={a.status === "BLOCKED" ? "bad" : "brand"} label={t("{p}% done", { p: a.pct })} />
          <ul className="pg-drawer-kinds">
            {KINDS.map((k) => {
              const cell = cellOf(issues, k.key);
              const Icon = k.icon;
              const list = issues.filter((i) => i.kind === k.key);
              return (
                <li key={k.key} className={`c-${cell}`}>
                  <span className="pg-drawer-kind">
                    <Icon size={14} />
                    <b>{t(k.label)}</b>
                    <span className="pg-cellmark">{cell === "bad" ? <X size={12} strokeWidth={3} /> : cell === "ok" ? <Check size={12} strokeWidth={3} /> : <Minus size={12} />}</span>
                  </span>
                  {list.length ? (
                    <ul>
                      {list.map((i) => (
                        <li key={i.key} className={i.open ? "open" : "clear"}>
                          <span className="pg-issue-text">
                            {x(i.text)}
                            <small className="muted">
                              {i.source === "logged" ? t("Logged") : t("Found in the records")}
                              {i.owner ? ` · ${i.owner}` : ""}
                              {i.due && i.open ? ` · ${t("due {date}", { date: d(i.due, false) })}` : ""}
                            </small>
                          </span>
                          <span className="pg-issue-actions">
                            {i.href ? (
                              <Link to={i.href} className="icon-btn" aria-label={t("Open the record")} title={t("Open the record")}>
                                <ArrowUpRight size={15} />
                              </Link>
                            ) : null}
                            {i.open && i.constraintId ? (
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => clear(i, a.code)}>
                                <Check size={13} />
                                {t("Clear")}
                              </button>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">{t("Nothing to check.")}</p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="k-row pg-drawer-actions">
            <button type="button" className="btn btn-ghost" onClick={() => onAdd(a.id)}>
              <Plus size={14} />
              {t("Add constraint")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => navigate(`${R.newRequest}?activity=${a.id}`)}>
              <ShoppingCart size={14} />
              {t("Raise MR")}
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}

const OWNERS = [PEOPLE.site, PEOPLE.buyer, PEOPLE.engineer, PEOPLE.qa, PEOPLE.planner, PEOPLE.pm];

/** Logs a new constraint against an activity. */
export function ConstraintDialog({ open, onClose, activities, initialActivity }: { open: boolean; onClose: () => void; activities: Activity[]; initialActivity: string | null }) {
  const { t, x } = useL();
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const constraints = useOps((s) => s.constraints);
  const [activityId, setActivityId] = useState("");
  const [kind, setKind] = useState<ConstraintKind>("MATERIAL");
  const [text, setText] = useState("");
  const [owner, setOwner] = useState(OWNERS[0]!);
  const [due, setDue] = useState(addDays(TODAY, 3));

  useEffect(() => {
    if (!open) return;
    setActivityId(initialActivity ?? activities[0]?.id ?? "");
    setKind("MATERIAL");
    setText("");
    setOwner(OWNERS[0]!);
    setDue(addDays(TODAY, 3));
  }, [open, initialActivity, activities]);

  const act = activities.find((a) => a.id === activityId);
  const save = () => {
    if (!act || !text.trim()) return;
    const id = freshRef("CN", (v) => constraints.some((c) => c.id === v), 3);
    const c: Constraint = { id, activityId: act.id, kind, text: same(text.trim()), status: "OPEN", owner, due, link: null };
    addItem("constraints", c);
    pushFeed("PM", { en: `Constraint logged on ${act.code}: ${text.trim()}`, az: `${act.code} üzrə məhdudiyyət qeydə alındı: ${text.trim()}` }, "pm/lookahead");
    toast(t("{id} logged on {code}", { id, code: act.code }));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Add constraint")}
      kicker={t("Look-ahead")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!act || !text.trim()} onClick={save}>
            <Plus size={14} />
            {t("Log constraint")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Activity")} wide>
          <select className="input select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Kind")} wide>
          <div className="pg-kind-pick" role="radiogroup" aria-label={t("Kind")}>
            {KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} className={kind === k.key ? "on" : undefined} onClick={() => setKind(k.key)}>
                  <Icon size={14} />
                  {t(k.label)}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={t("What is missing")} wide>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("e.g. Formwork panels not on site")} autoFocus />
        </Field>
        <Field label={t("Owner")}>
          <select className="input select" value={owner} onChange={(e) => setOwner(e.target.value)}>
            {OWNERS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Clear by")}>
          <input type="date" className="input" value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        {t("Late orders, open RFIs, inspections, permits and broken-down plant are picked up from the records by themselves.")}{" "}
        <Link to={RP.equipment}>{t("Equipment")}</Link> · <Link to={RP.safety}>{t("Safety")}</Link>
      </p>
    </Dialog>
  );
}
