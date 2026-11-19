import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { data } from "../../../data";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import { addWorkingDays, countWorkingDays, createActivity, deleteActivity, suggestCode, updateActivityDetails, wbsOptions, type PredInput } from "../../../ops/ext/planning-client";
import type { Activity, LinkType } from "../../../ops/types";
import { LINK_WORDS } from "./model";

const LINK_TYPES: LinkType[] = ["FS", "SS", "FF", "SF"];

/**
 * Add or edit an activity by hand: ID, name, WBS item, building, BOQ section, start, duration in
 * working days (or a finish date), predecessors with type and lag, and the milestone switch.
 * In edit mode the activity can also be deleted (with its links).
 */
export function ActivityDialog({ open, onClose, activity, onSaved, defaultWbs }: { open: boolean; onClose: () => void; activity?: Activity | null; onSaved?: (id: string) => void; defaultWbs?: string }) {
  const { t, x, d, lang } = useL();
  const activities = useOps((s) => s.activities);
  const links = useOps((s) => s.links);
  const wbs = useOps((s) => s.wbs);
  const workweek = useOps((s) => s.workweek);
  const calendar = useOps((s) => s.calendar);
  const wbsList = useMemo(() => wbsOptions(wbs), [wbs]);
  const editing = !!activity;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [wbsId, setWbsId] = useState("");
  const [building, setBuilding] = useState("");
  const [section, setSection] = useState("");
  const [milestone, setMilestone] = useState(false);
  const [start, setStart] = useState(TODAY);
  const [by, setBy] = useState<"days" | "end">("days");
  const [days, setDays] = useState(5);
  const [end, setEnd] = useState(TODAY);
  const [owner, setOwner] = useState("");
  const [crew, setCrew] = useState(0);
  const [budget, setBudget] = useState(0);
  const [preds, setPreds] = useState<PredInput[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setTried(false);
    if (activity) {
      setCode(activity.code);
      setName(x(activity.name));
      setWbsId(activity.wbsId);
      setBuilding(activity.building);
      setSection(activity.section ?? "");
      setMilestone(activity.isMilestone);
      setStart(activity.start);
      setEnd(activity.end);
      setDays(countWorkingDays(activity.start, activity.end, workweek, calendar));
      setBy("end");
      setOwner(activity.owner);
      setCrew(activity.crew);
      setBudget(activity.budget);
      setPreds(links.filter((l) => l.to === activity.id).map((l) => ({ from: l.from, type: l.type, lag: l.lag })));
    } else {
      const firstWork = defaultWbs ?? wbsList.find((o) => o.depth > 0)?.node.id ?? wbsList[0]?.node.id ?? "";
      setCode(suggestCode(activities));
      setName("");
      setWbsId(firstWork);
      setBuilding(wbs.find((w) => w.id === firstWork)?.building ?? "");
      setSection("");
      setMilestone(false);
      setStart(TODAY);
      setBy("days");
      setDays(5);
      setEnd(addWorkingDays(TODAY, 5, workweek, calendar));
      setOwner("");
      setCrew(0);
      setBudget(0);
      setPreds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.id]);

  const finish = milestone ? start : by === "days" ? addWorkingDays(start, Math.max(0, Math.round(days)), workweek, calendar) : end;
  const codeTaken = activities.some((a) => a.code.trim().toLowerCase() === code.trim().toLowerCase() && a.id !== activity?.id);

  // A predecessor that already follows this activity would close a loop.
  const downstream = useMemo(() => {
    const out = new Set<string>();
    if (!activity) return out;
    const stack = [activity.id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const l of links) if (l.from === cur && !out.has(l.to)) {
        out.add(l.to);
        stack.push(l.to);
      }
    }
    return out;
  }, [activity, links]);
  const loopPred = preds.find((p) => p.from && downstream.has(p.from));

  const errors = {
    code: !code.trim() ? t("Give the activity an ID.") : codeTaken ? t("Another activity already has this ID.") : null,
    name: !name.trim() ? t("Give the activity a name.") : null,
    start: !/^\d{4}-\d{2}-\d{2}$/.test(start) ? t("Pick a start date.") : null,
    end: !milestone && by === "end" && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) ? t("The finish cannot be before the start.") : null,
    preds: loopPred ? t("{code} already comes after this activity: linking it before would close a loop.", { code: activities.find((a) => a.id === loopPred.from)?.code ?? "" }) : null,
  };
  const ok = !Object.values(errors).some(Boolean);

  const save = () => {
    setTried(true);
    if (!ok) return;
    const input = { code, name, wbsId, building, section: section || null, start, end: finish, isMilestone: milestone, owner, crew, budget, preds: preds.filter((p) => p.from) };
    if (activity) {
      updateActivityDetails(activity.id, input);
      toast(t("{code} saved", { code: code.trim() }));
      onSaved?.(activity.id);
    } else {
      const id = createActivity(input);
      toast(t("{code} added to the programme", { code: code.trim() }));
      onSaved?.(id);
    }
    onClose();
  };

  const remove = () => {
    if (!activity) return;
    deleteActivity(activity.id);
    toast(t("{code} deleted", { code: activity.code }), "muted");
    onClose();
  };

  const linkCount = activity ? links.filter((l) => l.from === activity.id || l.to === activity.id).length : 0;
  const options = activities.filter((a) => a.id !== activity?.id).sort((a, b) => a.code.localeCompare(b.code));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={680}
      kicker={t("Programme · Activity")}
      title={editing ? t("Edit {code}", { code: activity!.code }) : t("Add an activity")}
      footer={
        confirmDelete ? (
          <>
            <span className="small k-text-bad pp-foot-note">{t("Delete {code} and its {n} links? This cannot be undone.", { code: activity?.code ?? "", n: linkCount })}</span>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              {t("Keep it")}
            </button>
            <button type="button" className="btn pp-danger" onClick={remove}>
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
              {editing ? t("Save changes") : t("Add activity")}
            </button>
          </>
        )
      }
    >
      <div className="k-form">
        <Field label={t("Activity ID")} error={tried ? errors.code : null}>
          <input className="input k-mono" value={code} onChange={(e) => setCode(e.target.value)} autoFocus={!editing} />
        </Field>
        <Field label={t("Activity name")} error={tried ? errors.name : null}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Pour ground-floor slab")} />
        </Field>
        <Field label={t("WBS item")} hint={!wbsList.length ? t("No WBS yet: add items on the WBS page, or import a programme.") : undefined}>
          <select
            className="input select"
            value={wbsId}
            onChange={(e) => {
              setWbsId(e.target.value);
              const b = wbs.find((w) => w.id === e.target.value)?.building;
              if (b && !building) setBuilding(b);
            }}
          >
            <option value="">{t("No WBS item")}</option>
            {wbsList.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {"  ".repeat(depth)}
                {node.code} · {x(node.name)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Building")}>
          <select className="input select" value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">{t("None")}</option>
            {(data.buildings ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {lang === "az" ? b.az : b.en}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("BOQ section (optional)")}>
          <select className="input select" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">{t("None")}</option>
            {(data.sections ?? []).map((sec) => (
              <option key={sec.id} value={sec.id}>
                {lang === "az" ? sec.az : sec.en}
              </option>
            ))}
          </select>
        </Field>
        <label className="k-field">
          <span className="k-field-label">{t("Type")}</span>
          <span className="pp-check-row">
            <input type="checkbox" checked={milestone} onChange={(e) => setMilestone(e.target.checked)} />
            <span>{t("Milestone (a single date, no duration)")}</span>
          </span>
        </label>
        <Field label={milestone ? t("Date") : t("Start")} error={tried ? errors.start : null}>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        {!milestone ? (
          <div className="k-field">
            <span className="k-field-label">{t("Length")}</span>
            <Segmented
              label={t("Length")}
              value={by}
              onChange={(v) => {
                if (v === "end") setEnd(finish);
                else setDays(countWorkingDays(start, end, workweek, calendar));
                setBy(v);
              }}
              options={[
                { value: "days", label: t("Working days") },
                { value: "end", label: t("Finish date") },
              ]}
            />
          </div>
        ) : null}
        {!milestone && by === "days" ? (
          <Field label={t("Working days")} hint={t("Finishes {date} on the project calendar.", { date: d(finish) })}>
            <input className="input" type="number" min={0} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        ) : null}
        {!milestone && by === "end" ? (
          <Field label={t("Finish")} error={tried ? errors.end : null} hint={!errors.end ? t("{n} working days", { n: countWorkingDays(start, end, workweek, calendar) }) : undefined}>
            <input className="input" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        ) : null}
        <Field label={t("Owner (optional)")}>
          <input className="input" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={t("Crew or subcontractor")} />
        </Field>
        <Field label={t("Crew size (optional)")}>
          <input className="input" type="number" min={0} value={crew || ""} onChange={(e) => setCrew(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label={t("Budget, AZN (optional)")} hint={t("Progress is weighted by budget only when every activity has one; otherwise by duration.")}>
          <input className="input" type="number" min={0} value={budget || ""} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} />
        </Field>

        <div className="k-field k-field-wide">
          <span className="k-field-label">
            {t("Predecessors")} <span className="k-count">{preds.length}</span>
          </span>
          {preds.map((p, i) => (
            <div key={i} className="pp-addpred-row">
              <select className="input select" value={p.from} onChange={(e) => setPreds((v) => v.map((z, j) => (j === i ? { ...z, from: e.target.value } : z)))} aria-label={t("Predecessor")}>
                <option value="">{t("Choose an activity")}</option>
                {options.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} · {x(z.name)}
                  </option>
                ))}
              </select>
              <select className="input select" value={p.type} onChange={(e) => setPreds((v) => v.map((z, j) => (j === i ? { ...z, type: e.target.value as LinkType } : z)))} aria-label={t("Link")}>
                {LINK_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {k} · {t(LINK_WORDS[k])}
                  </option>
                ))}
              </select>
              <input className="input pp-lag" type="number" value={p.lag} onChange={(e) => setPreds((v) => v.map((z, j) => (j === i ? { ...z, lag: Math.round(Number(e.target.value) || 0) } : z)))} aria-label={t("Lag, days")} title={t("Lag, days")} />
              <button type="button" className="icon-btn" aria-label={t("Remove link")} onClick={() => setPreds((v) => v.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {errors.preds ? <span className="k-field-error">{errors.preds}</span> : null}
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreds((v) => [...v, { from: "", type: "FS", lag: 0 }])} disabled={!options.length}>
              <Plus size={14} /> {t("Add a predecessor")}
            </button>
            {!options.length ? <span className="muted small"> {t("Add more activities to link them.")}</span> : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
