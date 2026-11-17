import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, Globe, Mail, Phone, User } from "lucide-react";
import { Avatar, Badge, Field, PageHero, Panel, StatusBadge, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { same } from "../../../ops/dates";
import { R, TRADES, tradeName } from "../../../ops/select";
import type { Trade, VendorStatus } from "../../../ops/types";

const TERMS = ["15 days", "30 days", "45 days", "60 days", "On delivery", "Monthly in advance"];

/** New vendor: the register form with a live preview of the record it creates. */
export function VendorNewPage() {
  const { t, lang } = useL();
  const navigate = useNavigate();
  const createVendor = useOps((s) => s.createVendor);
  const [f, setF] = useState({
    name: "",
    trade: "Concrete" as Trade,
    trades: [] as Trade[],
    city: "Bakı",
    trn: "",
    licence: "",
    contact: "",
    email: "",
    phone: "+994 ",
    website: "",
    paymentTerms: "30 days",
    note: "",
    status: "APPROVED" as VendorStatus,
  });
  const [tried, setTried] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((o) => ({ ...o, [k]: v }));

  const errors = {
    name: !f.name.trim() ? t("Required") : undefined,
    trn: !/^\d{10}$/.test(f.trn.trim()) ? t("TRN is 10 digits") : undefined,
    contact: !f.contact.trim() ? t("Required") : undefined,
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) ? t("Check the email address") : undefined,
  };
  const valid = !errors.name && !errors.trn && !errors.contact && !errors.email;
  const risk = !f.licence.trim() ? "HIGH" : f.status === "APPROVED" ? "LOW" : "MEDIUM";

  const save = () => {
    setTried(true);
    if (!valid) return;
    const id = createVendor({
      name: f.name.trim(),
      trade: f.trade,
      trades: [f.trade, ...f.trades.filter((x) => x !== f.trade)],
      city: f.city.trim(),
      trn: f.trn.trim(),
      licence: f.licence.trim() || null,
      contact: f.contact.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      website: f.website.trim() || null,
      paymentTerms: f.paymentTerms,
      status: f.status,
      risk,
      portal: true,
      note: f.note.trim() ? same(f.note.trim()) : null,
    });
    toast(t("{v} added to the vendor register", { v: f.name.trim() }));
    navigate(R.vendor(id));
  };

  return (
    <div className="k-page po-page">
      <PageHero
        eyebrow={t("Procurement · Vendors")}
        title={t("Add vendor")}
        subtitle={t("Register a supplier so it can be invited to RFQs and use the vendor portal.")}
        back={{ to: R.vendors, label: "Vendors" }}
        art="vendor"
      />

      <div className="k-grid-main">
        <Panel title={t("Vendor details")} icon={<Building2 size={15} />}>
          <div className="k-form">
            <Field label={t("Vendor name")} wide error={tried ? errors.name : undefined}>
              <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder={t("e.g. Şirvan Beton MMC")} />
            </Field>
            <Field label={t("Trade")}>
              <select className="input select" value={f.trade} onChange={(e) => set("trade", e.target.value as Trade)}>
                {TRADES.map((tr) => (
                  <option key={tr} value={tr}>
                    {tradeName(tr, lang)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("City")}>
              <input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label={t("Other trades")} wide hint={t("The vendor is also invited to RFQs in these trades.")}>
              <div className="k-quick">
                {TRADES.filter((tr) => tr !== f.trade).map((tr) => {
                  const on = f.trades.includes(tr as Trade);
                  return (
                    <button key={tr} type="button" className={on ? "on" : undefined} aria-pressed={on} onClick={() => set("trades", on ? f.trades.filter((x) => x !== tr) : [...f.trades, tr as Trade])}>
                      {on ? <Check size={11} /> : null} {tradeName(tr, lang)}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("TRN")} error={tried ? errors.trn : undefined} hint={t("Tax registration number, 10 digits")}>
              <input className="input k-mono" inputMode="numeric" maxLength={10} value={f.trn} onChange={(e) => set("trn", e.target.value.replace(/\D/g, ""))} />
            </Field>
            <Field label={t("Trade licence number")} hint={!f.licence.trim() ? t("Without a licence the vendor is marked high risk.") : undefined}>
              <input className="input k-mono" value={f.licence} onChange={(e) => set("licence", e.target.value)} placeholder="TL-2026-…" />
            </Field>
            <Field label={t("Contact person")} error={tried ? errors.contact : undefined}>
              <input className="input" value={f.contact} onChange={(e) => set("contact", e.target.value)} />
            </Field>
            <Field label={t("Email")} error={tried ? errors.email : undefined}>
              <input className="input" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={t("Phone")}>
              <input className="input" type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            <Field label={t("Website")}>
              <input className="input" value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="www.…" />
            </Field>
            <Field label={t("Payment terms")}>
              <select className="input select" value={f.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)}>
                {TERMS.map((x) => (
                  <option key={x} value={x}>
                    {t(x)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Status")}>
              <div className="segmented" role="group">
                {(["APPROVED", "ON_HOLD"] as VendorStatus[]).map((st) => (
                  <button key={st} type="button" aria-pressed={f.status === st} onClick={() => set("status", st)}>
                    {st === "APPROVED" ? t("Approved") : t("On hold")}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t("Internal note")} wide hint={t("Only buyers see this.")}>
              <textarea className="input" value={f.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </div>
          <div className="k-row po-mt">
            <button type="button" className="btn btn-primary" onClick={save}>
              {t("Save vendor")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(R.vendors)}>
              {t("Cancel")}
            </button>
            {tried && !valid ? <span className="k-field-error">{t("Fix the marked fields.")}</span> : null}
          </div>
        </Panel>

        <aside className="po-preview" aria-label={t("Record preview")}>
          <span className="po-preview-kicker">{t("Record preview")}</span>
          <div className="po-preview-card">
            <div className="po-preview-head">
              <Avatar name={f.name.trim() || "?"} size={44} />
              <div>
                <strong>{f.name.trim() || t("Vendor name")}</strong>
                <small>
                  {tradeName(f.trade, lang)} · {f.city || "—"}
                </small>
              </div>
            </div>
            <div className="k-row" style={{ gap: 6 }}>
              <StatusBadge kind="vendor" status={f.status} />
              <Badge tone={risk === "HIGH" ? "bad" : risk === "MEDIUM" ? "warn" : "ok"}>{risk === "HIGH" ? t("High risk") : risk === "MEDIUM" ? t("Medium risk") : t("Low risk")}</Badge>
              <Badge tone="info">{t("On the portal")}</Badge>
            </div>
            {f.trades.length ? (
              <p className="po-preview-trades">
                {t("Also")}: {f.trades.map((tr) => tradeName(tr, lang)).join(", ")}
              </p>
            ) : null}
            <dl className="po-preview-papers">
              <div>
                <dt>{t("TRN")}</dt>
                <dd className={`k-mono${f.trn.length === 10 ? "" : " k-text-muted"}`}>{f.trn || "——————————"}</dd>
              </div>
              <div>
                <dt>{t("Licence")}</dt>
                <dd className={f.licence ? "k-mono" : "k-text-bad"}>{f.licence || t("Missing")}</dd>
              </div>
              <div>
                <dt>{t("Terms")}</dt>
                <dd>{t(f.paymentTerms)}</dd>
              </div>
            </dl>
            <ul className="po-contact">
              <li>
                <User size={14} />
                {f.contact || "—"}
              </li>
              <li>
                <Mail size={14} />
                {f.email || "—"}
              </li>
              <li>
                <Phone size={14} />
                {f.phone.trim() || "—"}
              </li>
              {f.website ? (
                <li>
                  <Globe size={14} />
                  {f.website}
                </li>
              ) : null}
            </ul>
            <div className="po-preview-score">
              <span>{t("Starting score")}</span>
              <b className="num-inline">7.0 / 10</b>
              <small>{t("Builds from orders, receipts and payments.")}</small>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
