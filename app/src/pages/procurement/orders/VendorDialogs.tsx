import { useState } from "react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { TODAY } from "../../../ops/dates";
import type { Vendor } from "../../../ops/types";

const TERMS = ["15 days", "30 days", "45 days", "60 days", "On delivery", "Monthly in advance"];
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Edit the vendor's register details (a vendor approved from onboarding starts with only a name and contact). */
export function EditVendorDialog({ open, onClose, vendor }: { open: boolean; onClose: () => void; vendor: Vendor }) {
  const { t } = useL();
  const updateVendor = useOps((s) => s.updateVendor);
  const init = () => ({ name: vendor.name, city: vendor.city, trn: vendor.trn, licence: vendor.licence ?? "", contact: vendor.contact, email: vendor.email, phone: vendor.phone, website: vendor.website ?? "", paymentTerms: vendor.paymentTerms });
  const [f, setF] = useState(init);
  const [seen, setSeen] = useState(false);
  const [tried, setTried] = useState(false);
  if (open && !seen) {
    setSeen(true);
    setTried(false);
    setF(init());
  }
  if (!open && seen) setSeen(false);
  const set = (k: keyof ReturnType<typeof init>, v: string) => setF((o) => ({ ...o, [k]: v }));
  const errors = {
    name: !f.name.trim() ? t("Required") : undefined,
    trn: f.trn.trim() && !/^\d{10}$/.test(f.trn.trim()) ? t("TRN is 10 digits") : undefined,
    email: f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? t("Check the email address") : undefined,
  };
  const valid = !errors.name && !errors.trn && !errors.email;
  const save = () => {
    setTried(true);
    if (!valid) return;
    const licence = f.licence.trim() || null;
    updateVendor(vendor.id, {
      name: f.name.trim(),
      city: f.city.trim(),
      trn: f.trn.trim(),
      licence,
      contact: f.contact.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      website: f.website.trim() || null,
      paymentTerms: f.paymentTerms,
      risk: !licence ? "HIGH" : vendor.risk === "HIGH" ? "MEDIUM" : vendor.risk,
    });
    toast(t("Vendor details saved."));
    onClose();
  };
  const terms = TERMS.includes(f.paymentTerms) ? TERMS : [f.paymentTerms, ...TERMS];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Edit vendor details")}
      width={620}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t("Save")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Vendor name")} wide error={tried ? errors.name : undefined}>
          <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("City")}>
          <input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label={t("TRN")} error={tried ? errors.trn : undefined} hint={t("Tax registration number, 10 digits")}>
          <input className="input k-mono" inputMode="numeric" maxLength={10} value={f.trn} onChange={(e) => set("trn", e.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("Trade licence number")} hint={!f.licence.trim() ? t("Without a licence the vendor is marked high risk.") : undefined}>
          <input className="input k-mono" value={f.licence} onChange={(e) => set("licence", e.target.value)} />
        </Field>
        <Field label={t("Contact person")}>
          <input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
        </Field>
        <Field label={t("Email")} error={tried ? errors.email : undefined}>
          <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label={t("Phone")}>
          <input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t("Website")}>
          <input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label={t("Payment terms")}>
          <select className="input select" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}>
            {terms.map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Dialog>
  );
}

/** The buyer scores a vendor (0–100 per part); the overall score out of 10 follows from it. */
export function ScoreDialog({ open, onClose, vendor }: { open: boolean; onClose: () => void; vendor: Vendor }) {
  const { t } = useL();
  const updateVendor = useOps((s) => s.updateVendor);
  const init = () => ({
    reliability: vendor.overall > 0 ? String(vendor.scores.reliability) : "",
    quality: vendor.overall > 0 ? String(vendor.scores.quality) : "",
    price: vendor.overall > 0 ? String(vendor.scores.price) : "",
    delivery: vendor.overall > 0 ? String(vendor.scores.delivery) : "",
    days: vendor.avgDeliveryDays > 0 ? String(vendor.avgDeliveryDays) : "",
  });
  const [f, setF] = useState(init);
  const [seen, setSeen] = useState(false);
  if (open && !seen) {
    setSeen(true);
    setF(init());
  }
  if (!open && seen) setSeen(false);
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() !== "" && Number.isFinite(x) && x >= 0 && x <= 100 ? Math.round(x) : null;
  };
  const parts = (["reliability", "quality", "price", "delivery"] as const).map((k) => ({ k, v: n(f[k]) }));
  const valid = parts.every((p) => p.v != null);
  const days = Number(f.days);
  const save = () => {
    if (!valid) return;
    const sc = { reliability: parts[0]!.v!, quality: parts[1]!.v!, price: parts[2]!.v!, delivery: parts[3]!.v! };
    updateVendor(vendor.id, { scores: sc, overall: round1((sc.reliability * 0.3 + sc.quality * 0.3 + sc.price * 0.2 + sc.delivery * 0.2) / 10), avgDeliveryDays: Number.isFinite(days) && days > 0 ? Math.round(days) : vendor.avgDeliveryDays });
    toast(t("Scores saved."));
    onClose();
  };
  const label: Record<(typeof parts)[number]["k"], string> = { reliability: t("Reliability"), quality: t("Quality"), price: t("Price"), delivery: t("Delivery") };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Score this vendor")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {t("Save scores")}
          </button>
        </>
      }
    >
      <p className="muted small">{t("Your own judgement, 0 to 100 for each part. The overall score out of 10 weighs reliability and quality most.")}</p>
      <div className="k-form">
        {parts.map((p) => (
          <Field key={p.k} label={label[p.k]}>
            <input className="input num" inputMode="numeric" value={f[p.k]} onChange={(e) => setF((o) => ({ ...o, [p.k]: e.target.value }))} placeholder="0–100" />
          </Field>
        ))}
        <Field label={t("Usual delivery time, days")} hint={t("Optional.")}>
          <input className="input num" inputMode="numeric" value={f.days} onChange={(e) => setF((o) => ({ ...o, days: e.target.value }))} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Record one of the vendor's past projects (outside this app). */
export function PastProjectDialog({ open, onClose, vendor }: { open: boolean; onClose: () => void; vendor: Vendor }) {
  const { t } = useL();
  const updateVendor = useOps((s) => s.updateVendor);
  const [f, setF] = useState({ project: "", year: TODAY.slice(0, 4), value: "", onTime: true });
  const year = Number(f.year);
  const value = Number(f.value.replace(/[\s,]/g, ""));
  const valid = f.project.trim() && Number.isInteger(year) && year > 1950 && year <= Number(TODAY.slice(0, 4)) && Number.isFinite(value) && value >= 0;
  const save = () => {
    if (!valid) return;
    updateVendor(vendor.id, { history: [...vendor.history, { project: f.project.trim(), year, value, onTime: f.onTime }] });
    setF({ project: "", year: TODAY.slice(0, 4), value: "", onTime: true });
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Add a past project")}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {t("Save")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Project")} wide>
          <input className="input" value={f.project} onChange={(e) => setF((o) => ({ ...o, project: e.target.value }))} />
        </Field>
        <Field label={t("Year")}>
          <input className="input num" inputMode="numeric" value={f.year} onChange={(e) => setF((o) => ({ ...o, year: e.target.value }))} />
        </Field>
        <Field label={t("Value, AZN")}>
          <input className="input num" inputMode="decimal" value={f.value} onChange={(e) => setF((o) => ({ ...o, value: e.target.value }))} />
        </Field>
        <Field label={t("Delivery")} wide>
          <div className="segmented" role="group">
            <button type="button" aria-pressed={f.onTime} onClick={() => setF((o) => ({ ...o, onTime: true }))}>
              {t("On time")}
            </button>
            <button type="button" aria-pressed={!f.onTime} onClick={() => setF((o) => ({ ...o, onTime: false }))}>
              {t("Late")}
            </button>
          </div>
        </Field>
      </div>
    </Dialog>
  );
}
