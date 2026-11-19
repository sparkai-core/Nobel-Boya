import { create } from "zustand";
import { persist } from "zustand/middleware";
import { data } from "../../data";
import { useApp } from "../../lib/store";
import { DERIVED_WBS } from "../seed";
import { addDays, nowStamp, same } from "../dates";
import { me } from "../people";
import { useOps, type NewQuote, type OpsState } from "../store";
import type { HistoryEvent, InvoiceLine, OpsData, Txt, Vendor } from "../types";

/**
 * Procurement helpers that keep records honest: they compose the shared store actions, then patch
 * what those actions fill in on their own (the old demo site address, starting vendor scores, "AI"
 * reading events) with what the user actually entered.
 */

const ev = (actor: HistoryEvent["actor"], en: string, az: string): HistoryEvent => ({ at: nowStamp(), actor, text: { en, az } });

// ---------------------------------------------------------------- project facts

/** The active project's name, from its own dataset. */
export function projectTxt(): Txt {
  const p = data.project;
  const en = p?.nameEn || p?.name || "";
  const az = p?.name || p?.nameEn || "";
  return { en: en || "This project", az: az || "Bu layihə" };
}

/** The project's site, from its own dataset (the address the user can change on each order). */
export function siteTxt(): Txt {
  const p = data.project;
  const en = p?.placeEn || p?.place || "";
  const az = p?.place || p?.placeEn || "";
  if (!en && !az) return { en: "Project site", az: "Layihə meydançası" };
  return { en, az };
}

/** The user's company name (Settings → Project setup), or "" when it is not set yet. */
export const companyName = () => useOps.getState().setup.company.trim();

/** Who the buyer is, for orders and the vendor portal: the company name, else a neutral word. */
export function buyerLabel(lang = useApp.getState().lang): string {
  return companyName() || (lang === "az" ? "Sizin şirkət" : "Your company");
}

// ---------------------------------------------------------------- vendors

/** A vendor has a score only once someone gave it one; a new vendor starts unscored. */
export const hasScore = (v: Pick<Vendor, "overall">) => v.overall > 0;

type VendorInput = Parameters<OpsState["createVendor"]>[0];

/** Adds a vendor without the store's starting scores (70 / 7.0) and assumed delivery days. */
export function addVendor(input: VendorInput): string {
  const id = useOps.getState().createVendor({ ...input, scores: input.scores ?? { reliability: 0, quality: 0, price: 0, delivery: 0 }, avgDeliveryDays: input.avgDeliveryDays ?? 0 });
  if (!input.scores) useOps.getState().patchItem("vendors", id, { overall: 0 });
  return id;
}

/** Approves an onboarding invite with the facts the buyer typed in (nothing is made up). */
export function approveInviteWith(inviteId: string, facts: { trn: string; licence: string; city: string; phone: string }): string | null {
  const s = useOps.getState();
  const inv = s.invites.find((i) => i.id === inviteId);
  const id = s.approveInvite(inviteId);
  if (!id) return null;
  const scored = inv?.score != null;
  useOps.getState().patchItem("vendors", id, {
    trn: facts.trn.trim(),
    licence: facts.licence.trim() || null,
    city: facts.city.trim(),
    phone: facts.phone.trim(),
    risk: facts.licence.trim() ? (scored && (inv?.score ?? 0) >= 8 ? "LOW" : "MEDIUM") : "HIGH",
    ...(scored ? {} : { scores: { reliability: 0, quality: 0, price: 0, delivery: 0 }, overall: 0 }),
    avgDeliveryDays: 0,
  });
  return id;
}

// ---------------------------------------------------------------- quotes

/** Replaces the store's "AI read the lines" event and reading check: a quote typed in is not read by anything. */
function honestQuote(id: string, ref: string | undefined, file: string | null, by: "USER" | "VENDOR") {
  const s = useOps.getState();
  const q = s.quotes.find((x) => x.id === id);
  if (!q) return;
  const first = by === "VENDOR" ? q.history[0]! : file ? ev("USER", `Quote entered by hand from ${file}`, `Təklif ${file} faylından əl ilə daxil edildi`) : ev("USER", "Quote entered by hand", "Təklif əl ilə daxil edildi");
  s.patchItem("quotes", id, {
    ref: ref?.trim() || q.id,
    confidence: 1,
    checks: q.checks.filter((c) => c.label.en !== "Reading confidence"),
    history: [first, ...q.history.slice(1).filter((h) => h.actor !== "AI")],
  });
}

/** Buyer types a quote in (optionally noting the file it came from). */
export function enterQuote(input: Omit<NewQuote, "source">, file: string | null): string {
  const id = useOps.getState().submitQuote({ ...input, source: "MANUAL" });
  honestQuote(id, input.ref, file, "USER");
  return id;
}

/** Vendor sends a quote through the portal. */
export function sendPortalQuote(input: Omit<NewQuote, "source">): string {
  const id = useOps.getState().submitQuote({ ...input, source: "PORTAL" });
  honestQuote(id, input.ref, null, "VENDOR");
  return id;
}

// ---------------------------------------------------------------- orders

/** Final approval issues the order; the delivery address becomes the project's site, not the old demo site. */
export function decideApprovalAt(approvalId: string, decision: "APPROVE" | "REJECT", notes?: string): string | null {
  const poId = useOps.getState().decideApproval(approvalId, decision, notes);
  if (poId) useOps.getState().patchItem("pos", poId, { deliverTo: siteTxt() });
  return poId;
}

type DirectPo = Parameters<OpsState["createDirectPo"]>[0];

/** A direct order delivered to the address the buyer typed (defaults to the project's site). */
export function createDirectPoAt(input: DirectPo, deliverTo: string): string {
  const id = useOps.getState().createDirectPo(input);
  useOps.getState().patchItem("pos", id, { deliverTo: deliverTo.trim() ? same(deliverTo.trim()) : siteTxt() });
  return id;
}

// ---------------------------------------------------------------- invoices

/** The buyer types a supplier invoice in: number, dates and lines. Nothing is read from the file. */
export function captureInvoice(input: { vendorId: string; poId: string; ref: string; date: string; dueDate: string; lines: InvoiceLine[]; file: string | null }): string {
  const id = useOps.getState().submitInvoice({ vendorId: input.vendorId, poId: input.poId, ref: input.ref.trim(), lines: input.lines, source: "UPLOAD", confidence: 1 });
  const inv = useOps.getState().invoices.find((x) => x.id === id);
  if (!inv) return id;
  const entered = input.file ? ev("USER", `Invoice entered by hand from ${input.file}`, `Faktura ${input.file} faylından əl ilə daxil edildi`) : ev("USER", "Invoice entered by hand", "Faktura əl ilə daxil edildi");
  useOps.getState().patchItem("invoices", id, { date: input.date, dueDate: input.dueDate || addDays(input.date, 30), history: [entered, ...inv.history.slice(1)] });
  return id;
}

/** Days in a payment-terms text such as "30 days" (0 when it names none, e.g. "On delivery"). */
export const termDays = (terms: string | undefined) => Number(/(\d+)/.exec(terms ?? "")?.[1] ?? 0);

// ---------------------------------------------------------------- backup

const BACKUP_KIND = "nobel-ops-backup";

/** The active project's records as plain JSON (no functions, no rebuilt BOQ data). */
export function exportBackup(): string {
  const s = useOps.getState();
  const state: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (typeof v !== "function" && k !== "materials" && k !== "vendorAs") state[k] = v;
  state.wbs = s.wbs.filter((w) => !w.id.startsWith(DERIVED_WBS));
  const app = useApp.getState();
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, projectId: app.activeProjectId, project: app.activeProjectTitle || projectTxt().en, exportedAt: nowStamp(), by: me(), state }, null, 1);
}

export type BackupCheck = { ok: true; patch: Partial<OpsData>; records: number; project: string } | { ok: false; reason: "json" | "kind" };

/** Reads a backup file and checks it has the right shape. Only known keys of the right type are taken. */
export function readBackup(text: string): BackupCheck {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  const b = raw as { kind?: unknown; state?: unknown; project?: unknown };
  if (!b || typeof b !== "object" || b.kind !== BACKUP_KIND || !b.state || typeof b.state !== "object") return { ok: false, reason: "kind" };
  const cur = useOps.getState() as unknown as Record<string, unknown>;
  const src = b.state as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let records = 0;
  for (const [k, v] of Object.entries(src)) {
    if (k === "materials" || k === "vendorAs" || !(k in cur)) continue;
    const c = cur[k];
    if (typeof c === "function") continue;
    if (Array.isArray(c)) {
      if (!Array.isArray(v)) continue;
      patch[k] = v;
      records += v.length;
    } else if (c && typeof c === "object") {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      patch[k] = v;
    } else if (typeof v === typeof c) patch[k] = v;
  }
  if (Array.isArray(patch.wbs)) {
    const derived = (cur.wbs as OpsData["wbs"]).filter((w) => w.id.startsWith(DERIVED_WBS));
    patch.wbs = [...derived, ...(patch.wbs as OpsData["wbs"]).filter((w) => !w.id.startsWith(DERIVED_WBS))];
  }
  if (patch.setup) patch.setup = { ...(cur.setup as object), ...(patch.setup as object) };
  return { ok: true, patch: patch as Partial<OpsData>, records, project: typeof b.project === "string" ? b.project : "" };
}

/** Applies a checked backup to the active project. */
export function applyBackup(patch: Partial<OpsData>) {
  useOps.setState(patch as Partial<OpsState>);
}

// ---------------------------------------------------------------- procurement plan dates

export type PkgPlan = { needBy: string | null; leadDays: number | null };

/**
 * Dates the user sets on a procurement package (when the site needs it, how long the supplier needs),
 * for packages whose materials no programme activity or request dates yet. Keys are "<project>:<package>".
 */
export const usePkgPlan = create<{ plan: Record<string, PkgPlan>; setPlan: (pkg: string, p: PkgPlan) => void; clearProject: () => void }>()(
  persist(
    (set) => ({
      plan: {},
      setPlan: (pkg, p) => set((s) => ({ plan: { ...s.plan, [pkgKey(pkg)]: p } })),
      clearProject: () =>
        set((s) => {
          const pre = pkgKey("");
          return { plan: Object.fromEntries(Object.entries(s.plan).filter(([k]) => !k.startsWith(pre))) };
        }),
    }),
    { name: "nobel.ops.proc-plan", partialize: (s) => ({ plan: s.plan }) },
  ),
);

export const pkgKey = (pkg: string) => `${useApp.getState().activeProjectId || "default"}:${pkg}`;
export const pkgOverrides = (plan: Record<string, PkgPlan>) => (pkg: string): PkgPlan => plan[pkgKey(pkg)] ?? { needBy: null, leadDays: null };
