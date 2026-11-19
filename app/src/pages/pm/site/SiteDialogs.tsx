import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Dialog, Field, toast, useL } from "../../../components/kit";
import { useOps } from "../../../ops/store";
import { same, TODAY } from "../../../ops/dates";
import { equipmentSupplier, workerPhone, type SiteEquipment, type SiteWorker } from "../../../ops/ext/site-p2";
import type { Equipment, EquipmentCategory, EquipmentStatus, Txt, Worker } from "../../../ops/types";
import { CATEGORY, freshRef, ROLE, siteMeta, SITE_STATUS, zoneTxt, ZoneInput } from "./shared";

const OTHER = "__other";
const ROLES = Object.keys(ROLE) as Worker["role"][];

type CertRow = { name: string; expires: string };

/** Add or edit a worker: name, trade, role, employer, phone, hourly rate, activity and certificates. */
export function WorkerDialog({ open, onClose, worker, onSaved }: { open: boolean; onClose: () => void; worker?: Worker | null; onSaved?: (id: string) => void }) {
  const { t, x } = useL();
  const subs = useOps((s) => s.subs);
  const activities = useOps((s) => s.activities);
  const company = useOps((s) => s.setup.company);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const blank = { name: "", trade: "", role: "OPERATIVE" as Worker["role"], employer: "", otherEmployer: "", phone: "", rate: "", activityId: "" };
  const [f, setF] = useState(blank);
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    if (worker) {
      const known = !worker.employer || subs.some((s) => s.id === worker.employer);
      setF({
        name: worker.name,
        trade: x(worker.trade),
        role: worker.role,
        employer: known ? worker.employer : OTHER,
        otherEmployer: known ? "" : worker.employer,
        phone: workerPhone(worker),
        rate: worker.rate ? String(worker.rate) : "",
        activityId: worker.activityId ?? "",
      });
      setCerts(worker.certs.map((c) => ({ name: x(c.name), expires: c.expires })));
    } else {
      setF(blank);
      setCerts([]);
    }
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, worker?.id]);

  const save = () => {
    setTried(true);
    if (!f.name.trim() || !f.trade.trim()) return;
    if (f.employer === OTHER && !f.otherEmployer.trim()) return;
    const employer = f.employer === OTHER ? f.otherEmployer.trim() : f.employer;
    const keepTxt = (old: Txt | undefined, text: string) => (old && x(old) === text ? old : same(text));
    const certList = certs
      .filter((c) => c.name.trim() && c.expires)
      .map((c) => ({ name: keepTxt(worker?.certs.find((o) => x(o.name) === c.name.trim())?.name, c.name.trim()), expires: c.expires }));
    const fields = {
      name: f.name.trim(),
      trade: keepTxt(worker?.trade, f.trade.trim()),
      role: f.role,
      employer,
      rate: Math.max(0, Number(f.rate) || 0),
      activityId: f.activityId || null,
      certs: certList,
      phone: f.phone.trim(),
    };
    if (worker) {
      patchItem("workers", worker.id, fields as Partial<SiteWorker>);
      toast(t("{name} updated", { name: fields.name }));
      onSaved?.(worker.id);
    } else {
      const id = freshRef(() => nextRef("WK"), (r) => useOps.getState().workers.some((w) => w.id === r));
      const w: SiteWorker = { id, ...fields };
      addItem("workers", w, false);
      pushFeed("PM", { en: `${w.name} added to the workforce (${w.trade.en})`, az: `${w.name} işçi heyətinə əlavə edildi (${w.trade.az})` }, "pm/workforce");
      toast(t("{name} added to the workforce", { name: w.name }));
      onSaved?.(id);
    }
    onClose();
  };

  const setCert = (i: number, patch: Partial<CertRow>) => setCerts((l) => l.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={620}
      title={worker ? t("Edit worker") : t("Add worker")}
      kicker={worker?.id}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {worker ? t("Save") : t("Add worker")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Full name")} wide error={tried && !f.name.trim() ? t("Enter a name.") : undefined}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label={t("Trade")} error={tried && !f.trade.trim() ? t("Enter the trade.") : undefined}>
          <input className="input" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })} placeholder={t("e.g. Steel fixer")} />
        </Field>
        <Field label={t("Role")}>
          <select className="input select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Worker["role"] })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {x(ROLE[r]!)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Employer")} hint={!company && f.employer === "" ? t("Set your company name in Settings to show it here.") : undefined}>
          <select className="input select" value={f.employer} onChange={(e) => setF({ ...f, employer: e.target.value })}>
            <option value="">{company || t("Own staff")}</option>
            {subs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={OTHER}>{t("Another company…")}</option>
          </select>
        </Field>
        {f.employer === OTHER ? (
          <Field label={t("Company")} error={tried && !f.otherEmployer.trim() ? t("Enter the company name.") : undefined}>
            <input className="input" value={f.otherEmployer} onChange={(e) => setF({ ...f, otherEmployer: e.target.value })} />
          </Field>
        ) : null}
        <Field label={t("Phone")} hint={t("Optional")}>
          <input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label={t("Rate, AZN/h")} hint={t("Optional. Used for labour cost.")}>
          <input className="input num" type="number" min={0} step="0.01" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} />
        </Field>
        <Field label={t("Activity")} hint={t("Optional")}>
          <select className="input select" value={f.activityId} onChange={(e) => setF({ ...f, activityId: e.target.value })}>
            <option value="">{t("Unassigned")}</option>
            {activities
              .filter((a) => a.status !== "COMPLETED" && !a.isMilestone)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {x(a.name)}
                </option>
              ))}
          </select>
        </Field>
        <div className="k-field k-field-wide">
          <span className="k-field-label">{t("Certificates held")}</span>
          {certs.length ? (
            <ul className="st-newchecks" style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
              {certs.map((c, i) => (
                <li key={i} className="k-row" style={{ gap: 6 }}>
                  <input className="input" style={{ flex: 1, minWidth: 0 }} value={c.name} onChange={(e) => setCert(i, { name: e.target.value })} placeholder={t("Certificate")} aria-label={t("Certificate")} />
                  <input className="input" type="date" style={{ width: 150 }} value={c.expires} onChange={(e) => setCert(i, { expires: e.target.value })} aria-label={t("Expires")} />
                  <button type="button" className="icon-btn" onClick={() => setCerts((l) => l.filter((_, j) => j !== i))} aria-label={t("Remove")}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="k-field-hint">{t("Optional. Add a ticket or licence with its expiry date to track renewals.")}</span>
          )}
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCerts((l) => [...l, { name: "", expires: "" }])}>
              <Plus size={13} />
              {t("Add certificate")}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const CATS = Object.keys(CATEGORY) as EquipmentCategory[];
const STATUSES = Object.keys(SITE_STATUS.equipment) as EquipmentStatus[];

/** Add or edit a machine: name, type, owned or hired, supplier, day rate, hire dates, status and place. */
export function EquipmentDialog({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item?: Equipment | null; onSaved?: (id: string) => void }) {
  const { t, x } = useL();
  const vendors = useOps((s) => s.vendors);
  const nextRef = useOps((s) => s.nextRef);
  const addItem = useOps((s) => s.addItem);
  const patchItem = useOps((s) => s.patchItem);
  const pushFeed = useOps((s) => s.pushFeed);
  const blank = { name: "", code: "", category: "EXCAVATOR" as EquipmentCategory, ownership: "OWNED" as Equipment["ownership"], supplier: "", dayRate: "", hireFrom: "", hireTo: "", status: "ON_SITE" as EquipmentStatus, zone: "", nextService: "" };
  const [f, setF] = useState(blank);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    if (item) {
      setF({
        name: x(item.name),
        code: item.code,
        category: item.category,
        ownership: item.ownership,
        supplier: vendors.find((v) => v.id === item.vendorId)?.name ?? equipmentSupplier(item),
        dayRate: item.dayRate ? String(item.dayRate) : "",
        hireFrom: item.hireFrom ?? "",
        hireTo: item.hireTo ?? "",
        status: item.status,
        zone: x(item.zone),
        nextService: item.nextService,
      });
    } else setF(blank);
    // Reset only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const hired = f.ownership === "HIRED";
  const datesBad = hired && f.hireFrom && f.hireTo && f.hireTo < f.hireFrom;

  const save = () => {
    setTried(true);
    if (!f.name.trim() || datesBad) return;
    const vendor = hired ? vendors.find((v) => v.name.trim().toLowerCase() === f.supplier.trim().toLowerCase()) : undefined;
    const fields = {
      name: item && x(item.name) === f.name.trim() ? item.name : same(f.name.trim()),
      category: f.category,
      ownership: f.ownership,
      vendorId: vendor?.id ?? null,
      supplier: hired && !vendor ? f.supplier.trim() : "",
      status: f.status,
      zone: item && x(item.zone) === f.zone.trim() ? item.zone : zoneTxt(f.zone),
      dayRate: Math.max(0, Number(f.dayRate) || 0),
      hireFrom: hired ? f.hireFrom || null : null,
      hireTo: hired ? f.hireTo || null : null,
      nextService: f.nextService,
    };
    if (item) {
      patchItem("equipment", item.id, { ...fields, code: f.code.trim() || item.code } as Partial<SiteEquipment>);
      toast(t("{code} updated", { code: f.code.trim() || item.code }));
      onSaved?.(item.id);
    } else {
      const id = freshRef(() => nextRef("EQ"), (r) => useOps.getState().equipment.some((e) => e.id === r));
      const e: SiteEquipment = { id, code: f.code.trim() || id, activityId: null, hours: [], hireInvoices: [], ...fields };
      addItem("equipment", e, false);
      pushFeed("PM", { en: `${e.code} ${e.name.en} added to the fleet`, az: `${e.code} ${e.name.az} texnika parkına əlavə edildi` }, `pm/equipment?eq=${id}`);
      toast(t("{code} added to the fleet", { code: e.code }));
      onSaved?.(id);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={620}
      title={item ? t("Edit equipment") : t("Add equipment")}
      kicker={item?.code}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("Cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {item ? t("Save") : t("Add equipment")}
          </button>
        </>
      }
    >
      <div className="k-form">
        <Field label={t("Name")} wide error={tried && !f.name.trim() ? t("Enter a name.") : undefined}>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("e.g. Tracked excavator 21 t")} autoFocus />
        </Field>
        <Field label={t("Type")}>
          <select className="input select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as EquipmentCategory })}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {x(CATEGORY[c].label)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Fleet or plate number")} hint={t("Optional. A reference is given when empty.")}>
          <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label={t("Ownership")}>
          <select className="input select" value={f.ownership} onChange={(e) => setF({ ...f, ownership: e.target.value as Equipment["ownership"] })}>
            <option value="OWNED">{t("Owned")}</option>
            <option value="HIRED">{t("Hired")}</option>
          </select>
        </Field>
        <Field label={t("Status")}>
          <select className="input select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as EquipmentStatus })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {x(siteMeta("equipment", s).label)}
              </option>
            ))}
          </select>
        </Field>
        {hired ? (
          <Field label={t("Supplier")} hint={t("Optional")}>
            <input className="input" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} list="st-eq-suppliers" />
            <datalist id="st-eq-suppliers">
              {vendors.map((v) => (
                <option key={v.id} value={v.name} />
              ))}
            </datalist>
          </Field>
        ) : null}
        <Field label={hired ? t("Day rate, AZN") : t("Day cost, AZN")} hint={t("Optional")}>
          <input className="input num" type="number" min={0} value={f.dayRate} onChange={(e) => setF({ ...f, dayRate: e.target.value })} />
        </Field>
        {hired ? (
          <>
            <Field label={t("Hire starts")} hint={t("Optional")}>
              <input className="input" type="date" value={f.hireFrom} onChange={(e) => setF({ ...f, hireFrom: e.target.value })} />
            </Field>
            <Field label={t("Hire ends")} hint={t("Optional")} error={datesBad ? t("The end date is before the start.") : undefined}>
              <input className="input" type="date" value={f.hireTo} min={f.hireFrom || undefined} onChange={(e) => setF({ ...f, hireTo: e.target.value })} />
            </Field>
          </>
        ) : null}
        <Field label={t("Where")} hint={t("A building of this project, or type a place.")}>
          <ZoneInput id="st-eq-zone" value={f.zone} onChange={(v) => setF({ ...f, zone: v })} />
        </Field>
        <Field label={t("Next service")} hint={t("Optional")}>
          <input className="input" type="date" value={f.nextService} min={item ? undefined : TODAY} onChange={(e) => setF({ ...f, nextService: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
