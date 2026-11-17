import { useState } from "react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { same } from "../../../ops/dates";
import type { ChangeOrder } from "../../../ops/types";
import { ChangeLines, type ChangeLine } from "./ChangeLines";

export const REASONS: { value: ChangeOrder["reason"]; label: string }[] = [
  { value: "CLIENT", label: "Client request" },
  { value: "DESIGN", label: "Design change" },
  { value: "SITE", label: "Site condition" },
  { value: "RFI", label: "From an RFI" },
];
export const reasonLabel = (r: ChangeOrder["reason"]) => REASONS.find((x) => x.value === r)?.label ?? r;

/** New change / variation: title, reason, programme days and priced lines. */
export function ChangeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t, x } = useL();
  const rfis = useOps((s) => s.rfis);
  const raiseChange = useOps((s) => s.raiseChange);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState<ChangeOrder["reason"]>("CLIENT");
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(0);
  const [rfiId, setRfiId] = useState("");
  const [lines, setLines] = useState<ChangeLine[]>([]);
  const [tried, setTried] = useState(false);

  const submit = () => {
    setTried(true);
    if (!title.trim() || !lines.length) return;
    const id = raiseChange({
      title: same(title.trim()),
      reason,
      description: same(description.trim() || title.trim()),
      daysDelta: days,
      rfiId: rfiId || null,
      lines: lines.map((l) => ({ ...l, description: x(l.description) ? l.description : same(t("Unnamed line")) })),
    });
    toast(t("{id} raised as a draft", { id }));
    setTitle("");
    setDescription("");
    setDays(0);
    setRfiId("");
    setLines([]);
    setTried(false);
    onCreated(id);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={860}
      kicker={t("Change / variation")}
      title={t("New change")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t("Raise change")}
          </button>
        </>
      }
    >
      <div className="k-form pmr-dlg">
        <Field label={t("Title")} wide error={tried && !title.trim() ? t("Give the change a title.") : undefined}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("e.g. Extra floor drain in the plant room")} />
        </Field>
        <Field label={t("Reason")}>
          <select className="input select" value={reason} onChange={(e) => setReason(e.target.value as ChangeOrder["reason"])}>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Linked RFI")}>
          <select className="input select" value={rfiId} onChange={(e) => { setRfiId(e.target.value); if (e.target.value) setReason("RFI"); }}>
            <option value="">{t("None")}</option>
            {rfis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ref} · {x(r.subject)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Description")} wide>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("What changes and why.")} />
        </Field>
        <Field label={t("Programme days")} hint={t("Extra days claimed. Use a negative number for time saved.")}>
          <input className="input num" type="number" step={1} value={days} onChange={(e) => setDays(Math.round(Number(e.target.value) || 0))} />
        </Field>
        <div className="k-field-wide">
          <span className="k-field-label">{t("Priced lines")}</span>
          <ChangeLines lines={lines} onChange={setLines} editable />
          {tried && !lines.length ? <span className="k-field-error">{t("Add at least one line.")}</span> : null}
        </div>
      </div>
    </Dialog>
  );
}
