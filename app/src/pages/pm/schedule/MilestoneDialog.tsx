import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { createMilestone, deleteMilestone, updateMilestone } from "../../../ops/ext/planning-client";
import type { Milestone } from "../../../ops/types";

/**
 * Add or edit a milestone: name, target date, an optional payment tied to it, the activities that
 * drive its date (optional) and, once reached, the date it was reached.
 */
export function MilestoneDialog({ open, onClose, milestone, onSaved }: { open: boolean; onClose: () => void; milestone?: Milestone | null; onSaved?: (id: string) => void }) {
  const { t, x } = useL();
  const milestones = useOps((s) => s.milestones);
  const activities = useOps((s) => s.activities);
  const editing = !!milestone;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState(TODAY);
  const [payment, setPayment] = useState(0);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [reached, setReached] = useState(false);
  const [actual, setActual] = useState(TODAY);
  const [q, setQ] = useState("");
  const [tried, setTried] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    setConfirmDelete(false);
    setQ("");
    if (milestone) {
      setCode(milestone.code);
      setName(x(milestone.name));
      setTarget(milestone.target);
      setPayment(milestone.payment ?? 0);
      setDrivers(milestone.drivers);
      setReached(!!milestone.actual);
      setActual(milestone.actual ?? TODAY);
    } else {
      const n = milestones.reduce((m, z) => Math.max(m, Number(/(\d+)$/.exec(z.code)?.[1] ?? 0)), 0) + 1;
      setCode(`MS-${String(n).padStart(2, "0")}`);
      setName("");
      setTarget(TODAY);
      setPayment(0);
      setDrivers([]);
      setReached(false);
      setActual(TODAY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return activities.filter((a) => drivers.includes(a.id) || !needle || `${a.code} ${a.name.en} ${a.name.az}`.toLowerCase().includes(needle)).slice(0, 200);
  }, [activities, q, drivers]);

  const errors = {
    name: !name.trim() ? t("Give the milestone a name.") : null,
    target: !/^\d{4}-\d{2}-\d{2}$/.test(target) ? t("Pick a target date.") : null,
    actual: reached && !/^\d{4}-\d{2}-\d{2}$/.test(actual) ? t("Pick the date it was reached.") : null,
  };
  const ok = !Object.values(errors).some(Boolean);

  const save = () => {
    setTried(true);
    if (!ok) return;
    const input = { code, name, target, payment: payment > 0 ? payment : null, drivers, actual: reached ? actual : null };
    if (milestone) {
      updateMilestone(milestone.id, input);
      toast(t("Milestone saved"));
      onSaved?.(milestone.id);
    } else {
      const id = createMilestone(input);
      toast(t("Milestone added"));
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={600}
      kicker={t("Programme · Milestone")}
      title={editing ? t("Edit milestone") : t("Add a milestone")}
      footer={
        confirmDelete ? (
          <>
            <span className="small k-text-bad pp-foot-note">{t("Delete this milestone? This cannot be undone.")}</span>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              {t("Keep it")}
            </button>
            <button
              type="button"
              className="btn pp-danger"
              onClick={() => {
                if (milestone) deleteMilestone(milestone.id);
                toast(t("Milestone deleted"), "muted");
                onClose();
              }}
            >
              <Trash2 size={15} /> {t("Delete")}
            </button>
          </>
        ) : (
          <>
            {editing ? (
              <button type="button" className="btn btn-ghost k-text-bad pp-foot-left" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> {t("Delete")}
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={tried && !ok}>
              {editing ? t("Save changes") : t("Add milestone")}
            </button>
          </>
        )
      }
    >
      <div className="k-form">
        <Field label={t("Code")}>
          <input className="input k-mono" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label={t("Name")} error={tried ? errors.name : null}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Roof watertight")} autoFocus={!editing} />
        </Field>
        <Field label={t("Target date")} error={tried ? errors.target : null}>
          <input className="input" type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label={t("Payment tied to it, AZN (optional)")}>
          <input className="input" type="number" min={0} value={payment || ""} onChange={(e) => setPayment(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <label className="k-field">
          <span className="k-field-label">{t("Reached")}</span>
          <span className="pp-check-row">
            <input type="checkbox" checked={reached} onChange={(e) => setReached(e.target.checked)} />
            <span>{t("This milestone has been reached")}</span>
          </span>
        </label>
        {reached ? (
          <Field label={t("Reached on")} error={tried ? errors.actual : null}>
            <input className="input" type="date" value={actual} onChange={(e) => setActual(e.target.value)} />
          </Field>
        ) : null}
        <div className="k-field k-field-wide">
          <span className="k-field-label">
            {t("Activities that drive the date (optional)")} <span className="k-count">{drivers.length}</span>
          </span>
          {activities.length ? (
            <>
              <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search ID or name")} />
              <div className="pp-pick-list">
                {list.map((a) => (
                  <label key={a.id}>
                    <input type="checkbox" checked={drivers.includes(a.id)} onChange={() => setDrivers((v) => (v.includes(a.id) ? v.filter((z) => z !== a.id) : [...v, a.id]))} />
                    <span className="k-mono">{a.code}</span>
                    <span className="truncate">{x(a.name)}</span>
                  </label>
                ))}
              </div>
              <span className="k-field-hint">{t("With drivers, the forecast follows their finish. Without, it is the target until that date passes.")}</span>
            </>
          ) : (
            <span className="k-field-hint">{t("No activities yet. The milestone keeps its target date until you link activities to it.")}</span>
          )}
        </div>
      </div>
    </Dialog>
  );
}
