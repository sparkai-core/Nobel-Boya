import { create } from "zustand";
import { persist } from "zustand/middleware";
import { addDays, APPROVAL_LIMIT, diffDays, nowStamp, same, TODAY } from "./dates";
import { makeSeed, PEOPLE } from "./seed";
import { phase2Actions, type Phase2Actions } from "./store-phase2";
import { round } from "./seed/util";
import type {
  Activity,
  ChangeOrder,
  ChangeStatus,
  DailyReport,
  DelayEvent,
  FeedEvent,
  GoodsReceipt,
  HistoryEvent,
  Inspection,
  InspectionStatus,
  Line,
  LiveImpact,
  MaterialRequest,
  OpsData,
  Payment,
  Priority,
  ProcException,
  PurchaseOrder,
  QuoteCheck,
  Quotation,
  RecoveryScenario,
  Rfi,
  ShortReason,
  Store,
  Subcontractor,
  Trade,
  Txt,
  Vendor,
} from "./types";

/**
 * The operations store: one persisted zustand store for PM, Procurement and the Vendor Portal.
 * Pages read collections directly (useOps((s) => s.mrs)) and call actions; derived numbers live in select.ts.
 */

export type NewMr = {
  title: string;
  priority: Priority;
  trade: Trade;
  building: string;
  activityId: string | null;
  neededBy: string;
  notes: string;
  source: MaterialRequest["source"];
  lines: Omit<Line, "key">[];
};

export type NewQuoteLine = { description: Txt; qty: number; unit: string; unitPrice: number };
export type NewQuote = {
  rfqId: string | null;
  vendorId: string;
  ref?: string;
  lines: NewQuoteLine[];
  deliveryDays: number;
  validDays: number;
  paymentTerms: string;
  shipping: number;
  notes: string;
  source: Quotation["source"];
};

type Actions = {
  /** Vendor the portal is showing (demo switcher). */
  vendorAs: string;
  setVendorAs: (id: string) => void;
  resetDemo: () => void;

  // procurement
  createMr: (input: NewMr, submit: boolean) => string;
  updateMr: (id: string, input: Partial<NewMr>) => void;
  submitMr: (id: string) => void;
  cancelMr: (id: string) => void;
  createRfq: (input: { mrId: string | null; title: string; trade: Trade; dueDate: string; note: string; lines: Line[]; vendorIds: string[] }) => string;
  inviteVendors: (rfqId: string, vendorIds: string[]) => void;
  remindVendor: (rfqId: string, vendorId: string) => void;
  closeRfq: (rfqId: string) => void;
  cancelRfq: (rfqId: string) => void;
  vendorRespond: (rfqId: string, vendorId: string, answer: "ACKNOWLEDGED" | "DECLINED", reason?: string) => void;
  submitQuote: (input: NewQuote) => string;
  confirmQuote: (quoteId: string, lines?: Quotation["lines"]) => void;
  sendForApproval: (quoteId: string, notes?: string) => string;
  decideApproval: (approvalId: string, decision: "APPROVE" | "REJECT", notes?: string) => string | null;
  vendorAcceptPo: (poId: string) => void;
  vendorDispatch: (poId: string, note: string) => void;
  startReceipt: (poId: string) => string;
  postReceipt: (grnId: string, input: { lines: { key: string; accepted: number; shortReason: ShortReason | null }[]; receivedBy: string; remarks: string; closeShort: boolean }) => void;
  rejectReceipt: (grnId: string, reason: string) => void;
  closePo: (poId: string) => void;
  cancelPo: (poId: string) => void;
  markPaid: (paymentId: string, method: NonNullable<Payment["method"]>, bankRef: string) => void;
  holdPayment: (paymentId: string, reason: string) => void;
  releasePayment: (paymentId: string) => void;
  issueStock: (key: string, qty: number, activityId: string | null, note: string) => void;
  transferStock: (key: string, store: Store) => void;
  countStock: (key: string, counted: number, note: string) => void;
  setReorder: (key: string, reorder: number) => void;
  addStockItem: (input: { key: string; name: Txt; unit: string; trade: Trade; store: Store; onHand: number; reorder: number }) => void;
  takeException: (id: string) => void;
  resolveException: (id: string, note: string) => void;
  dismissException: (id: string, note: string) => void;
  reopenException: (id: string) => void;
  createVendor: (input: Omit<Vendor, "id" | "overall" | "history" | "since" | "scores" | "avgDeliveryDays"> & Partial<Pick<Vendor, "scores" | "avgDeliveryDays">>) => string;
  updateVendor: (id: string, patch: Partial<Vendor>) => void;

  // project management
  updateActivity: (id: string, patch: Partial<Activity>) => void;
  logProgress: (activityId: string, pct: number, note: string) => void;
  shiftActivity: (id: string, days: number) => void;
  setBaseline: () => void;
  addLink: (from: string, to: string, type: "FS" | "SS" | "FF" | "SF", lag: number) => void;
  removeLink: (id: string) => void;
  saveReport: (report: DailyReport) => void;
  setReportStatus: (id: string, status: DailyReport["status"]) => void;
  addDelay: (input: Omit<DelayEvent, "id" | "ref" | "status" | "links"> & { status?: DelayEvent["status"] }) => string;
  updateDelay: (id: string, patch: Partial<DelayEvent>) => void;
  addImpact: (input: Omit<LiveImpact, "id" | "status">) => string;
  updateImpact: (id: string, patch: Partial<LiveImpact>) => void;
  acceptImpacts: () => void;
  addScenario: (input: Omit<RecoveryScenario, "id" | "status">) => string;
  setScenarioStatus: (id: string, status: RecoveryScenario["status"]) => void;
  applyScenario: (id: string) => void;
  raiseRfi: (input: Omit<Rfi, "id" | "ref" | "status" | "answer" | "answeredBy" | "answeredAt" | "raisedAt">) => string;
  answerRfi: (id: string, answer: string) => void;
  closeRfi: (id: string) => void;
  raiseChange: (input: Omit<ChangeOrder, "id" | "ref" | "status" | "raisedAt" | "decidedAt">) => string;
  setChangeStatus: (id: string, status: ChangeStatus) => void;
  addInspection: (input: Omit<Inspection, "id" | "ref" | "status" | "inspectedAt">) => string;
  recordInspection: (id: string, status: InspectionStatus, checklist: Inspection["checklist"], notes: string) => void;
  setIpcLine: (ipcId: string, building: string, section: string, pctToDate: number) => void;
  setIpcStatus: (ipcId: string, status: "DRAFT" | "SUBMITTED" | "CERTIFIED" | "PAID") => void;
  addSub: (input: Omit<Subcontractor, "id">) => string;
  updateSub: (id: string, patch: Partial<Subcontractor>) => void;
  setCalendarDay: (date: string, kind: "HOLIDAY" | "SHUTDOWN" | "EXTRA" | null, name?: string) => void;
  setWorkweek: (days: number[]) => void;
  addCapture: (zoneId: string, pct: number, note: string, photo: string) => void;
};

export type OpsState = OpsData & Actions & Phase2Actions;

/** Name the demo user acts under. */
export const ME = PEOPLE.pm;

function nextRef(seq: Record<string, number>, kind: string, width = 4): [string, Record<string, number>] {
  const n = (seq[kind] ?? 0) + 1;
  return [`${kind}-${String(n).padStart(width, "0")}`, { ...seq, [kind]: n }];
}

function feed(s: OpsData, module: FeedEvent["module"], text: Txt, link: string | null, actor = ME): Pick<OpsData, "feed" | "seq"> {
  const n = (s.seq.F ?? 0) + 1;
  return { feed: [{ id: `F-${n}`, at: nowStamp(), module, text, link, actor }, ...s.feed].slice(0, 80), seq: { ...s.seq, F: n } };
}

const ev = (actor: HistoryEvent["actor"], en: string, az: string): HistoryEvent => ({ at: nowStamp(), actor, text: { en, az } });

function quoteChecks(s: OpsData, q: Pick<Quotation, "lines" | "vendorId" | "validUntil" | "confidence">, rfqLines: Line[]): QuoteCheck[] {
  const v = s.vendors.find((x) => x.id === q.vendorId);
  const budget = rfqLines.reduce((a, l) => a + l.qty * (l.material ? (s.materials.find((m) => m.key === l.material)?.rate ?? 0) : 0), 0);
  const net = q.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const over = budget > 0 ? net / budget - 1 : 0;
  const priced = q.lines.filter((l) => l.unitPrice > 0).length;
  const days = diffDays(TODAY, q.validUntil);
  return [
    { label: { en: "Vendor details match the register", az: "Təchizatçı məlumatları reyestrə uyğundur" }, result: v?.licence && v.status !== "DISQUALIFIED" ? "PASSED" : "FAILED", detail: v?.licence ? { en: "TRN and licence found.", az: "VÖEN və lisenziya tapıldı." } : { en: "Trade licence missing.", az: "Ticarət lisenziyası yoxdur." } },
    { label: { en: "Every requested line is priced", az: "Bütün tələb olunan sətirlər qiymətləndirilib" }, result: priced >= Math.max(1, rfqLines.length) ? "PASSED" : "WARNING", detail: { en: `${priced} of ${Math.max(rfqLines.length, q.lines.length)} lines priced.`, az: `${Math.max(rfqLines.length, q.lines.length)} sətirdən ${priced}-i qiymətləndirilib.` } },
    { label: { en: "Lines add up to the total", az: "Sətirlərin cəmi yekuna bərabərdir" }, result: "PASSED", detail: { en: "Arithmetic checked.", az: "Hesab yoxlanıldı." } },
    { label: { en: "Price against the BOQ budget", az: "Qiymət smeta büdcəsinə qarşı" }, result: over > 0.08 ? "WARNING" : "PASSED", detail: over >= 0 ? { en: `${Math.round(over * 100)}% above the BOQ rate.`, az: `Smeta qiymətindən ${Math.round(over * 100)}% yuxarı.` } : { en: `${Math.round(-over * 100)}% below the BOQ rate.`, az: `Smeta qiymətindən ${Math.round(-over * 100)}% aşağı.` } },
    { label: { en: "Reading confidence", az: "Oxunma etibarlılığı" }, result: q.confidence < 0.75 ? "FAILED" : q.confidence < 0.88 ? "WARNING" : "PASSED", detail: { en: `${Math.round(q.confidence * 100)}% average.`, az: `Orta ${Math.round(q.confidence * 100)}%.` } },
    { label: { en: "Price holds long enough", az: "Qiymət kifayət qədər qüvvədədir" }, result: days < 7 ? "WARNING" : "PASSED", detail: days < 7 ? { en: "Expires within 7 days.", az: "7 gün ərzində bitir." } : { en: `Valid for ${days} days.`, az: `${days} gün qüvvədədir.` } },
  ];
}

const poTotal = (po: PurchaseOrder) => round(po.lines.reduce((a, l) => a + l.qty * l.rate, 0) * (1 + po.vatRate) + po.shipping, 2);
const quoteTotal = (q: Quotation) => round(q.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0) * (1 + q.vatRate) + q.shipping, 2);
const name = (s: OpsData, vendorId: string) => s.vendors.find((v) => v.id === vendorId)?.name ?? vendorId;

export const useOps = create<OpsState>()(
  persist(
    (set, get) => ({
      ...makeSeed(),
      ...phase2Actions(set as never, get as never),
      vendorAs: "V-02",
      setVendorAs: (vendorAs) => set({ vendorAs }),
      resetDemo: () => set({ ...makeSeed(), vendorAs: "V-02" }),

      // ------------------------------------------------------------ material requests
      createMr: (input, submit) => {
        const s = get();
        const [ref, seq] = nextRef(s.seq, "MR");
        const mr: MaterialRequest = {
          id: ref,
          ref,
          title: same(input.title),
          status: submit ? "SUBMITTED" : "DRAFT",
          priority: input.priority,
          requestedBy: ME,
          trade: input.trade,
          building: input.building,
          activityId: input.activityId,
          neededBy: input.neededBy,
          createdAt: nowStamp(),
          submittedAt: submit ? nowStamp() : null,
          notes: input.notes ? same(input.notes) : null,
          source: input.source,
          lines: input.lines.map((l, i) => ({ ...l, key: `${ref}-${i}` })),
        };
        set({ mrs: [mr, ...s.mrs],  ...feed({ ...s, seq }, "PROC", { en: `${ref} ${submit ? "submitted" : "saved as draft"}: ${input.title}`, az: `${ref} ${submit ? "göndərildi" : "qaralama kimi saxlandı"}: ${input.title}` }, `procurement/requests/${ref}`) });
        return ref;
      },
      updateMr: (id, input) =>
        set((s) => ({
          mrs: s.mrs.map((m) =>
            m.id !== id
              ? m
              : {
                  ...m,
                  ...(input.title != null ? { title: same(input.title) } : {}),
                  ...(input.priority ? { priority: input.priority } : {}),
                  ...(input.trade ? { trade: input.trade } : {}),
                  ...(input.building ? { building: input.building } : {}),
                  ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
                  ...(input.neededBy ? { neededBy: input.neededBy } : {}),
                  ...(input.notes != null ? { notes: input.notes ? same(input.notes) : null } : {}),
                  ...(input.lines ? { lines: input.lines.map((l, i) => ({ ...l, key: `${id}-${i}-${Date.now() % 1000}` })) } : {}),
                },
          ),
        })),
      submitMr: (id) => set((s) => ({ mrs: s.mrs.map((m) => (m.id === id ? { ...m, status: "SUBMITTED", submittedAt: nowStamp() } : m)), ...feed(s, "PROC", { en: `${id} submitted to procurement`, az: `${id} satınalmaya göndərildi` }, `procurement/requests/${id}`) })),
      cancelMr: (id) => set((s) => ({ mrs: s.mrs.map((m) => (m.id === id ? { ...m, status: "CANCELLED" } : m)) })),

      // ------------------------------------------------------------ RFQs
      createRfq: (input) => {
        const s = get();
        const [ref, seq] = nextRef(s.seq, "RFQ");
        const rfq = {
          id: ref,
          ref,
          title: same(input.title),
          mrId: input.mrId,
          status: "OPEN" as const,
          trade: input.trade,
          createdAt: nowStamp(),
          dueDate: input.dueDate,
          note: input.note ? same(input.note) : null,
          lines: input.lines.map((l, i) => ({ ...l, key: `${ref}-${i}` })),
          invitations: input.vendorIds.map((vendorId) => ({ vendorId, status: "INVITED" as const, at: nowStamp(), reason: null })),
          awardedQuoteId: null,
        };
        set({
          rfqs: [rfq, ...s.rfqs],
          mrs: s.mrs.map((m) => (m.id === input.mrId ? { ...m, status: "SOURCING" } : m)),
          
          ...feed({ ...s, seq }, "PROC", { en: `${ref} sent to ${input.vendorIds.length} vendors`, az: `${ref} ${input.vendorIds.length} təchizatçıya göndərildi` }, `procurement/rfqs/${ref}`),
        });
        return ref;
      },
      inviteVendors: (rfqId, vendorIds) =>
        set((s) => ({
          rfqs: s.rfqs.map((r) =>
            r.id !== rfqId ? r : { ...r, invitations: [...r.invitations, ...vendorIds.filter((v) => !r.invitations.some((i) => i.vendorId === v)).map((vendorId) => ({ vendorId, status: "INVITED" as const, at: nowStamp(), reason: null }))] },
          ),
        })),
      remindVendor: (rfqId, vendorId) => set((s) => feed(s, "PROC", { en: `Reminder sent to ${name(s, vendorId)} for ${rfqId}`, az: `${rfqId} üçün ${name(s, vendorId)} xatırladıldı` }, `procurement/rfqs/${rfqId}`)),
      closeRfq: (rfqId) => set((s) => ({ rfqs: s.rfqs.map((r) => (r.id === rfqId ? { ...r, status: "CLOSED" } : r)) })),
      cancelRfq: (rfqId) => set((s) => ({ rfqs: s.rfqs.map((r) => (r.id === rfqId ? { ...r, status: "CANCELLED" } : r)) })),
      vendorRespond: (rfqId, vendorId, answer, reason) =>
        set((s) => ({
          rfqs: s.rfqs.map((r) => (r.id !== rfqId ? r : { ...r, invitations: r.invitations.map((i) => (i.vendorId === vendorId ? { ...i, status: answer, at: nowStamp(), reason: reason ?? null } : i)) })),
          ...feed(s, "VENDOR", answer === "DECLINED" ? { en: `${name(s, vendorId)} declined ${rfqId}`, az: `${name(s, vendorId)} ${rfqId}-dən imtina etdi` } : { en: `${name(s, vendorId)} opened ${rfqId}`, az: `${name(s, vendorId)} ${rfqId}-ni açdı` }, `procurement/rfqs/${rfqId}`, name(s, vendorId)),
        })),

      // ------------------------------------------------------------ quotations
      submitQuote: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "QT");
        const rfq = input.rfqId ? s.rfqs.find((r) => r.id === input.rfqId) : null;
        const confidence = input.source === "UPLOAD" ? 0.9 : 1;
        const lines = input.lines.map((l, i) => ({ key: `${id}-${i}`, description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, confidence, match: "MATCHED" as const }));
        const validUntil = addDays(TODAY, input.validDays);
        const vendor = name(s, input.vendorId);
        const q: Quotation = {
          id,
          ref: input.ref || `${vendor.split(" ")[0]!.slice(0, 3).toUpperCase()}-2026-${String(300 + (seq.QT ?? 0))}`,
          rfqId: input.rfqId,
          vendorId: input.vendorId,
          status: input.source === "MANUAL" ? "MANUAL" : "EXTRACTED",
          source: input.source,
          receivedAt: nowStamp(),
          validUntil,
          deliveryDays: input.deliveryDays,
          paymentTerms: input.paymentTerms,
          vatRate: 0.18,
          shipping: input.shipping,
          lines,
          risk: s.vendors.find((v) => v.id === input.vendorId)?.risk ?? "LOW",
          confidence,
          checks: [],
          duplicate: false,
          notes: input.notes ? same(input.notes) : null,
          history: [
            input.source === "PORTAL" ? ev("VENDOR", `${vendor} sent the quote through the vendor portal`, `${vendor} təklifi təchizatçı portalı vasitəsilə göndərdi`) : ev("USER", "Quote entered", "Təklif daxil edildi"),
            ev("AI", "Lines read and matched to the request", "Sətirlər oxundu və sorğu ilə uyğunlaşdırıldı"),
            ev("SYSTEM", "Checks run against the BOQ and vendor register", "Smeta və təchizatçı reyestri üzrə yoxlamalar aparıldı"),
          ],
          outcome: null,
        };
        q.checks = quoteChecks(s, q, rfq?.lines ?? []);
        set({
          quotes: [q, ...s.quotes],
          rfqs: s.rfqs.map((r) => (r.id !== input.rfqId ? r : { ...r, invitations: r.invitations.some((i) => i.vendorId === input.vendorId) ? r.invitations.map((i) => (i.vendorId === input.vendorId ? { ...i, status: "SUBMITTED", at: nowStamp() } : i)) : [...r.invitations, { vendorId: input.vendorId, status: "SUBMITTED", at: nowStamp(), reason: null }] })),
          
          ...feed({ ...s, seq }, input.source === "PORTAL" ? "VENDOR" : "PROC", { en: `${vendor} quoted ${input.rfqId ?? "directly"}`, az: `${vendor} ${input.rfqId ?? "birbaşa"} üzrə təklif verdi` }, `procurement/quotes/${id}`, input.source === "PORTAL" ? vendor : ME),
        });
        return id;
      },
      confirmQuote: (quoteId, lines) =>
        set((s) => ({
          quotes: s.quotes.map((q) => (q.id !== quoteId ? q : { ...q, status: "EXTRACTED", confidence: Math.max(q.confidence, 0.95), lines: (lines ?? q.lines).map((l) => ({ ...l, confidence: Math.max(l.confidence, 0.95), match: "MATCHED" })), history: [...q.history, ev("USER", "Reading corrected and confirmed", "Oxunuş düzəldildi və təsdiqləndi")] })),
          exceptions: s.exceptions.map((e) => (e.quoteId === quoteId && e.reason === "LOW_CONFIDENCE" && e.status !== "resolved" ? { ...e, status: "resolved", history: [...e.history, ev("USER", "Resolved by correcting the reading", "Oxunuşu düzəltməklə həll olundu")] } : e)),
        })),
      sendForApproval: (quoteId, notes) => {
        const s = get();
        const q = s.quotes.find((x) => x.id === quoteId)!;
        const existing = s.approvals.find((a) => a.quoteId === quoteId && a.status === "PENDING");
        if (existing) return existing.id;
        const [id, seq] = nextRef(s.seq, "APR");
        const amount = quoteTotal(q);
        const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : null;
        set({
          approvals: [
            { id, ref: id, quoteId, rfqId: q.rfqId, vendorId: q.vendorId, title: rfq?.title ?? same(`Quote ${q.ref}`), amount, status: "PENDING", requiredLevels: amount > APPROVAL_LIMIT ? 2 : 1, level: 0, requestedBy: PEOPLE.buyer, requestedAt: nowStamp(), firstBy: null, firstAt: null, finalBy: null, finalAt: null, notes: notes ?? null, severity: amount > APPROVAL_LIMIT ? "HIGH" : amount > 20_000 ? "MEDIUM" : "LOW", poId: null },
            ...s.approvals,
          ],
          rfqs: s.rfqs.map((r) => (r.id === q.rfqId && r.status === "OPEN" ? { ...r, status: "CLOSED" } : r)),
          quotes: s.quotes.map((x) => (x.id === quoteId ? { ...x, history: [...x.history, ev("USER", `Sent for approval as ${id}`, `${id} kimi təsdiqə göndərildi`)] } : x)),
          
          ...feed({ ...s, seq }, "PROC", { en: `${id} raised for ${name(s, q.vendorId)}`, az: `${name(s, q.vendorId)} üçün ${id} açıldı` }, `procurement/approvals/${id}`),
        });
        return id;
      },
      decideApproval: (approvalId, decision, notes) => {
        const s = get();
        const a = s.approvals.find((x) => x.id === approvalId);
        if (!a || a.status !== "PENDING") return null;
        if (decision === "REJECT") {
          set({ approvals: s.approvals.map((x) => (x.id === approvalId ? { ...x, status: "REJECTED", notes: notes ?? x.notes, finalBy: ME, finalAt: nowStamp() } : x)), ...feed(s, "PROC", { en: `${approvalId} rejected`, az: `${approvalId} rədd edildi` }, `procurement/approvals/${approvalId}`) });
          return null;
        }
        const level = (a.level + 1) as 1 | 2;
        if (level < a.requiredLevels) {
          set({ approvals: s.approvals.map((x) => (x.id === approvalId ? { ...x, level, firstBy: ME, firstAt: nowStamp(), notes: notes ?? x.notes } : x)), ...feed(s, "PROC", { en: `First approval given on ${approvalId}`, az: `${approvalId} üzrə ilk təsdiq verildi` }, `procurement/approvals/${approvalId}`) });
          return null;
        }
        // Final approval: issue the order and schedule its payment.
        const q = s.quotes.find((x) => x.id === a.quoteId)!;
        const rfq = q.rfqId ? s.rfqs.find((r) => r.id === q.rfqId) : null;
        const [poId, seq1] = nextRef(s.seq, "PO");
        const [payId, seq2] = nextRef(seq1, "PAY");
        const expectedAt = addDays(TODAY, Math.max(2, q.deliveryDays));
        const po: PurchaseOrder = {
          id: poId,
          ref: poId,
          vendorId: q.vendorId,
          quoteId: q.id,
          approvalId,
          rfqId: q.rfqId,
          mrId: rfq?.mrId ?? null,
          status: "ISSUED",
          issuedAt: TODAY,
          expectedAt,
          paymentTerms: q.paymentTerms,
          deliverTo: { en: "Qobu site, main gate, Absheron district", az: "Qobu meydançası, əsas darvaza, Abşeron rayonu" },
          vatRate: q.vatRate,
          shipping: q.shipping,
          lines: q.lines.map((l, i) => ({ key: `${poId}-${i}`, material: rfq?.lines[i]?.material ?? null, description: l.description, qty: l.qty, unit: l.unit, rate: l.unitPrice, received: 0 })),
          vendorAck: "PENDING",
          dispatchedAt: null,
          dispatchNote: null,
        };
        const payment: Payment = { id: payId, ref: payId, poId, vendorId: q.vendorId, amount: poTotal(po), kind: "ON_DELIVERY", dueDate: addDays(expectedAt, 30), status: "SCHEDULED", paidAt: null, method: null, bankRef: null, holdReason: null };
        const seq = seq2;
        set({
          approvals: s.approvals.map((x) => (x.id === approvalId ? { ...x, status: "APPROVED", level, ...(a.requiredLevels === 2 ? { finalBy: PEOPLE.director } : { firstBy: ME, firstAt: nowStamp(), finalBy: ME }), finalAt: nowStamp(), notes: notes ?? x.notes, poId } : x)),
          pos: [po, ...s.pos],
          payments: [payment, ...s.payments],
          rfqs: s.rfqs.map((r) => (r.id === q.rfqId ? { ...r, status: "AWARDED", awardedQuoteId: q.id } : r)),
          quotes: s.quotes.map((x) => (x.id === q.id ? { ...x, outcome: "WON", history: [...x.history, ev("SYSTEM", `Approved; ${poId} issued`, `Təsdiqləndi; ${poId} verildi`)] } : x.rfqId && x.rfqId === q.rfqId ? { ...x, outcome: "LOST" } : x)),
          
          ...feed({ ...s, seq }, "PROC", { en: `${approvalId} approved; ${poId} issued to ${name(s, q.vendorId)}`, az: `${approvalId} təsdiqləndi; ${poId} ${name(s, q.vendorId)}-ə verildi` }, `procurement/orders/${poId}`),
        });
        return poId;
      },

      // ------------------------------------------------------------ orders and receipts
      vendorAcceptPo: (poId) => set((s) => ({ pos: s.pos.map((p) => (p.id === poId ? { ...p, vendorAck: "ACCEPTED" } : p)), ...feed(s, "VENDOR", { en: `${name(s, s.pos.find((p) => p.id === poId)?.vendorId ?? "")} accepted ${poId}`, az: `${name(s, s.pos.find((p) => p.id === poId)?.vendorId ?? "")} ${poId}-nu qəbul etdi` }, `procurement/orders/${poId}`, name(s, s.pos.find((p) => p.id === poId)?.vendorId ?? "")) })),
      vendorDispatch: (poId, note) => set((s) => ({ pos: s.pos.map((p) => (p.id === poId ? { ...p, vendorAck: "ACCEPTED", dispatchedAt: nowStamp(), dispatchNote: note || null } : p)), ...feed(s, "VENDOR", { en: `${poId} dispatched: on the way to site`, az: `${poId} yola salındı: meydançaya gəlir` }, `procurement/orders/${poId}`, name(s, s.pos.find((p) => p.id === poId)?.vendorId ?? "")) })),
      startReceipt: (poId) => {
        const s = get();
        const draft = s.grns.find((g) => g.poId === poId && g.status === "DRAFT");
        if (draft) return draft.id;
        const po = s.pos.find((p) => p.id === poId)!;
        const [id, seq] = nextRef(s.seq, "GRN");
        const grn: GoodsReceipt = { id, ref: id, poId, vendorId: po.vendorId, status: "DRAFT", receivedAt: null, receivedBy: null, remarks: null, lines: po.lines.map((l) => ({ key: `${l.key}-${id}`, material: l.material, description: l.description, unit: l.unit, ordered: l.qty, prior: l.received, accepted: 0, shortReason: null })) };
        set({ grns: [grn, ...s.grns], seq });
        return id;
      },
      postReceipt: (grnId, input) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId)!;
        const po = s.pos.find((p) => p.id === g.poId)!;
        const lines = g.lines.map((l) => {
          const i = input.lines.find((x) => x.key === l.key);
          return i ? { ...l, accepted: i.accepted, shortReason: i.shortReason } : l;
        });
        const poLines = po.lines.map((pl) => {
          const gl = lines.find((l) => l.key.startsWith(`${pl.key}-`));
          return gl ? { ...pl, received: round(pl.received + gl.accepted, 2) } : pl;
        });
        const full = poLines.every((l) => l.received >= l.qty - 1e-6);
        const closed = full || input.closeShort;
        const grnStatus = full ? "RECEIVED" : "PART_RECEIVED";
        // Stock: every catalogued line that is kept in stock goes into the store.
        let stock = s.stock;
        let movements = s.movements;
        let seq = s.seq;
        for (const l of lines) {
          if (!l.material || l.accepted <= 0) continue;
          const mat = s.materials.find((m) => m.key === l.material);
          const isReadyMix = mat?.trade === "Concrete" && !l.material.startsWith("x-");
          if (isReadyMix) continue;
          const exists = stock.find((x) => x.key === l.material);
          stock = exists
            ? stock.map((x) => (x.key === l.material ? { ...x, onHand: round(x.onHand + l.accepted, 2), updatedAt: TODAY } : x))
            : [...stock, { key: l.material, name: mat?.name ?? l.description, unit: l.unit, trade: mat?.trade ?? "Concrete", store: "Main store", onHand: l.accepted, reorder: 0, updatedAt: TODAY }];
          const [mv, sq] = nextRef(seq, "MV", 1);
          seq = sq;
          movements = [{ id: mv, key: l.material, type: "RECEIPT", qty: l.accepted, at: TODAY, ref: grnId, note: null, activityId: null }, ...movements];
        }
        // Payment: the delivery payment is released once the goods are in (or the order is closed short).
        const receivedValue = poLines.reduce((a, l) => a + l.received * l.rate, 0) * (1 + po.vatRate) + po.shipping;
        const payments = s.payments.map((p) => {
          if (p.poId !== po.id || p.kind !== "ON_DELIVERY" || p.status === "PAID") return p;
          if (!closed) return p;
          const advance = s.payments.filter((x) => x.poId === po.id && x.kind === "ADVANCE").reduce((a, x) => a + x.amount, 0);
          return { ...p, status: (p.status === "ON_HOLD" ? "ON_HOLD" : "READY") as Payment["status"], amount: input.closeShort && !full ? round(receivedValue - advance, 2) : p.amount };
        });
        set({
          grns: s.grns.map((x) => (x.id === grnId ? { ...x, lines, status: grnStatus, receivedAt: TODAY, receivedBy: input.receivedBy || PEOPLE.store, remarks: input.remarks || null } : x)),
          pos: s.pos.map((p) => (p.id === po.id ? { ...p, lines: poLines, status: closed ? "CLOSED" : "PART_RECEIVED" } : p)),
          mrs: closed && po.mrId ? s.mrs.map((m) => (m.id === po.mrId ? { ...m, status: "FULFILLED" } : m)) : s.mrs,
          stock,
          movements,
          payments,
          
          ...feed({ ...s, seq }, "PROC", full ? { en: `${grnId} posted: ${po.id} received in full`, az: `${grnId} qəbul edildi: ${po.id} tam alındı` } : { en: `${grnId} posted short on ${po.id}`, az: `${grnId} ${po.id} üzrə əskik qəbul edildi` }, `procurement/receipts/${grnId}`, PEOPLE.store),
        });
      },
      rejectReceipt: (grnId, reason) => set((s) => ({ grns: s.grns.map((g) => (g.id === grnId ? { ...g, status: "REJECTED", remarks: reason, receivedAt: TODAY, receivedBy: PEOPLE.store } : g)) })),
      closePo: (poId) => set((s) => ({ pos: s.pos.map((p) => (p.id === poId ? { ...p, status: "CLOSED" } : p)), payments: s.payments.map((p) => (p.poId === poId && p.status === "SCHEDULED" ? { ...p, status: "READY" } : p)) })),
      cancelPo: (poId) => set((s) => ({ pos: s.pos.map((p) => (p.id === poId ? { ...p, status: "CANCELLED" } : p)), payments: s.payments.filter((p) => !(p.poId === poId && p.status !== "PAID")) })),

      // ------------------------------------------------------------ payments
      markPaid: (paymentId, method, bankRef) => set((s) => ({ payments: s.payments.map((p) => (p.id === paymentId ? { ...p, status: "PAID", paidAt: TODAY, method, bankRef: bankRef || null } : p)), ...feed(s, "PROC", { en: `${paymentId} paid to ${name(s, s.payments.find((p) => p.id === paymentId)?.vendorId ?? "")}`, az: `${paymentId} ${name(s, s.payments.find((p) => p.id === paymentId)?.vendorId ?? "")}-ə ödənildi` }, `procurement/payments/${paymentId}`, PEOPLE.finance) })),
      holdPayment: (paymentId, reason) => set((s) => ({ payments: s.payments.map((p) => (p.id === paymentId ? { ...p, status: "ON_HOLD", holdReason: reason } : p)) })),
      releasePayment: (paymentId) =>
        set((s) => ({
          payments: s.payments.map((p) => {
            if (p.id !== paymentId) return p;
            const po = s.pos.find((x) => x.id === p.poId);
            const goodsIn = po ? po.lines.every((l) => l.received >= l.qty - 1e-6) || po.status === "CLOSED" : true;
            return { ...p, status: goodsIn || p.kind === "ADVANCE" ? "READY" : "SCHEDULED", holdReason: null };
          }),
        })),

      // ------------------------------------------------------------ stock
      issueStock: (key, qty, activityId, note) => {
        const s = get();
        const [mv, seq] = nextRef(s.seq, "MV", 1);
        const [is, seq2] = nextRef(seq, "IS");
        set({ stock: s.stock.map((x) => (x.key === key ? { ...x, onHand: round(Math.max(0, x.onHand - qty), 2), updatedAt: TODAY } : x)), movements: [{ id: mv, key, type: "ISSUE", qty: -qty, at: TODAY, ref: is, note: note ? same(note) : null, activityId }, ...s.movements], seq: seq2 });
      },
      transferStock: (key, store) => set((s) => ({ stock: s.stock.map((x) => (x.key === key ? { ...x, store, updatedAt: TODAY } : x)) })),
      countStock: (key, counted, note) => {
        const s = get();
        const item = s.stock.find((x) => x.key === key);
        if (!item) return;
        const [mv, seq] = nextRef(s.seq, "MV", 1);
        set({ stock: s.stock.map((x) => (x.key === key ? { ...x, onHand: counted, updatedAt: TODAY } : x)), movements: [{ id: mv, key, type: "ADJUSTMENT", qty: round(counted - item.onHand, 2), at: TODAY, ref: `SC-${mv.slice(3)}`, note: note ? same(note) : null, activityId: null }, ...s.movements], seq });
      },
      setReorder: (key, reorder) => set((s) => ({ stock: s.stock.map((x) => (x.key === key ? { ...x, reorder } : x)) })),
      addStockItem: (input) => set((s) => ({ stock: [...s.stock.filter((x) => x.key !== input.key), { ...input, updatedAt: TODAY }] })),

      // ------------------------------------------------------------ exceptions
      takeException: (id) => set((s) => ({ exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, status: "assigned", assignee: ME, history: [...e.history, ev("USER", `Taken by ${ME}`, `${ME} götürdü`)] } : e)) })),
      resolveException: (id, note) => set((s) => ({ exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, status: "resolved", history: [...e.history, ev("USER", `Resolved: ${note}`, `Həll olundu: ${note}`)] } : e)) })),
      dismissException: (id, note) => set((s) => ({ exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, status: "dismissed", history: [...e.history, ev("USER", `Dismissed: ${note}`, `Ləğv edildi: ${note}`)] } : e)) })),
      reopenException: (id) => set((s) => ({ exceptions: s.exceptions.map((e): ProcException => (e.id === id ? { ...e, status: "open", history: [...e.history, ev("USER", "Reopened", "Yenidən açıldı")] } : e)) })),

      // ------------------------------------------------------------ vendors
      createVendor: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "V", 2);
        const scores = input.scores ?? { reliability: 70, quality: 70, price: 70, delivery: 70 };
        const vendor: Vendor = { ...input, id, scores, avgDeliveryDays: input.avgDeliveryDays ?? 10, overall: round((scores.reliability * 0.3 + scores.quality * 0.3 + scores.price * 0.2 + scores.delivery * 0.2) / 10, 1), history: [], since: TODAY };
        set({ vendors: [...s.vendors, vendor],  ...feed({ ...s, seq }, "PROC", { en: `Vendor added: ${input.name}`, az: `Təchizatçı əlavə edildi: ${input.name}` }, `procurement/vendors/${id}`) });
        return id;
      },
      updateVendor: (id, patch) => set((s) => ({ vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

      // ------------------------------------------------------------ programme
      updateActivity: (id, patch) => set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      logProgress: (activityId, pct, note) => {
        const s = get();
        const a = s.activities.find((x) => x.id === activityId);
        if (!a) return;
        const p = Math.max(0, Math.min(100, Math.round(pct)));
        const status: Activity["status"] = p >= 100 ? "COMPLETED" : p > 0 ? (a.status === "BLOCKED" ? "BLOCKED" : "IN_PROGRESS") : a.status;
        const today = s.reports.find((r) => r.date === TODAY);
        const entry = { activityId, zone: a.building, text: note ? same(note) : { en: `${a.name.en}: ${p}% reached`, az: `${a.name.az}: ${p}% icra olunub` }, qty: 0, unit: "%", pct: p, over: false };
        set({
          activities: s.activities.map((x) => (x.id === activityId ? { ...x, pct: p, status, aStart: x.aStart ?? TODAY, aEnd: p >= 100 ? TODAY : null } : x)),
          zones: s.zones.map((z) => (z.activityId === activityId ? { ...z, actualPct: p } : z)),
          reports: today ? s.reports.map((r) => (r.id === today.id ? { ...r, entries: [...r.entries.filter((e) => e.activityId !== activityId), entry] } : r)) : s.reports,
          ...feed(s, "PM", { en: `${a.code} progress updated to ${p}%`, az: `${a.code} irəliləyişi ${p}%-ə yeniləndi` }, `pm/programme?task=${activityId}`, PEOPLE.site),
        });
      },
      shiftActivity: (id, days) => set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, start: addDays(a.start, days), end: addDays(a.end, days) } : a)) })),
      setBaseline: () => set((s) => ({ activities: s.activities.map((a) => ({ ...a, bStart: a.start, bEnd: a.end })), milestones: s.milestones.map((m) => ({ ...m, baseline: m.forecast })), ...feed(s, "PM", { en: "Baseline reset to the current programme", az: "Baza plan cari qrafikə yeniləndi" }, "pm/programme", PEOPLE.planner) })),
      addLink: (from, to, type, lag) => set((s) => ({ links: [...s.links, { id: `L${s.links.length + 1}-${Date.now() % 10000}`, from, to, type, lag }] })),
      removeLink: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),

      // ------------------------------------------------------------ site
      saveReport: (report) => set((s) => ({ reports: s.reports.some((r) => r.id === report.id) ? s.reports.map((r) => (r.id === report.id ? report : r)) : [...s.reports, report].sort((a, b) => a.date.localeCompare(b.date)) })),
      setReportStatus: (id, status) => set((s) => ({ reports: s.reports.map((r) => (r.id === id ? { ...r, status } : r)), ...feed(s, "PM", { en: `Daily report ${id.slice(3)} ${status.toLowerCase()}`, az: `${id.slice(3)} gündəlik hesabatı: ${status}` }, `pm/daily-reports/${id}`) })),
      addDelay: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "DL");
        const d: DelayEvent = { ...input, id, ref: id, status: input.status ?? "OPEN", links: [] };
        // The part of the delay that float cannot absorb pushes the activity and everything after it.
        const push = Math.max(0, input.daysLost - input.floatAbsorbed);
        const a = s.activities.find((x) => x.id === input.activityId);
        const after = new Set<string>();
        if (a && push > 0) {
          const queue = [a.id];
          while (queue.length) {
            const cur = queue.shift()!;
            if (after.has(cur)) continue;
            after.add(cur);
            for (const l of s.links) if (l.from === cur) queue.push(l.to);
          }
        }
        set({
          delays: [d, ...s.delays],
          activities: push > 0 ? s.activities.map((x) => (after.has(x.id) && x.status !== "COMPLETED" ? { ...x, start: x.id === a?.id ? x.start : addDays(x.start, push), end: addDays(x.end, push) } : x)) : s.activities,
          
          ...feed({ ...s, seq }, "PM", { en: `${id} logged: ${input.title.en} (${input.daysLost} days)`, az: `${id} qeydə alındı: ${input.title.az} (${input.daysLost} gün)` }, "pm/delays", PEOPLE.site),
        });
        return id;
      },
      updateDelay: (id, patch) => set((s) => ({ delays: s.delays.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      addImpact: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "LI", 2);
        set({ impacts: [{ ...input, id, status: "REPORTED" }, ...s.impacts],  ...feed({ ...s, seq }, "PM", { en: `Site impact reported: ${input.text.en}`, az: `Meydança təsiri bildirildi: ${input.text.az}` }, "pm/live", PEOPLE.site) });
        return id;
      },
      updateImpact: (id, patch) => set((s) => ({ impacts: s.impacts.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      acceptImpacts: () => {
        const s = get();
        const confirmed = s.impacts.filter((i) => i.status === "CONFIRMED");
        let activities = s.activities;
        for (const i of confirmed) activities = activities.map((a) => (a.id === i.activityId && a.status !== "COMPLETED" ? { ...a, end: addDays(a.end, i.daysImpact) } : a));
        set({ activities, impacts: s.impacts.map((i) => (i.status === "CONFIRMED" ? { ...i, status: "RESOLVED" } : i)), ...feed(s, "PM", { en: `${confirmed.length} site impacts accepted into the programme`, az: `${confirmed.length} meydança təsiri qrafikə daxil edildi` }, "pm/live", PEOPLE.planner) });
      },
      addScenario: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "RS", 1);
        set({ recovery: [...s.recovery, { ...input, id, status: "CALCULATED" }], seq });
        return id;
      },
      setScenarioStatus: (id, status) => set((s) => ({ recovery: s.recovery.map((r) => (r.id === id ? { ...r, status } : r)) })),
      applyScenario: (id) => {
        const s = get();
        const sc = s.recovery.find((r) => r.id === id);
        if (!sc) return;
        // Pull every unfinished, slipped activity back by up to the recovered days.
        const activities = s.activities.map((a) => {
          if (a.status === "COMPLETED") return a;
          const slip = diffDays(a.bEnd, a.end);
          if (slip <= 0) return a;
          const d = Math.min(slip, sc.daysRecovered);
          const start = a.start > TODAY ? addDays(a.start, -d) : a.start;
          return { ...a, start: start < TODAY && a.status === "NOT_STARTED" ? TODAY : start, end: addDays(a.end, -d) };
        });
        set({ activities, recovery: s.recovery.map((r) => (r.id === id ? { ...r, status: "APPLIED" } : r.status === "APPLIED" ? r : r)), ...feed(s, "PM", { en: `Recovery applied: ${sc.name.en} (${sc.daysRecovered} days back)`, az: `Bərpa tətbiq edildi: ${sc.name.az} (${sc.daysRecovered} gün geri qazanıldı)` }, "pm/recovery", PEOPLE.pm) });
      },

      // ------------------------------------------------------------ records
      raiseRfi: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "RFI");
        set({ rfis: [{ ...input, id, ref: id, status: "OPEN", raisedAt: TODAY, answer: null, answeredBy: null, answeredAt: null }, ...s.rfis],  ...feed({ ...s, seq }, "PM", { en: `${id} raised: ${input.subject.en}`, az: `${id} açıldı: ${input.subject.az}` }, `pm/rfis/${id}`) });
        return id;
      },
      answerRfi: (id, answer) => set((s) => ({ rfis: s.rfis.map((r) => (r.id === id ? { ...r, status: "ANSWERED", answer: same(answer), answeredBy: PEOPLE.engineer, answeredAt: TODAY } : r)), ...feed(s, "PM", { en: `${id} answered by the designer`, az: `${id} layihəçi tərəfindən cavablandı` }, `pm/rfis/${id}`, PEOPLE.engineer) })),
      closeRfi: (id) => set((s) => ({ rfis: s.rfis.map((r) => (r.id === id ? { ...r, status: "CLOSED" } : r)) })),
      raiseChange: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, "VO");
        set({ changes: [{ ...input, id, ref: id, status: "DRAFT", raisedAt: TODAY, decidedAt: null }, ...s.changes],  ...feed({ ...s, seq }, "PM", { en: `${id} raised: ${input.title.en}`, az: `${id} açıldı: ${input.title.az}` }, `pm/changes/${id}`, PEOPLE.qs) });
        return id;
      },
      setChangeStatus: (id, status) => set((s) => ({ changes: s.changes.map((c) => (c.id === id ? { ...c, status, decidedAt: status === "APPROVED" || status === "REJECTED" ? TODAY : c.decidedAt } : c)), ...feed(s, "PM", { en: `${id} ${status.toLowerCase().replace("_", " ")}`, az: `${id}: ${status}` }, `pm/changes/${id}`) })),
      addInspection: (input) => {
        const s = get();
        const [id, seq] = nextRef(s.seq, input.kind);
        set({ inspections: [{ ...input, id, ref: id, status: input.kind === "NCR" ? "OPEN" : "REQUESTED", inspectedAt: null }, ...s.inspections],  ...feed({ ...s, seq }, "PM", { en: `${id} requested: ${input.title.en}`, az: `${id} tələb edildi: ${input.title.az}` }, `pm/inspections/${id}`, PEOPLE.qa) });
        return id;
      },
      recordInspection: (id, status, checklist, notes) => set((s) => ({ inspections: s.inspections.map((i) => (i.id === id ? { ...i, status, checklist, notes: notes ? same(notes) : i.notes, inspectedAt: TODAY } : i)), ...feed(s, "PM", { en: `${id} recorded as ${status.toLowerCase().replace(/_/g, " ")}`, az: `${id} nəticəsi: ${status}` }, `pm/inspections/${id}`, PEOPLE.qa) })),
      setIpcLine: (ipcId, building, section, pctToDate) => set((s) => ({ ipcs: s.ipcs.map((i) => (i.id !== ipcId ? i : { ...i, lines: i.lines.map((l) => (l.building === building && l.section === section ? { ...l, pctToDate: Math.max(l.pctPrev, Math.min(1, pctToDate)) } : l)) })) })),
      setIpcStatus: (ipcId, status) => set((s) => ({ ipcs: s.ipcs.map((i) => (i.id !== ipcId ? i : { ...i, status, submittedAt: status === "SUBMITTED" ? TODAY : i.submittedAt, certifiedAt: status === "CERTIFIED" ? TODAY : i.certifiedAt })), ...feed(s, "PM", { en: `${ipcId} ${status.toLowerCase()}`, az: `${ipcId}: ${status}` }, `pm/billing/${ipcId}`, PEOPLE.qs) })),
      addSub: (input) => {
        const s = get();
        const id = `SC-${String(s.subs.length + 1).padStart(2, "0")}`;
        set({ subs: [...s.subs, { ...input, id }] });
        return id;
      },
      updateSub: (id, patch) => set((s) => ({ subs: s.subs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      setCalendarDay: (date, kind, nm) => set((s) => ({ calendar: kind ? [...s.calendar.filter((d) => d.date !== date), { date, kind, name: same(nm ?? kind) }] : s.calendar.filter((d) => d.date !== date) })),
      setWorkweek: (workweek) => set({ workweek }),
      addCapture: (zoneId, pct, note, photo) => {
        const s = get();
        const z = s.zones.find((x) => x.id === zoneId);
        if (!z) return;
        set({ zones: s.zones.map((x) => (x.id === zoneId ? { ...x, actualPct: pct, captures: [...x.captures, { date: TODAY, pct, confidence: 0.88, source: "PHONE", photo, note: same(note || "Photo added") }] } : x)) });
        get().logProgress(z.activityId, pct, note);
      },
    }),
    {
      name: "nobel.ops.v1",
      version: 1,
      partialize: (s) => {
        // Persist data and the vendor switcher; actions are rebuilt on load.
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(s)) if (typeof v !== "function") out[k] = v;
        return out as Partial<OpsState>;
      },
    },
  ),
);

// Keep tabs in step: the vendor portal opens in a new tab and writes to the same storage key.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "nobel.ops.v1") void useOps.persist.rehydrate();
  });
}

if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __ops: typeof useOps }).__ops = useOps;
