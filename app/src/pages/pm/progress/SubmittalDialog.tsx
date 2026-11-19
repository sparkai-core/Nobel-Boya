import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Send } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import { me } from "../../../ops/people";
import type { Submittal } from "../../../ops/types";
import { freshRef } from "./shared";

/** New submittal: what is submitted, for which activity, and how long the supplier needs once approved. */
export function SubmittalDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const materials = useOps((s) => s.materials);
  const submittals = useOps((s) => s.submittals);
  const vendors = useOps((s) => s.vendors);
  const addItem = useOps((s) => s.addItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const upcoming = useMemo(() => activities.filter((a) => a.status !== "COMPLETED" && !a.isMilestone).sort((a, b) => a.start.localeCompare(b.start)), [activities]);
  const [title, setTitle] = useState("");
  const [spec, setSpec] = useState("");
  const [maker, setMaker] = useState("");
  const [activityId, setActivityId] = useState("");
  const [material, setMaterial] = useState("");
  const [lead, setLead] = useState(14);
  const [submitBy, setSubmitBy] = useState(addDays(TODAY, 7));
  const [reviewer, setReviewer] = useState("");
  const [needed, setNeeded] = useState(addDays(TODAY, 30));

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setSpec("");
    setMaker("");
    setActivityId(upcoming.find((a) => a.start > TODAY)?.id ?? upcoming[0]?.id ?? "");
    setMaterial("");
    setLead(14);
    setSubmitBy(addDays(TODAY, 7));
    setReviewer(me());
    setNeeded(addDays(TODAY, 30));
  }, [open, upcoming]);

  const act = activities.find((a) => a.id === activityId);
  const required = act ? act.start : needed;
  const finalDue = required ? addDays(required, -lead) : null;
  const tight = finalDue != null && finalDue < submitBy;
  const valid = !!title.trim() && !!required && lead >= 0 && !!reviewer.trim();

  const create = (submit: boolean) => {
    if (!valid) return;
    const who = reviewer.trim() || me();
    const id = freshRef("SUB", (v) => submittals.some((s) => s.id === v));
    const sub: Submittal = { id, ref: id, title: same(title.trim()), spec: spec.trim() || "—", manufacturer: maker.trim() || "—", rev: 0, submitBy, requiredOnSite: required, leadDays: lead, status: submit ? "SUBMITTED" : "DRAFT", activityId: act?.id ?? null, material: material || null, reviewer: who, mrId: null, sheetId: null, comments: null };
    addItem("submittals", sub);
    pushFeed("PM", { en: `${id} ${submit ? "submitted" : "drafted"}: ${title.trim()}`, az: `${id} ${submit ? "göndərildi" : "qaralama yaradıldı"}: ${title.trim()}` }, `pm/submittals/${id}`);
    toast(submit ? t("{id} submitted to {who}", { id, who }) : t("{id} saved as a draft", { id }));
    onCreated(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={600}
      kicker={t("Submittals")}
      title={t("New submittal")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-ghost" disabled={!valid} onClick={() => create(false)}>
            <FilePlus2 size={14} />
            {t("Save draft")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => create(true)}>
            <Send size={14} />
            {t("Submit for review")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Title")} wide>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Roller shutter shop drawings")} autoFocus />
        </Field>
        <Field label={t("Spec section")}>
          <input className="input" value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="08 33 23" />
        </Field>
        <Field label={t("Manufacturer")}>
          <input className="input" list="pg-sub-makers" value={maker} onChange={(e) => setMaker(e.target.value)} placeholder={t("Supplier or maker")} />
          <datalist id="pg-sub-makers">
            {vendors.map((v) => (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
        </Field>
        <Field label={t("For activity")} wide hint={act ? t("Required on site {date} (activity start)", { date: d(act.start) }) : t("Not tied to a programme activity: enter the date it is needed on site.")}>
          <select className="input select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">{t("No activity")}</option>
            {upcoming.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)} · {d(a.start, false)}
              </option>
            ))}
          </select>
        </Field>
        {!act ? (
          <Field label={t("Required on site")}>
            <input type="date" className="input" value={needed} onChange={(e) => setNeeded(e.target.value || TODAY)} />
          </Field>
        ) : null}
        <Field label={t("Material")} wide>
          <select className="input select" value={material} onChange={(e) => setMaterial(e.target.value)}>
            <option value="">{t("None")}</option>
            {materials.map((m) => (
              <option key={m.key} value={m.key}>
                {x(m.name)} ({m.unit})
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Lead time (days)")} hint={finalDue ? t("Final due {date}", { date: d(finalDue) }) : undefined} error={tight ? t("Submit by is after the final due date.") : undefined}>
          <input type="number" className="input" min={0} value={lead} onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label={t("Submit by")}>
          <input type="date" className="input" value={submitBy} onChange={(e) => setSubmitBy(e.target.value || TODAY)} />
        </Field>
        <Field label={t("Reviewer")} wide hint={t("Who approves it, e.g. the designer or the client's engineer.")}>
          <input className="input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
