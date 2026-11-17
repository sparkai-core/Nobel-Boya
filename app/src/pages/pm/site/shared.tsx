import type { ReactNode } from "react";
import {
  ArrowUpFromLine,
  Cable,
  Construction,
  Droplets,
  Flame,
  Forklift,
  Hammer,
  HardHat,
  Shovel,
  Tractor,
  Truck,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge, useL } from "../../../components/kit";
import { addDays, diffDays, TODAY } from "../../../ops/dates";
import { to, type Tone } from "../../../ops/select";
import type { AttendanceStatus, Equipment, EquipmentCategory, EquipmentStatus, Incident, Permit, PermitKind, PpeCheck, Txt } from "../../../ops/types";

/** Status labels and tones for the site collections (the shared STATUS map has none for these). */
type Meta = { label: Txt; tone: Tone };
const m = (en: string, az: string, tone: Tone): Meta => ({ label: { en, az }, tone });

export const SITE_STATUS = {
  equipment: {
    ON_SITE: m("On site", "Meydançada", "ok"),
    IDLE: m("Idle", "Boşdadır", "warn"),
    MAINTENANCE: m("Maintenance", "Təmirdə", "info"),
    BROKEN_DOWN: m("Broken down", "Xarabdır", "bad"),
    AVAILABLE: m("Available", "Hazırdır", "brand"),
    OFF_HIRE: m("Off hire", "İcarədən çıxıb", "muted"),
  } satisfies Record<EquipmentStatus, Meta>,
  attendance: {
    PRESENT: m("Present", "İşdədir", "ok"),
    HALF: m("Half day", "Yarım gün", "warn"),
    ABSENT: m("Absent", "Gəlməyib", "bad"),
    LEAVE: m("On leave", "Məzuniyyətdə", "info"),
    INJURY: m("Injury", "Xəsarət", "bad"),
  } satisfies Record<AttendanceStatus, Meta>,
  incident: {
    OPEN: m("Open", "Açıq", "bad"),
    INVESTIGATING: m("Investigating", "Araşdırılır", "warn"),
    CLOSED: m("Closed", "Bağlanıb", "ok"),
  } satisfies Record<Incident["status"], Meta>,
  permit: {
    DRAFT: m("Draft", "Qaralama", "muted"),
    ACTIVE: m("Active", "Qüvvədədir", "ok"),
    SUSPENDED: m("Suspended", "Dayandırılıb", "bad"),
    CLOSED: m("Closed", "Bağlanıb", "neutral"),
    EXPIRED: m("Expired", "Müddəti bitib", "warn"),
  } satisfies Record<Permit["status"], Meta>,
  ppe: {
    WAITING: m("Waiting", "Gözləyir", "warn"),
    CONFIRMED: m("Confirmed", "Təsdiqlənib", "bad"),
    FALSE_ALARM: m("False alarm", "Yanlış həyəcan", "muted"),
  } satisfies Record<PpeCheck["status"], Meta>,
} as const;

export type SiteKind = keyof typeof SITE_STATUS;

export function siteMeta(kind: SiteKind, status: string): Meta {
  const map = SITE_STATUS[kind] as Record<string, Meta>;
  return map[status] ?? { label: { en: status, az: status }, tone: "neutral" };
}

export function SiteBadge({ kind, status, dot = true }: { kind: SiteKind; status: string; dot?: boolean }) {
  const { x } = useL();
  const meta = siteMeta(kind, status);
  return (
    <Badge tone={meta.tone} dot={dot}>
      {x(meta.label)}
    </Badge>
  );
}

// ---------------------------------------------------------------- labels

export const CATEGORY: Record<EquipmentCategory, { label: Txt; icon: LucideIcon }> = {
  CRANE: { label: { en: "Crane", az: "Kran" }, icon: Construction },
  EXCAVATOR: { label: { en: "Excavator", az: "Ekskavator" }, icon: Shovel },
  LOADER: { label: { en: "Loader", az: "Yükləyici" }, icon: Tractor },
  GENERATOR: { label: { en: "Generator", az: "Generator" }, icon: Zap },
  VEHICLE: { label: { en: "Vehicle", az: "Nəqliyyat" }, icon: Truck },
  LIFT: { label: { en: "Lift", az: "Qaldırıcı" }, icon: Forklift },
  PUMP: { label: { en: "Pump", az: "Nasos" }, icon: Droplets },
  COMPACTOR: { label: { en: "Compactor", az: "Kipləşdirici" }, icon: Hammer },
};

export const PERMIT_KIND: Record<PermitKind, { label: Txt; icon: LucideIcon }> = {
  HOT_WORK: { label: { en: "Hot work", az: "Odlu işlər" }, icon: Flame },
  WORK_AT_HEIGHT: { label: { en: "Work at height", az: "Hündürlükdə iş" }, icon: ArrowUpFromLine },
  EXCAVATION: { label: { en: "Excavation", az: "Qazma" }, icon: Shovel },
  LIFTING: { label: { en: "Lifting", az: "Qaldırma" }, icon: Construction },
  CONFINED_SPACE: { label: { en: "Confined space", az: "Qapalı məkan" }, icon: Wind },
  ELECTRICAL: { label: { en: "Electrical", az: "Elektrik" }, icon: Cable },
};

export const INCIDENT_KIND: Record<Incident["kind"], Txt> = {
  NEAR_MISS: { en: "Near miss", az: "Az qala hadisə" },
  FIRST_AID: { en: "First aid", az: "İlk yardım" },
  LOST_TIME: { en: "Lost time", az: "İş vaxtı itkisi" },
  PROPERTY: { en: "Property damage", az: "Əmlak zədəsi" },
  ENVIRONMENT: { en: "Environment", az: "Ətraf mühit" },
};

export const PPE_ITEM: Record<PpeCheck["missing"][number], Txt> = {
  HELMET: { en: "Helmet", az: "Kaska" },
  VEST: { en: "Vest", az: "Jilet" },
  BOOTS: { en: "Boots", az: "Çəkmə" },
  GLOVES: { en: "Gloves", az: "Əlcək" },
  HARNESS: { en: "Harness", az: "Qoruyucu kəmər" },
};

export const ROLE: Record<string, Txt> = {
  OPERATIVE: { en: "Operative", az: "İşçi" },
  FOREMAN: { en: "Foreman", az: "Briqadir" },
  ENGINEER: { en: "Engineer", az: "Mühəndis" },
  OPERATOR: { en: "Operator", az: "Operator" },
  SUPERVISOR: { en: "Supervisor", az: "Nəzarətçi" },
};

export const SiteIcon = HardHat;

// ---------------------------------------------------------------- zones

/** Zones of the stylised site plan. Equipment and permits name these in English. */
export const ZONES: { key: string; label: Txt }[] = [
  { key: "Warehouse grid 1–9", label: { en: "Warehouse grid 1–9", az: "Anbar, 1–9 oxları" } },
  { key: "Admin building", label: { en: "Admin building", az: "İnzibati bina" } },
  { key: "Main store", label: { en: "Main store", az: "Əsas anbar" } },
  { key: "Site compound", label: { en: "Site compound", az: "Meydança düşərgəsi" } },
  { key: "Main gate yard", label: { en: "Main gate yard", az: "Əsas darvaza həyəti" } },
  { key: "Workshop", label: { en: "Workshop", az: "Emalatxana" } },
];
export const zoneTxt = (key: string): Txt => ZONES.find((z) => z.key === key)?.label ?? { en: key, az: key };

/** Where an activity's work happens on the plan. */
export const zoneForBuilding = (building: string): Txt => zoneTxt(building === "WH" ? "Warehouse grid 1–9" : building === "AD" ? "Admin building" : "Site compound");

// ---------------------------------------------------------------- equipment maths

export const isHired = (e: Equipment) => e.ownership === "HIRED" && e.status !== "OFF_HIRE";

/** Share of an 8-hour shift worked over the last six finished days (today is still running). */
export const utilisation = (e: Equipment) => {
  const done = e.hours.slice(0, 6);
  if (!done.length) return 0;
  return done.reduce((a, h) => a + Math.min(h, 8), 0) / (done.length * 8);
};

/** Today's hire cost split into what is working and what is standing. */
export function hireSplit(e: Equipment) {
  if (!isHired(e)) return { work: 0, idle: 0 };
  if (e.status !== "ON_SITE") return { work: 0, idle: e.dayRate };
  const u = utilisation(e);
  return { work: Math.round(e.dayRate * u), idle: Math.round(e.dayRate * (1 - u)) };
}

/** Hire money spent on standing time over the last six finished days (today is still running). */
export const idleCost7 = (e: Equipment) => (e.ownership === "HIRED" ? Math.round(e.hours.slice(0, 6).reduce((a, h) => a + e.dayRate * (1 - Math.min(h, 8) / 8), 0)) : 0);

export const daysOnHire = (e: Equipment) => (e.hireFrom ? Math.max(0, diffDays(e.hireFrom, e.hireTo && e.hireTo < TODAY ? e.hireTo : TODAY)) : 0);

export type EqFlag = "OFF_HIRE_SOON" | "IDLE_HIRED" | "INVOICE" | "SERVICE" | "BROKEN";
export const FLAG_LABEL: Record<EqFlag, { label: string; tone: Tone }> = {
  OFF_HIRE_SOON: { label: "Off-hire soon", tone: "warn" },
  IDLE_HIRED: { label: "Idle hired", tone: "warn" },
  INVOICE: { label: "Invoice mismatch", tone: "bad" },
  SERVICE: { label: "Maintenance due", tone: "info" },
  BROKEN: { label: "Broken down", tone: "bad" },
};

export function eqFlags(e: Equipment): EqFlag[] {
  const out: EqFlag[] = [];
  if (e.status === "BROKEN_DOWN") out.push("BROKEN");
  if (isHired(e) && e.hireTo && e.hireTo >= TODAY && diffDays(TODAY, e.hireTo) <= 10) out.push("OFF_HIRE_SOON");
  if (isHired(e) && (e.status === "IDLE" || (e.status === "ON_SITE" && utilisation(e) < 0.4))) out.push("IDLE_HIRED");
  if (e.hireInvoices.some((i) => i.billed > i.accrued + 0.5)) out.push("INVOICE");
  if (e.status !== "MAINTENANCE" && e.status !== "OFF_HIRE" && e.nextService <= addDays(TODAY, 7)) out.push("SERVICE");
  return out;
}

export const invoiceState = (i: Equipment["hireInvoices"][number]): { label: string; tone: Tone } =>
  i.billed > i.accrued + 0.5 ? { label: "Over-billed", tone: "bad" } : i.billed < i.accrued - 0.5 ? { label: "Under-billed", tone: "warn" } : { label: "Matches", tone: "ok" };

// ---------------------------------------------------------------- dates

/** The last seven days, oldest first (matches Equipment.hours and the attendance grid). */
export const WEEK = Array.from({ length: 7 }, (_, i) => addDays(TODAY, i - 6));
export const isRestDay = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

/** Stable 0–1 number from a string, for deterministic demo figures. */
export const hash01 = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000;
};

/** A reference that is not taken yet: nextRef until the id is free (seeded counters can lag behind). */
export function freshRef(next: () => string, taken: (id: string) => boolean) {
  let id = next();
  for (let i = 0; i < 50 && taken(id); i++) id = next();
  return id;
}

export const siteLink = {
  equipment: (id?: string) => to(`pm/equipment${id ? `?eq=${id}` : ""}`),
  workforce: to("pm/workforce"),
  safety: (tab?: string) => to(`pm/safety${tab ? `?tab=${tab}` : ""}`),
};

/** Small titled block used inside drawers. */
export function DrawerSection({ title, children, aside }: { title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="st-dsec">
      <header>
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
