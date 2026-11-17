import { useState } from "react";
import { Clock, Coins } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps, ME } from "../../../ops/store";
import { addDays, same, TODAY } from "../../../ops/dates";
import { statusMeta } from "../../../ops/select";
import { disciplineName } from "../../../lib/loc";
import type { Priority } from "../../../ops/types";
import { DISCIPLINE_KEYS, SheetPicker } from "./shared";

/** "New RFI" dialog: question, the drawing it is about, the activity it holds up, and its impact. */
export function RfiDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, x, lang } = useL();
  const activities = useOps((s) => s.activities);
  const raiseRfi = useOps((s) => s.raiseRfi);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [discipline, setDiscipline] = useState("struct");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueAt, setDueAt] = useState(addDays(TODAY, 7));
  const [cost, setCost] = useState(false);
  const [time, setTime] = useState(false);
  const [tried, setTried] = useState(false);

  const reset = () => {
    setSubject("");
    setQuestion("");
    setSheetId(null);
    setActivityId("");
    setPriority("MEDIUM");
    setDueAt(addDays(TODAY, 7));
    setCost(false);
    setTime(false);
    setTried(false);
  };

  const submit = () => {
    setTried(true);
    if (!subject.trim() || !question.trim()) return;
    const id = raiseRfi({
      subject: same(subject.trim()),
      question: same(question.trim()),
      discipline,
      sheetId,
      activityId: activityId || null,
      raisedBy: ME,
      dueAt,
      priority,
      costImpact: cost,
      timeImpact: time,
    });
    toast(t("{id} raised and sent to the designer", { id }));
    reset();
    onCreated(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={720}
      kicker={t("Request for information")}
      title={t("New RFI")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Raise RFI")}
          </button>
        </>
      }
    >
      <div className="k-form pmr-dlg">
        <Field label={t("Subject")} wide error={tried && !subject.trim() ? t("Give the RFI a subject.") : undefined}>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("e.g. Truss bearing detail at grid C")} />
        </Field>
        <Field label={t("Question to the designer")} wide error={tried && !question.trim() ? t("Write the question.") : undefined}>
          <textarea className="input" rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("What is unclear, where, and what you need to proceed.")} />
        </Field>
        <Field label={t("Discipline")}>
          <select className="input select" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
            {DISCIPLINE_KEYS.map((k) => (
              <option key={k} value={k}>
                {disciplineName(k, lang)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Holds up activity")}>
          <select className="input select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">{t("None")}</option>
            {activities
              .filter((a) => a.status !== "COMPLETED")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {x(a.name)}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t("Drawing sheet")} wide hint={t("The sheet the question is about. It shows next to the question.")}>
          <SheetPicker value={sheetId} onChange={setSheetId} discipline={discipline} />
        </Field>
        <Field label={t("Priority")}>
          <select className="input select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Priority[]).map((p) => (
              <option key={p} value={p}>
                {x(statusMeta("priority", p).label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Answer needed by")}>
          <input className="input" type="date" value={dueAt} min={TODAY} onChange={(e) => setDueAt(e.target.value || dueAt)} />
        </Field>
        <Field label={t("Likely impact")} wide>
          <div className="pmr-toggles">
            <button type="button" className={`pmr-toggle${cost ? " on cost" : ""}`} aria-pressed={cost} onClick={() => setCost((v) => !v)}>
              <Coins size={15} />
              {t("Cost")}
            </button>
            <button type="button" className={`pmr-toggle${time ? " on time" : ""}`} aria-pressed={time} onClick={() => setTime((v) => !v)}>
              <Clock size={15} />
              {t("Time")}
            </button>
          </div>
        </Field>
      </div>
    </Dialog>
  );
}
