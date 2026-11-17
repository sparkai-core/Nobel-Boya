import { addDays, diffDays, nowStamp, same, TODAY } from "./dates";
import { PEOPLE } from "./seed";
import { round } from "./seed/util";
import type { Activity, FeedEvent, Invoice, InvoiceLine, OpsData, PurchaseOrder, Tool, Txt, Vendor } from "./types";

/** Collections that hold records with an `id`, usable with the generic helpers. */
export type ListKey = { [K in keyof OpsData]: OpsData[K] extends Array<{ id: string }> ? K : never }[keyof OpsData];
export type ItemOf<K extends ListKey> = OpsData[K] extends Array<infer T> ? T : never;

export type ImportResult = {
  programmeId: string;
  revId: string;
  /** Finish date before and after, and per-activity changes. */
  finishBefore: string;
  finishAfter: string;
  changed: number;
  added: number;
  removed: number;
};

export type Phase2Actions = {
  /** Next number of a kind, e.g. nextRef("INC") → "INC-0004". Updates the counter. */
  nextRef: (kind: string, width?: number) => string;
  /** Generic: append a record (its id must be set; use nextRef for a new one). */
  addItem: <K extends ListKey>(key: K, item: ItemOf<K>, front?: boolean) => void;
  /** Generic: merge a patch into a record by id. */
  patchItem: <K extends ListKey>(key: K, id: string, patch: Partial<ItemOf<K>>) => void;
  /** Generic: remove a record by id. */
  removeItem: <K extends ListKey>(key: K, id: string) => void;
  /** Add an event to the live feed (shown on dashboards and in notifications). */
  pushFeed: (module: FeedEvent["module"], text: Txt, link: string | null, actor?: string) => void;

  // planning and progress
  importProgramme: (input: { file: string; tool: Tool; mode: "NEW" | "REVISION"; name: string }) => ImportResult;
  /** Preview what an import would change, without saving. */
  previewImport: (file: string, tool: Tool) => Omit<ImportResult, "programmeId" | "revId"> & { activities: number; links: number; wbsLevels: number; calendars: number; dataDate: string; done: number; inProgress: number; notStarted: number; progress: number; warnings: Txt[] };
  saveRevision: (label: string) => string;
  restoreRevision: (revId: string) => void;
  submitProgressUpdate: (input: { lines: { activityId: string; pct: number; remaining?: number; aStart?: string | null; aEnd?: string | null }[]; note: string }) => string;

  // money
  submitInvoice: (input: { vendorId: string; poId: string; ref: string; lines?: InvoiceLine[]; source: Invoice["source"]; confidence?: number }) => string;
  rematchInvoice: (id: string) => void;
  setInvoiceStatus: (id: string, status: Invoice["status"], note?: string) => void;
  createPayRun: (paymentIds: string[]) => string;
  setPayRunStatus: (id: string, status: "PROPOSED" | "APPROVED" | "EXPORTED" | "CANCELLED") => void;

  // purchasing
  createDirectPo: (input: { vendorId: string; lines: { material: string | null; description: Txt; qty: number; unit: string; rate: number }[]; expectedAt: string; agreementId?: string | null; mrId?: string | null; note?: string }) => string;
  chasePo: (poId: string, note: string, newDate?: string | null) => void;
  inviteVendor: (input: { company: string; contact: string; email: string; trade: Vendor["trade"] }) => string;
  approveInvite: (inviteId: string) => string | null;

  // site
  rollCall: (date: string, rows: { workerId: string; status: "PRESENT" | "HALF" | "ABSENT" | "LEAVE" | "INJURY" }[]) => void;
};

type Get = () => OpsData & Phase2Actions & { logProgress: (activityId: string, pct: number, note: string) => void; createVendor: (input: never) => string };
type Set = (partial: Partial<OpsData> | ((s: OpsData) => Partial<OpsData>)) => void;

const ME = PEOPLE.pm;
const ev = (actor: "SYSTEM" | "AI" | "USER" | "VENDOR", en: string, az: string) => ({ at: nowStamp(), actor, text: { en, az } });
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const poTotal = (po: PurchaseOrder) => round(po.lines.reduce((a, l) => a + l.qty * l.rate, 0) * (1 + po.vatRate) + po.shipping, 2);

/** Three-way match: billed vs ordered vs received, line by line. */
export function matchInvoice(inv: Pick<Invoice, "lines">, po: PurchaseOrder | undefined) {
  if (!po) return { ok: false, lines: [], over: 0 };
  const lines = inv.lines.map((l) => {
    const pl = po.lines.find((x) => x.key === l.poLineKey) ?? null;
    const ordered = pl?.qty ?? 0;
    const received = pl?.received ?? 0;
    const qtyDiff = round(l.qty - received, 2);
    const rateDiff = pl ? round(l.rate - pl.rate, 2) : 0;
    const money = round(qtyDiff * l.rate + (pl ? (l.rate - pl.rate) * Math.min(l.qty, received) : 0), 2);
    return { key: l.key, poLineKey: l.poLineKey, ordered, received, billed: l.qty, rate: l.rate, poRate: pl?.rate ?? null, qtyDiff, rateDiff, money, ok: Math.abs(qtyDiff) < 1e-6 && Math.abs(rateDiff) < 0.005 };
  });
  return { ok: lines.every((l) => l.ok), lines, over: round(lines.reduce((a, l) => a + Math.max(0, l.money), 0), 2) };
}

function shiftForFile(file: string, a: Activity) {
  // Deterministic "what the planner changed in the file": a few activities move.
  const h = hash(file + a.code);
  if (a.status === "COMPLETED") return 0;
  // The planner's update always moves the end of the critical chain a little, so an import shows a real finish change.
  if (a.code === "WH-250" || a.code === "G-900" || a.code === "G-910") return (hash(file) % 5) + 3;
  if (h % 7 === 0) return (h % 5) + 2;
  if (h % 11 === 0) return -((h % 3) + 1);
  return 0;
}

export function phase2Actions(set: Set, get: Get): Phase2Actions {
  const feedOf = (s: OpsData, module: FeedEvent["module"], text: Txt, link: string | null, actor = ME) => {
    const n = (s.seq.F ?? 0) + 1;
    return { feed: [{ id: `F-${n}`, at: nowStamp(), module, text, link, actor }, ...s.feed].slice(0, 80), seq: { ...s.seq, F: n } };
  };
  const next = (kind: string, width = 4) => {
    const s = get();
    const n = (s.seq[kind] ?? 0) + 1;
    set({ seq: { ...s.seq, [kind]: n } });
    return `${kind}-${String(n).padStart(width, "0")}`;
  };

  return {
    nextRef: next,
    addItem: (key, item, front = true) => set((s) => ({ [key]: front ? [item, ...(s[key] as unknown[])] : [...(s[key] as unknown[]), item] }) as Partial<OpsData>),
    patchItem: (key, id, patch) => set((s) => ({ [key]: (s[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }) as Partial<OpsData>),
    removeItem: (key, id) => set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<OpsData>),
    pushFeed: (module, text, link, actor) => set((s) => feedOf(s, module, text, link, actor)),

    // ---------------------------------------------------------------- planning
    previewImport: (file, tool) => {
      const s = get();
      const before = s.activities.reduce((m, a) => (a.end > m ? a.end : m), TODAY);
      const moved = s.activities.map((a) => ({ a, d: shiftForFile(file, a) }));
      const after = moved.reduce((m, x) => {
        const e = addDays(x.a.end, x.d);
        return e > m ? e : m;
      }, TODAY);
      const changed = moved.filter((x) => x.d !== 0).length;
      const done = s.activities.filter((a) => a.status === "COMPLETED").length;
      const inProgress = s.activities.filter((a) => a.status === "IN_PROGRESS" || a.status === "BLOCKED").length;
      const budget = s.activities.reduce((x, a) => x + a.budget, 0) || 1;
      const warnings: Txt[] = [
        ...(tool === "MSP" ? [{ en: "Calendar 'Standard' mapped to the project's Mon–Sat week", az: "'Standard' təqvimi layihənin B.e.–Ş. həftəsinə uyğunlaşdırıldı" }] : []),
        { en: "2 activities have no successor (WH-240, AD-230)", az: "2 işin ardıcılı yoxdur (WH-240, AD-230)" },
        ...(hash(file) % 3 === 0 ? [{ en: "1 constraint 'Finish no later than' ignored", az: "1 'Ən gec bitmə' məhdudiyyəti nəzərə alınmadı" }] : []),
      ];
      return {
        finishBefore: before,
        finishAfter: after,
        changed,
        added: hash(file) % 3,
        removed: hash(file) % 2,
        activities: s.activities.length + (hash(file) % 3),
        links: s.links.length + (hash(file) % 4),
        wbsLevels: 3,
        calendars: tool === "P6" ? 2 : 1,
        dataDate: TODAY,
        done,
        inProgress,
        notStarted: s.activities.length - done - inProgress,
        progress: round((s.activities.reduce((x, a) => x + (a.budget * a.pct) / 100, 0) / budget) * 100, 1),
        warnings,
      };
    },
    importProgramme: ({ file, tool, mode, name }) => {
      const s = get();
      const pv = get().previewImport(file, tool);
      const keepId = `REV-${(s.seq.REV ?? 0) + 1}`;
      const kept = { id: keepId, programmeId: s.programmes.find((p) => p.current)?.id ?? "PRG-3", rev: s.revisions.length, label: same(`Kept before importing ${file}`), kind: "KEPT" as const, file: null, at: nowStamp(), by: PEOPLE.planner, finish: pv.finishBefore, activities: s.activities.length, snapshot: s.activities.map((a) => ({ code: a.code, name: a.name.en, start: a.start, end: a.end, pct: a.pct })) };
      const activities = mode === "REVISION" ? s.activities.map((a) => {
        const d = shiftForFile(file, a);
        return d ? { ...a, start: a.start > TODAY ? addDays(a.start, d) : a.start, end: addDays(a.end, d) } : a;
      }) : s.activities;
      const prgN = (s.seq.PRG ?? 0) + (mode === "NEW" ? 1 : 0);
      const programmeId = mode === "NEW" ? `PRG-${prgN}` : (s.programmes.find((p) => p.current)?.id ?? "PRG-3");
      const revN = (s.seq.REV ?? 0) + 2;
      const revId = `REV-${revN}`;
      const finish = activities.reduce((m, a) => (a.end > m ? a.end : m), TODAY);
      const rev = { id: revId, programmeId, rev: s.revisions.length + 1, label: same(`Imported ${file}`), kind: "IMPORTED" as const, file, at: nowStamp(), by: PEOPLE.planner, finish, activities: pv.activities, snapshot: activities.map((a) => ({ code: a.code, name: a.name.en, start: a.start, end: a.end, pct: a.pct })) };
      const programme = { id: programmeId, name: name || file.replace(/\.[^.]+$/, ""), tool, file, projectCode: "QOBU", dataDate: TODAY, contractFinish: "2027-08-27", finish, activities: pv.activities, links: pv.links, wbsLevels: pv.wbsLevels, calendars: pv.calendars, donePct: pv.progress, updatedAt: TODAY, current: mode === "REVISION", warnings: pv.warnings };
      set({
        activities,
        revisions: [...s.revisions, ...(mode === "REVISION" ? [kept] : []), rev],
        programmes: mode === "NEW" ? [...s.programmes, programme] : s.programmes.map((p) => (p.id === programmeId ? { ...p, ...programme, current: true } : p)),
                ...feedOf({ ...s, seq: { ...s.seq, PRG: prgN, REV: revN } }, "PM", { en: `${tool === "P6" ? "Primavera P6" : "MS Project"} file imported: ${file}`, az: `${tool === "P6" ? "Primavera P6" : "MS Project"} faylı idxal edildi: ${file}` }, "pm/planning", PEOPLE.planner),
      });
      return { programmeId, revId, finishBefore: pv.finishBefore, finishAfter: mode === "REVISION" ? finish : pv.finishBefore, changed: mode === "REVISION" ? pv.changed : 0, added: pv.added, removed: pv.removed };
    },
    saveRevision: (label) => {
      const s = get();
      const n = (s.seq.REV ?? 0) + 1;
      const id = `REV-${n}`;
      const finish = s.activities.reduce((m, a) => (a.end > m ? a.end : m), TODAY);
      set({ revisions: [...s.revisions, { id, programmeId: s.programmes.find((p) => p.current)?.id ?? "PRG-3", rev: s.revisions.length, label: same(label || "Saved by hand"), kind: "MANUAL", file: null, at: nowStamp(), by: PEOPLE.planner, finish, activities: s.activities.length, snapshot: s.activities.map((a) => ({ code: a.code, name: a.name.en, start: a.start, end: a.end, pct: a.pct })) }], seq: { ...s.seq, REV: n } });
      return id;
    },
    restoreRevision: (revId) => {
      const s = get();
      const rev = s.revisions.find((r) => r.id === revId);
      if (!rev) return;
      get().saveRevision(`Kept before going back to rev ${rev.rev}`);
      const s2 = get();
      set({ activities: s2.activities.map((a) => {
        const x = rev.snapshot.find((y) => y.code === a.code);
        return x && a.status !== "COMPLETED" ? { ...a, start: x.start, end: x.end } : a;
      }), ...feedOf(s2, "PM", { en: `Programme restored to rev ${rev.rev}`, az: `Qrafik ${rev.rev} versiyasına qaytarıldı` }, "pm/planning/changes", PEOPLE.planner) });
    },
    submitProgressUpdate: ({ lines, note }) => {
      const s = get();
      const n = (s.seq.PS ?? 0) + 1;
      const id = `PS-${String(n).padStart(2, "0")}`;
      const activities = s.activities.map((a) => {
        const l = lines.find((x) => x.activityId === a.id);
        if (!l) return a;
        const pct = Math.max(0, Math.min(100, Math.round(l.pct)));
        const status: Activity["status"] = pct >= 100 ? "COMPLETED" : pct > 0 ? (a.status === "BLOCKED" ? "BLOCKED" : "IN_PROGRESS") : a.status;
        const end = l.remaining != null && pct < 100 ? addDays(TODAY, Math.max(1, l.remaining)) : a.end;
        return { ...a, pct, status, aStart: l.aStart !== undefined ? l.aStart : (a.aStart ?? (pct > 0 ? TODAY : null)), aEnd: pct >= 100 ? (l.aEnd ?? TODAY) : null, end: end > a.end || pct < 100 ? end : a.end };
      });
      const budget = activities.reduce((x, a) => x + a.budget, 0) || 1;
      const planned = activities.reduce((x, a) => {
        const sh = TODAY <= a.bStart ? 0 : TODAY >= a.bEnd ? 1 : diffDays(a.bStart, TODAY) / Math.max(1, diffDays(a.bStart, a.bEnd));
        return x + a.budget * sh;
      }, 0) / budget;
      const actual = activities.reduce((x, a) => x + (a.budget * a.pct) / 100, 0) / budget;
      const snap = { id, dataDate: TODAY, submittedAt: nowStamp(), by: PEOPLE.planner, plannedPct: round(planned, 3), actualPct: round(actual, 3), spi: round(planned > 0 ? actual / planned : 1, 2), cpi: 0.98, note: note ? same(note) : null, lines: lines.map((l) => ({ activityId: l.activityId, pctBefore: s.activities.find((a) => a.id === l.activityId)?.pct ?? 0, pct: l.pct, remaining: l.remaining ?? 0 })) };
      set({ activities, snapshots: [...s.snapshots, snap], zones: s.zones.map((z) => { const l = lines.find((x) => x.activityId === z.activityId); return l ? { ...z, actualPct: l.pct } : z; }), ...feedOf({ ...s, seq: { ...s.seq, PS: n } }, "PM", { en: `Weekly progress update ${id} submitted (${lines.length} activities)`, az: `Həftəlik irəliləyiş ${id} göndərildi (${lines.length} iş)` }, "pm/progress-tracking", PEOPLE.planner) });
      return id;
    },

    // ---------------------------------------------------------------- money
    submitInvoice: ({ vendorId, poId, ref, lines, source, confidence }) => {
      const s = get();
      const po = s.pos.find((p) => p.id === poId);
      const n = (s.seq.INV ?? 0) + 1;
      const id = `INV-${String(n).padStart(4, "0")}`;
      const ls: InvoiceLine[] = lines ?? (po ? po.lines.map((l, i) => ({ key: `${id}-${i}`, description: l.description, unit: l.unit, qty: l.received || l.qty, rate: l.rate, poLineKey: l.key })) : []);
      const m = matchInvoice({ lines: ls }, po);
      const dup = s.invoices.some((x) => x.ref === ref && x.vendorId === vendorId);
      const inv: Invoice = { id, ref, vendorId, poId, date: TODAY, dueDate: addDays(TODAY, 30), status: dup ? "TO_MATCH" : m.ok ? "SIGN_OFF" : "MISMATCH", lines: ls, vatRate: 0.18, source, confidence: confidence ?? (source === "PORTAL" ? 1 : 0.92), duplicate: dup, paymentId: s.payments.find((p) => p.poId === poId && p.kind === "ON_DELIVERY")?.id ?? null, history: [source === "PORTAL" ? ev("VENDOR", "Invoice sent through the vendor portal", "Faktura portal vasitəsilə göndərildi") : ev("AI", "Invoice read from the uploaded file", "Faktura yüklənmiş fayldan oxundu"), m.ok ? ev("SYSTEM", "Three-way match passed", "Üçtərəfli uyğunlaşdırma keçdi") : ev("SYSTEM", "Billed differs from what was ordered or received", "Faktura sifariş və ya qəbul ilə fərqlənir")] };
      const vendor = s.vendors.find((v) => v.id === vendorId)?.name ?? vendorId;
      set({ invoices: [inv, ...s.invoices], ...feedOf({ ...s, seq: { ...s.seq, INV: n } }, source === "PORTAL" ? "VENDOR" : "PROC", { en: `${vendor} invoice ${ref} on ${poId}: ${m.ok ? "matches" : "does not match"}`, az: `${vendor} ${ref} fakturası (${poId}): ${m.ok ? "uyğundur" : "uyğun deyil"}` }, `procurement/invoices/${id}`, source === "PORTAL" ? vendor : ME) });
      return id;
    },
    rematchInvoice: (id) => {
      const s = get();
      const inv = s.invoices.find((x) => x.id === id);
      if (!inv) return;
      const m = matchInvoice(inv, s.pos.find((p) => p.id === inv.poId));
      set({ invoices: s.invoices.map((x) => (x.id === id ? { ...x, status: m.ok ? "SIGN_OFF" : "MISMATCH", history: [...x.history, ev("SYSTEM", m.ok ? "Match run again: passed" : "Match run again: still different", m.ok ? "Yenidən yoxlandı: keçdi" : "Yenidən yoxlandı: hələ fərqlidir")] } : x)) });
    },
    setInvoiceStatus: (id, status, note) => {
      const s = get();
      const inv = s.invoices.find((x) => x.id === id);
      if (!inv) return;
      const po = s.pos.find((p) => p.id === inv.poId);
      const goodsIn = po ? po.lines.every((l) => l.received >= l.qty - 1e-6) || po.status === "CLOSED" : false;
      const billed = round(inv.lines.reduce((a, l) => a + l.qty * l.rate, 0) * (1 + inv.vatRate), 2);
      const payments = s.payments.map((p) => {
        if (p.id !== inv.paymentId) return p;
        if (status === "BOOKED" && p.status !== "PAID") return { ...p, status: (goodsIn ? "READY" : p.status) as typeof p.status, amount: Math.min(p.amount, billed) || p.amount };
        if (status === "PAID") return { ...p, status: "PAID" as const, paidAt: TODAY, method: p.method ?? "Bank transfer", bankRef: p.bankRef ?? `KB-${TODAY.replace(/-/g, "").slice(2)}${id.slice(-2)}` };
        if (status === "REJECTED" || status === "CREDIT_REQUESTED") return p.status === "PAID" ? p : { ...p, status: "ON_HOLD" as const, holdReason: note || (status === "REJECTED" ? "Invoice rejected" : "Waiting for a credit note") };
        return p;
      });
      const label: Record<Invoice["status"], [string, string]> = { TO_MATCH: ["sent back to matching", "uyğunlaşdırmaya qaytarıldı"], MISMATCH: ["marked as not matching", "uyğun deyil kimi qeyd edildi"], CREDIT_REQUESTED: ["credit note requested", "kredit notu istənildi"], SIGN_OFF: ["sent for sign-off", "imzaya göndərildi"], BOOKED: ["signed off and booked", "imzalandı və uçota alındı"], PAID: ["paid", "ödənildi"], REJECTED: ["rejected", "rədd edildi"] };
      set({ invoices: s.invoices.map((x) => (x.id === id ? { ...x, status, history: [...x.history, ev("USER", `${label[status][0]}${note ? `: ${note}` : ""}`, `${label[status][1]}${note ? `: ${note}` : ""}`)] } : x)), payments, ...feedOf(s, "PROC", { en: `${inv.ref} ${label[status][0]}`, az: `${inv.ref} ${label[status][1]}` }, `procurement/invoices/${id}`, status === "BOOKED" || status === "PAID" ? PEOPLE.finance : ME) });
    },
    createPayRun: (paymentIds) => {
      const s = get();
      const n = (s.seq.RUN ?? 0) + 1;
      const id = `RUN-${String(n).padStart(2, "0")}`;
      set({ payRuns: [{ id, ref: `RUN-${TODAY.slice(0, 7)}-${String.fromCharCode(64 + n)}`, date: TODAY, status: "PROPOSED", paymentIds, cashToday: 386_000, buffer: 120_000, by: PEOPLE.finance }, ...s.payRuns], seq: { ...s.seq, RUN: n } });
      return id;
    },
    setPayRunStatus: (id, status) => {
      const s = get();
      const run = s.payRuns.find((r) => r.id === id);
      if (!run) return;
      const pay = status === "EXPORTED";
      set({
        payRuns: s.payRuns.map((r) => (r.id === id ? { ...r, status } : r)),
        payments: pay ? s.payments.map((p) => (run.paymentIds.includes(p.id) && p.status !== "PAID" ? { ...p, status: "PAID", paidAt: TODAY, method: "Bank transfer", bankRef: `${run.ref}-${p.id.slice(-4)}` } : p)) : s.payments,
        invoices: pay ? s.invoices.map((i) => (i.paymentId && run.paymentIds.includes(i.paymentId) && i.status === "BOOKED" ? { ...i, status: "PAID" } : i)) : s.invoices,
        ...feedOf(s, "PROC", { en: `Pay run ${run.ref} ${status.toLowerCase()}`, az: `Ödəniş paketi ${run.ref}: ${status}` }, "procurement/pay-run", PEOPLE.finance),
      });
    },

    // ---------------------------------------------------------------- purchasing
    createDirectPo: ({ vendorId, lines, expectedAt, agreementId, mrId, note }) => {
      const s = get();
      const n = (s.seq.PO ?? 0) + 1;
      const id = `PO-${String(n).padStart(4, "0")}`;
      const pn = (s.seq.PAY ?? 0) + 1;
      const payId = `PAY-${String(pn).padStart(4, "0")}`;
      const vendor = s.vendors.find((v) => v.id === vendorId);
      const po: PurchaseOrder = {
        id,
        ref: id,
        vendorId,
        quoteId: null,
        approvalId: null,
        rfqId: null,
        mrId: mrId ?? null,
        status: "ISSUED",
        issuedAt: TODAY,
        expectedAt,
        paymentTerms: vendor?.paymentTerms ?? "30 days",
        deliverTo: { en: "Qobu site, main gate, Absheron district", az: "Qobu meydançası, əsas darvaza, Abşeron rayonu" },
        vatRate: 0.18,
        shipping: 0,
        lines: lines.map((l, i) => ({ key: `${id}-${i}`, material: l.material, description: l.description, qty: l.qty, unit: l.unit, rate: l.rate, received: 0 })),
        vendorAck: "PENDING",
        dispatchedAt: null,
        dispatchNote: note || null,
      };
      set({
        pos: [po, ...s.pos],
        payments: [{ id: payId, ref: payId, poId: id, vendorId, amount: poTotal(po), kind: "ON_DELIVERY", dueDate: addDays(expectedAt, 30), status: "SCHEDULED", paidAt: null, method: null, bankRef: null, holdReason: null }, ...s.payments],
        agreements: agreementId ? s.agreements.map((a) => (a.id === agreementId ? { ...a, poIds: [...a.poIds, id] } : a)) : s.agreements,
        mrs: mrId ? s.mrs.map((m) => (m.id === mrId ? { ...m, status: "SOURCING" } : m)) : s.mrs,
                ...feedOf({ ...s, seq: { ...s.seq, PO: n, PAY: pn } }, "PROC", agreementId ? { en: `${id} called off from ${agreementId} with ${vendor?.name ?? vendorId}`, az: `${id} ${agreementId} çərçivəsində ${vendor?.name ?? vendorId}-dən sifariş edildi` } : { en: `${id} issued directly to ${vendor?.name ?? vendorId}`, az: `${id} birbaşa ${vendor?.name ?? vendorId}-ə verildi` }, `procurement/orders/${id}`, PEOPLE.buyer),
      });
      return id;
    },
    chasePo: (poId, note, newDate) => {
      const s = get();
      const n = (s.seq.EXP ?? 0) + 1;
      set({
        expedites: [{ id: `EXP-${n}`, poId, at: nowStamp(), by: PEOPLE.buyer, note: same(note), newDate: newDate ?? null }, ...s.expedites],
        pos: newDate ? s.pos.map((p) => (p.id === poId ? { ...p, expectedAt: newDate } : p)) : s.pos,
                ...feedOf({ ...s, seq: { ...s.seq, EXP: n } }, "PROC", { en: `${poId} chased${newDate ? `: now due ${newDate}` : ""}`, az: `${poId} izlənildi${newDate ? `: yeni tarix ${newDate}` : ""}` }, `procurement/orders/${poId}`, PEOPLE.buyer),
      });
    },
    inviteVendor: (input) => {
      const s = get();
      const n = (s.seq.INVT ?? 0) + 1;
      const id = `INVT-${String(n).padStart(2, "0")}`;
      set({ invites: [{ id, ...input, status: "INVITED", sentAt: TODAY, checklist: [], score: null, vendorId: null }, ...s.invites], ...feedOf({ ...s, seq: { ...s.seq, INVT: n } }, "PROC", { en: `Portal invite sent to ${input.company}`, az: `${input.company} portala dəvət edildi` }, "procurement/vendors/onboarding", PEOPLE.buyer) });
      return id;
    },
    approveInvite: (inviteId) => {
      const s = get();
      const inv = s.invites.find((i) => i.id === inviteId);
      if (!inv) return null;
      const n = (s.seq.V ?? 0) + 1;
      const id = `V-${String(n).padStart(2, "0")}`;
      const score = inv.score ?? 7;
      const sc = Math.round(score * 10);
      const vendor: Vendor = { id, name: inv.company, trade: inv.trade, trades: [inv.trade], city: "Bakı", trn: `${1400000000 + n * 7919}`, licence: `TL-2026-${5000 + n}`, contact: inv.contact, email: inv.email, phone: "+994 12 000 00 00", website: null, paymentTerms: "30 days", status: "APPROVED", risk: score >= 8 ? "LOW" : "MEDIUM", scores: { reliability: sc, quality: sc, price: sc, delivery: sc }, overall: score, avgDeliveryDays: 14, since: TODAY, portal: true, note: same("Onboarded through prequalification"), history: [] };
      set({ vendors: [...s.vendors, vendor], invites: s.invites.map((i) => (i.id === inviteId ? { ...i, status: "APPROVED", vendorId: id } : i)), ...feedOf({ ...s, seq: { ...s.seq, V: n } }, "PROC", { en: `${inv.company} approved as a vendor`, az: `${inv.company} təchizatçı kimi təsdiqləndi` }, `procurement/vendors/${id}`, PEOPLE.buyer) });
      return id;
    },

    // ---------------------------------------------------------------- site
    rollCall: (date, rows) => {
      const s = get();
      const keep = s.attendance.filter((a) => !(a.date === date && rows.some((r) => r.workerId === a.workerId)));
      const added = rows.map((r) => ({ date, workerId: r.workerId, status: r.status, hours: r.status === "PRESENT" ? 9 : r.status === "HALF" ? 4.5 : 0, activityId: s.workers.find((w) => w.id === r.workerId)?.activityId ?? null }));
      const present = rows.filter((r) => r.status === "PRESENT" || r.status === "HALF").length;
      set({ attendance: [...keep, ...added], ...feedOf(s, "PM", { en: `Roll call ${date}: ${present} of ${rows.length} on site`, az: `Yoxlama ${date}: ${rows.length} nəfərdən ${present} meydançada` }, "pm/workforce", PEOPLE.site) });
    },
  };
}
