import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { Segmented } from "../../../components/ui";
import { useOps } from "../../../ops/store";
import { PEOPLE } from "../../../ops/seed";
import { addDays, same, TODAY } from "../../../ops/dates";
import type { Inspection, InspectionKind, Txt } from "../../../ops/types";

export const KIND_LABEL: Record<InspectionKind, string> = { WIR: "Work inspection", MIR: "Material inspection", NCR: "Non-conformance" };

const T = (en: string, az: string): Txt => ({ en, az });
export const TEMPLATES: Record<InspectionKind, Txt[]> = {
  WIR: [T("Setting out and levels", "Nişanlama və səviyyələr"), T("Bar sizes and spacing", "Armatur ölçüsü və addımı"), T("Cover spacers fitted", "Qoruyucu qat aralayıcıları qoyulub"), T("Formwork clean and tight", "Qəlib təmiz və kipdir"), T("Embedded items in place", "Gömülü hissələr yerindədir")],
  MIR: [T("Delivery note matches the order", "Qaimə sifarişə uyğundur"), T("Certificates supplied", "Sertifikatlar təqdim edilib"), T("No visible damage", "Görünən zədə yoxdur"), T("Stored as specified", "Tələbə uyğun saxlanılır")],
  NCR: [T("Cause identified", "Səbəb müəyyən edilib"), T("Corrective action agreed", "Düzəldici tədbir razılaşdırılıb"), T("Re-inspection booked", "Təkrar yoxlama təyin edilib")],
};

export const INSPECTORS = [PEOPLE.engineer, PEOPLE.qa, PEOPLE.architect, PEOPLE.site];

export type InspectionDraft = Partial<Pick<Inspection, "kind" | "title" | "activityId" | "poId" | "location" | "checklist" | "notes" | "photos" | "inspector">>;

/** "Request inspection" dialog. Also used, prefilled, to raise an NCR from a failed inspection. */
export function InspectionDialog({ open, onClose, onCreated, initial }: { open: boolean; onClose: () => void; onCreated: (id: string) => void; initial?: InspectionDraft }) {
  const { t, x, d } = useL();
  const activities = useOps((s) => s.activities);
  const pos = useOps((s) => s.pos);
  const vendors = useOps((s) => s.vendors);
  const addInspection = useOps((s) => s.addInspection);
  const [kind, setKind] = useState<InspectionKind>("WIR");
  const [title, setTitle] = useState("");
  const [activityId, setActivityId] = useState("");
  const [poId, setPoId] = useState("");
  const [location, setLocation] = useState("");
  const [inspector, setInspector] = useState(PEOPLE.engineer);
  const [when, setWhen] = useState(addDays(TODAY, 1));
  const [items, setItems] = useState<Txt[]>(TEMPLATES.WIR.slice(0, 3));
  const [newItem, setNewItem] = useState("");
  const [notes, setNotes] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    const k = initial?.kind ?? "WIR";
    setKind(k);
    setTitle(initial?.title ? x(initial.title) : "");
    setActivityId(initial?.activityId ?? "");
    setPoId(initial?.poId ?? "");
    setLocation(initial?.location ? x(initial.location) : "");
    setInspector(initial?.inspector ?? (k === "NCR" || k === "MIR" ? PEOPLE.qa : PEOPLE.engineer));
    setWhen(k === "NCR" ? TODAY : addDays(TODAY, 1));
    setItems(initial?.checklist?.map((c) => c.item) ?? TEMPLATES[k].slice(0, 3));
    setNotes(initial?.notes ? x(initial.notes) : "");
    setTried(false);
    // Reset the form each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchKind = (k: InspectionKind) => {
    setKind(k);
    setItems(TEMPLATES[k].slice(0, 3));
    setInspector(k === "WIR" ? PEOPLE.engineer : PEOPLE.qa);
    setWhen(k === "NCR" ? TODAY : addDays(TODAY, 1));
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((l) => [...l, same(newItem.trim())]);
    setNewItem("");
  };

  const submit = () => {
    setTried(true);
    if (!title.trim() || !location.trim() || !items.length) return;
    const fromNok = initial?.checklist;
    const id = addInspection({
      kind,
      title: initial?.title && x(initial.title) === title ? initial.title : same(title.trim()),
      activityId: activityId || null,
      poId: poId || null,
      location: initial?.location && x(initial.location) === location ? initial.location : same(location.trim()),
      requestedAt: when,
      inspector,
      checklist: items.map((item) => ({ item, result: fromNok?.find((c) => c.item === item)?.result ?? "NA" })),
      notes: notes.trim() ? (initial?.notes && x(initial.notes) === notes ? initial.notes : same(notes.trim())) : null,
      photos: initial?.photos ?? [],
    });
    toast(kind === "NCR" ? t("{id} raised", { id }) : t("{id} requested for {date}", { id, date: d(when) }));
    onCreated(id);
  };

  const unused = TEMPLATES[kind].filter((tp) => !items.some((i) => i.en === tp.en));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={720}
      kicker={t(KIND_LABEL[kind])}
      title={kind === "NCR" ? t("Raise a non-conformance") : t("Request inspection")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {kind === "NCR" ? t("Raise NCR") : t("Request inspection")}
          </button>
        </>
      }
    >
      <div className="k-form pmr-dlg">
        <Field label={t("Type")} wide>
          <Segmented<InspectionKind> label={t("Type")} value={kind} onChange={switchKind} options={(["WIR", "MIR", "NCR"] as InspectionKind[]).map((k) => ({ value: k, label: `${k} · ${t(KIND_LABEL[k])}` }))} />
        </Field>
        <Field label={t("Title")} wide error={tried && !title.trim() ? t("Say what is being inspected.") : undefined}>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "MIR" ? t("e.g. Roof sheeting delivery, colour and gauge") : t("e.g. Reinforcement to ground beams MR-2")} />
        </Field>
        <Field label={t("Activity")}>
          <select className="input select" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            <option value="">{t("None")}</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {x(a.name)}
              </option>
            ))}
          </select>
        </Field>
        {kind === "MIR" ? (
          <Field label={t("Purchase order")}>
            <select className="input select" value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">{t("None")}</option>
              {pos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ref} · {vendors.find((v) => v.id === p.vendorId)?.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={t("Location")} error={tried && !location.trim() ? t("Give a location.") : undefined}>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("e.g. Grid C/1–C/9")} />
          </Field>
        )}
        {kind === "MIR" ? (
          <Field label={t("Location")} error={tried && !location.trim() ? t("Give a location.") : undefined}>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("e.g. Main store")} />
          </Field>
        ) : null}
        <Field label={t("Inspector")}>
          <select className="input select" value={inspector} onChange={(e) => setInspector(e.target.value)}>
            {INSPECTORS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label={kind === "NCR" ? t("Raised on") : t("Inspection date")}>
          <input className="input" type="date" value={when} onChange={(e) => setWhen(e.target.value || when)} />
        </Field>
        <div className="k-field k-field-wide">
          <span className="k-field-label">{t("Checklist")}</span>
          <ol className="pmr-checkedit">
            {items.map((it, i) => (
              <li key={`${it.en}-${i}`}>
                <span>{x(it)}</span>
                <button type="button" className="icon-btn" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={t("Remove item")}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
          {unused.length ? (
            <div className="k-quick">
              {unused.map((tp) => (
                <button key={tp.en} type="button" onClick={() => setItems((l) => [...l, tp])}>
                  + {x(tp)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="pmr-checkadd">
            <input className="input" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} placeholder={t("Add a check…")} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={addItem} disabled={!newItem.trim()}>
              <Plus size={13} />
              {t("Add")}
            </button>
          </div>
          {tried && !items.length ? <span className="k-field-error">{t("Add at least one check.")}</span> : null}
        </div>
        {kind === "NCR" ? (
          <Field label={t("Corrective action")} wide>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("What will be done to put it right.")} />
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}
