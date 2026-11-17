import { ClipboardCheck, Construction, DraftingCompass, FileQuestion, Package, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { diffDays, TODAY } from "../../../ops/dates";
import { poLate, R } from "../../../ops/select";
import type { Activity, Constraint, ConstraintKind, OpsData, Txt } from "../../../ops/types";
import { RP, subApproved, subDates, tt } from "./shared";

export const KINDS: { key: ConstraintKind; label: string; icon: LucideIcon }[] = [
  { key: "MATERIAL", label: "Material", icon: Package },
  { key: "RFI", label: "RFI", icon: FileQuestion },
  { key: "INSPECTION", label: "Inspection", icon: ClipboardCheck },
  { key: "CREW", label: "Crew", icon: Users },
  { key: "PERMIT", label: "Permit", icon: ShieldCheck },
  { key: "DESIGN", label: "Design", icon: DraftingCompass },
  { key: "EQUIPMENT", label: "Equipment", icon: Construction },
];
export const kindMeta = (k: ConstraintKind) => KINDS.find((x) => x.key === k)!;

/** One thing standing between an activity and a ready start: logged on the board or found live in the records. */
export type Issue = {
  key: string;
  kind: ConstraintKind;
  text: Txt;
  /** Open = still blocks; closed = checked and clear. */
  open: boolean;
  href: string | null;
  ref: string | null;
  constraintId: string | null;
  owner: string | null;
  due: string | null;
  source: "logged" | "live";
};

export function linkHref(link: Constraint["link"]): string | null {
  if (!link) return null;
  switch (link.kind) {
    case "MR":
      return R.request(link.id);
    case "PO":
      return R.order(link.id);
    case "RFI":
      return R.rfi(link.id);
    case "INSPECTION":
      return R.inspection(link.id);
    case "PERMIT":
      return RP.safety;
    case "SUBMITTAL":
      return RP.submittal(link.id);
    case "EQUIPMENT":
      return RP.equipment;
  }
}

type Src = Pick<OpsData, "constraints" | "mrs" | "pos" | "rfis" | "inspections" | "permits" | "equipment" | "workers" | "submittals" | "activities">;

/** Every constraint of one activity: logged ones plus live checks on orders, RFIs, inspections, permits, plant, crew and submittals. */
export function issuesOf(s: Src, a: Activity): Issue[] {
  const out: Issue[] = [];
  for (const c of s.constraints.filter((x) => x.activityId === a.id)) {
    out.push({ key: c.id, kind: c.kind, text: c.text, open: c.status === "OPEN", href: linkHref(c.link), ref: c.link?.id ?? null, constraintId: c.id, owner: c.owner, due: c.due, source: "logged" });
  }
  const loggedRefs = new Set(out.filter((i) => i.ref).map((i) => i.ref!));
  const live = (i: Omit<Issue, "source" | "constraintId" | "key">) => {
    if (i.ref && loggedRefs.has(i.ref)) return;
    out.push({ ...i, key: `live-${i.kind}-${i.ref ?? out.length}`, constraintId: null, source: "live" });
  };

  // Material: orders raised from requests for this activity.
  const mrIds = new Set(s.mrs.filter((m) => m.activityId === a.id && m.status !== "CANCELLED").map((m) => m.id));
  for (const po of s.pos.filter((p) => p.mrId && mrIds.has(p.mrId) && p.status !== "CANCELLED")) {
    const late = poLate(po);
    live({ kind: "MATERIAL", text: late ? tt(`${po.ref} is ${diffDays(po.expectedAt, TODAY)} days late`, `${po.ref} ${diffDays(po.expectedAt, TODAY)} gün gecikir`) : po.status === "CLOSED" ? tt(`${po.ref} delivered`, `${po.ref} çatdırılıb`) : tt(`${po.ref} on order, on time`, `${po.ref} sifarişdədir, vaxtında`), open: late, href: R.order(po.id), ref: po.id, owner: null, due: po.expectedAt });
  }
  // RFI.
  for (const r of s.rfis.filter((x) => x.activityId === a.id)) {
    live({ kind: "RFI", text: r.status === "OPEN" ? tt(`${r.ref} open: ${r.subject.en}`, `${r.ref} açıqdır: ${r.subject.az}`) : tt(`${r.ref} answered`, `${r.ref} cavablanıb`), open: r.status === "OPEN", href: R.rfi(r.id), ref: r.id, owner: null, due: r.dueAt });
  }
  // Inspections: open NCRs and inspections still waiting.
  for (const i of s.inspections.filter((x) => x.activityId === a.id)) {
    const open = (i.kind === "NCR" && i.status === "OPEN") || i.status === "REQUESTED";
    if (!open && i.status !== "PASSED" && i.status !== "PASSED_WITH_COMMENTS" && i.status !== "CLOSED") continue;
    live({ kind: "INSPECTION", text: open ? (i.kind === "NCR" ? tt(`${i.ref} open: ${i.title.en}`, `${i.ref} açıqdır: ${i.title.az}`) : tt(`${i.ref} waiting for inspection`, `${i.ref} yoxlama gözləyir`)) : tt(`${i.ref} passed`, `${i.ref} keçib`), open, href: R.inspection(i.id), ref: i.id, owner: i.inspector, due: i.requestedAt });
  }
  // Permits.
  for (const p of s.permits.filter((x) => x.activityId === a.id && x.status !== "CLOSED")) {
    const open = p.status !== "ACTIVE";
    const state = { DRAFT: ["not issued yet", "hələ verilməyib"], SUSPENDED: ["suspended", "dayandırılıb"], EXPIRED: ["expired", "müddəti bitib"], ACTIVE: ["active", "qüvvədədir"], CLOSED: ["closed", "bağlanıb"] }[p.status];
    live({ kind: "PERMIT", text: tt(`${p.ref} ${state[0]}`, `${p.ref} ${state[1]}`), open, href: RP.safety, ref: p.id, owner: p.issuedBy, due: p.from });
  }
  // Equipment assigned to the activity.
  for (const e of s.equipment.filter((x) => x.activityId === a.id)) {
    const open = e.status === "BROKEN_DOWN" || e.status === "MAINTENANCE";
    live({ kind: "EQUIPMENT", text: open ? tt(`${e.name.en} ${e.status === "BROKEN_DOWN" ? "broken down" : "in maintenance"}`, `${e.name.az} ${e.status === "BROKEN_DOWN" ? "sıradan çıxıb" : "təmirdədir"}`) : tt(`${e.name.en} on site`, `${e.name.az} meydançadadır`), open, href: RP.equipment, ref: e.id, owner: null, due: null });
  }
  // Crew: named workers booked on the activity.
  const crew = s.workers.filter((w) => w.activityId === a.id).length;
  if (crew) live({ kind: "CREW", text: tt(`${crew} workers booked`, `${crew} işçi təyin edilib`), open: false, href: null, ref: null, owner: null, due: null });
  // Design: submittals that are not approved in time.
  for (const sb of s.submittals.filter((x) => x.activityId === a.id)) {
    const dd = subDates(sb, s.activities);
    const open = !subApproved(sb) && (sb.status === "REVISE" || sb.status === "REJECTED" || dd.late);
    if (!open && !subApproved(sb)) continue;
    live({ kind: "DESIGN", text: open ? tt(`${sb.ref} not approved: ${sb.title.en}`, `${sb.ref} təsdiqlənməyib: ${sb.title.az}`) : tt(`${sb.ref} approved`, `${sb.ref} təsdiqlənib`), open, href: RP.submittal(sb.id), ref: sb.id, owner: sb.reviewer, due: dd.finalDue });
  }
  return out;
}

export type Cell = "bad" | "ok" | "na";
export function cellOf(issues: Issue[], kind: ConstraintKind): Cell {
  const of = issues.filter((i) => i.kind === kind);
  if (of.some((i) => i.open)) return "bad";
  return of.length ? "ok" : "na";
}

/** Activities live in a window (not done, not milestones). */
export function liveIn(activities: Activity[], from: string, to: string) {
  return activities.filter((a) => !a.isMilestone && a.status !== "COMPLETED" && a.start <= to && a.end >= from);
}
