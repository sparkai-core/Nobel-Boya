import { addDays, diffDays, PROJECT_FINISH, PROJECT_START, TODAY } from "../dates";
import type {
  Activity,
  Agreement,
  AttendanceRow,
  AttendanceStatus,
  Constraint,
  DemoProject,
  Equipment,
  Expedite,
  GoodsReceipt,
  Incident,
  Invoice,
  Material,
  OpsData,
  PayRun,
  Payment,
  Permit,
  PpeCheck,
  PriceSeries,
  ProgrammeRev,
  Programme,
  ProgressSnapshot,
  ProjectTemplate,
  PurchaseOrder,
  Resource,
  Submittal,
  ToolboxTalk,
  VendorInvite,
  Worker,
} from "../types";
import { PEOPLE } from "./pm";
import { rng, round, T } from "./util";

type Base = Pick<OpsData, "activities" | "pos" | "grns" | "payments" | "vendors" | "materials" | "subs" | "rfis" | "inspections" | "mrs">;

const month = (iso: string) => iso.slice(0, 7);
function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export function seedPhase2(b: Base) {
  const r = rng(23);
  const act = (code: string) => b.activities.find((a) => a.code === code)!;

  // ---------------------------------------------------------------- programmes and revisions
  const snap = (acts: Activity[], shift: (a: Activity) => number, pctOf: (a: Activity) => number) =>
    acts.map((a) => ({ code: a.code, name: a.name.en, start: addDays(a.start, shift(a)), end: addDays(a.end, shift(a)), pct: pctOf(a) }));
  const finishOf = (s: { end: string }[]) => s.reduce((m, x) => (x.end > m ? x.end : m), PROJECT_START);

  const rev0 = snap(b.activities, (a) => diffDays(a.end, a.bEnd), () => 0).map((x) => {
    const a = b.activities.find((y) => y.code === x.code)!;
    return { ...x, start: a.bStart, end: a.bEnd };
  });
  const rev1 = snap(b.activities, (a) => (a.code.startsWith("WH-15") || a.code.startsWith("WH-16") ? -12 : 0), (a) => Math.max(0, Math.round(a.pct * 0.55)));
  const rev2 = snap(b.activities, () => 0, (a) => a.pct);

  const programmes: Programme[] = [
    {
      id: "PRG-1",
      name: "Qobu — Contract baseline",
      tool: "P6",
      file: "QOBU_BASELINE_R0.xer",
      projectCode: "QOBU",
      dataDate: PROJECT_START,
      contractFinish: PROJECT_FINISH,
      finish: finishOf(rev0),
      activities: b.activities.length,
      links: 52,
      wbsLevels: 3,
      calendars: 2,
      donePct: 0,
      updatedAt: "2026-09-30",
      current: false,
      warnings: [T("2 activities have no successor", "2 işin ardıcılı yoxdur")],
    },
    {
      id: "PRG-2",
      name: "Qobu — Monthly update (MS Project)",
      tool: "MSP",
      file: "Qobu_update_Oct26.xml",
      projectCode: "QOBU",
      dataDate: "2026-10-31",
      contractFinish: PROJECT_FINISH,
      finish: finishOf(rev1),
      activities: b.activities.length,
      links: 52,
      wbsLevels: 3,
      calendars: 1,
      donePct: 7.9,
      updatedAt: "2026-11-02",
      current: false,
      warnings: [T("Calendar 'Mon–Sat' mapped from the MS Project standard calendar", "'B.e.–Ş.' təqvimi MS Project standart təqvimindən götürüldü")],
    },
    {
      id: "PRG-3",
      name: "Qobu — Working programme",
      tool: "P6",
      file: "QOBU_UPDATE_R2.xer",
      projectCode: "QOBU",
      dataDate: TODAY,
      contractFinish: PROJECT_FINISH,
      finish: finishOf(rev2),
      activities: b.activities.length,
      links: 55,
      wbsLevels: 3,
      calendars: 2,
      donePct: 13.7,
      updatedAt: TODAY,
      current: true,
      warnings: [T("WH-150 is blocked: RFI-0004 open", "WH-150 bloklanıb: RFI-0004 açıqdır"), T("Negative float on 0 activities", "0 işdə mənfi ehtiyat")],
    },
  ];
  const revisions: ProgrammeRev[] = [
    { id: "REV-1", programmeId: "PRG-3", rev: 0, label: T("Contract baseline", "Müqavilə baza planı"), kind: "IMPORTED", file: "QOBU_BASELINE_R0.xer", at: "2026-09-30T10:00:00Z", by: PEOPLE.planner, finish: finishOf(rev0), activities: rev0.length, snapshot: rev0 },
    { id: "REV-2", programmeId: "PRG-3", rev: 1, label: T("October update", "Oktyabr yeniləməsi"), kind: "IMPORTED", file: "Qobu_update_Oct26.xml", at: "2026-11-02T09:30:00Z", by: PEOPLE.planner, finish: finishOf(rev1), activities: rev1.length, snapshot: rev1 },
    { id: "REV-3", programmeId: "PRG-3", rev: 2, label: T("Kept before the RFI-0004 re-plan", "RFI-0004 yenidən planlamadan əvvəl saxlanıb"), kind: "KEPT", file: "QOBU_UPDATE_R2.xer", at: "2026-11-10T16:20:00Z", by: PEOPLE.planner, finish: finishOf(rev2), activities: rev2.length, snapshot: rev2 },
  ];

  // ---------------------------------------------------------------- resources
  const months = monthsBetween(PROJECT_START, PROJECT_FINISH);
  const spread = (actIds: string[], total: number, usedShare: number) => {
    const acts = actIds.map((id) => b.activities.find((a) => a.id === id)!).filter(Boolean);
    const w = new Map<string, number>();
    for (const a of acts) {
      const ms = monthsBetween(month(a.start), month(a.end));
      for (const mm of ms) w.set(mm, (w.get(mm) ?? 0) + 1 / ms.length);
    }
    const sum = [...w.values()].reduce((x, y) => x + y, 0) || 1;
    return months.map((mm) => {
      const q = round(((w.get(mm) ?? 0) / sum) * total, 1);
      const past = mm < month(TODAY);
      const now = mm === month(TODAY);
      return { month: mm, used: past ? q : now ? round(q * usedShare, 1) : 0, toCome: past ? 0 : now ? round(q * (1 - usedShare), 1) : q };
    });
  };
  const ids = (...codes: string[]) => codes.map((c) => act(c).id);
  const res = (id: string, code: string, en: string, az: string, type: Resource["type"], unit: string, budget: number, codes: string[], usedShare = 0.5): Resource => {
    const monthly = spread(ids(...codes), budget, usedShare);
    return { id, code, name: T(en, az), type, unit, budget, used: round(monthly.reduce((x, m) => x + m.used, 0), 1), activityIds: ids(...codes), monthly };
  };
  const resources: Resource[] = [
    res("RS-L1", "LAB-CON", "Concrete gang", "Beton briqadası", "LABOUR", "man-days", 2_400, ["WH-120", "WH-130", "WH-140", "WH-190", "AD-120", "AD-130", "AD-140", "AD-150"]),
    res("RS-L2", "LAB-FIX", "Steel fixers", "Armaturçular", "LABOUR", "man-days", 1_150, ["WH-125", "AD-125"], 0.6),
    res("RS-L3", "LAB-ERE", "Steel erectors", "Montajçılar", "LABOUR", "man-days", 520, ["WH-160", "WH-250"]),
    res("RS-L4", "LAB-MAS", "Masons", "Bənnalar", "LABOUR", "man-days", 940, ["WH-180", "AD-170"]),
    res("RS-L5", "LAB-MEP", "MEP fitters", "Mühəndis sistemləri montajçıları", "LABOUR", "man-days", 1_380, ["WH-210", "WH-220", "AD-190", "AD-220", "PS-120"]),
    res("RS-P1", "PLT-CRN", "Mobile crane 50 t", "Avtokran 50 t", "PLANT", "days", 130, ["WH-160", "WH-170", "AD-150"]),
    res("RS-P2", "PLT-EXC", "Excavator 21 t", "Ekskavator 21 t", "PLANT", "days", 95, ["WH-110", "AD-110", "PS-110", "TK-110", "SW-110"], 0.7),
    res("RS-P3", "PLT-PMP", "Concrete pump 36 m", "Beton nasosu 36 m", "PLANT", "days", 70, ["WH-120", "WH-190", "AD-140", "AD-150"]),
    res("RS-M1", "MAT-CON", "Ready-mix concrete", "Hazır beton", "MATERIAL", "m³", 1_420, ["WH-120", "WH-130", "WH-140", "WH-190", "AD-120", "AD-130", "AD-140", "AD-150"]),
    res("RS-M2", "MAT-REB", "Reinforcement", "Armatur", "MATERIAL", "t", 61, ["WH-125", "AD-125"], 0.55),
    res("RS-M3", "MAT-STL", "Structural steel", "Konstruksiya poladı", "MATERIAL", "t", 27.8, ["WH-150", "WH-160"], 0.05),
  ];

  // ---------------------------------------------------------------- progress snapshots (weekly updates)
  const weeks = ["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"];
  const snapshots: ProgressSnapshot[] = weeks.map((w, i) => ({
    id: `PS-${String(i + 1).padStart(2, "0")}`,
    dataDate: w,
    submittedAt: `${addDays(w, 1)}T15:00:00Z`,
    by: PEOPLE.planner,
    plannedPct: round([0.031, 0.062, 0.098, 0.135][i]!, 3),
    actualPct: round([0.03, 0.058, 0.081, 0.108][i]!, 3),
    spi: [0.97, 0.94, 0.83, 0.8][i]!,
    cpi: [1.02, 1.01, 0.99, 0.98][i]!,
    note: i === 2 ? T("Rebar delivery 6 t short; Ms-3/Ms-4 re-sequenced.", "Armatur 6 t əskik; Ms-3/Ms-4 ardıcıllığı dəyişdi.") : i === 3 ? T("Truss fabrication blocked by RFI-0004.", "Ferma hazırlığı RFI-0004 səbəbindən bloklanıb.") : null,
    lines: b.activities
      .filter((a) => a.aStart && a.aStart <= w)
      .slice(0, 6)
      .map((a) => ({ activityId: a.id, pctBefore: Math.max(0, Math.round(a.pct * (i / 5))), pct: Math.min(100, Math.round(a.pct * ((i + 1) / 5))), remaining: Math.max(0, diffDays(w, a.end)) })),
  }));

  // ---------------------------------------------------------------- invoices and pay runs
  const po = (id: string) => b.pos.find((p) => p.id === id)!;
  const invLines = (p: PurchaseOrder, qtyFn: (l: PurchaseOrder["lines"][number]) => number, rateFn: (l: PurchaseOrder["lines"][number]) => number = (l) => l.rate) =>
    p.lines.map((l, i) => ({ key: `${p.id}-inv-${i}`, description: l.description, unit: l.unit, qty: round(qtyFn(l), 2), rate: round(rateFn(l), 2), poLineKey: l.key }));
  const ev = (at: string, actor: "SYSTEM" | "AI" | "USER" | "VENDOR", en: string, az: string) => ({ at, actor, text: T(en, az) });
  const payOf = (poId: string, kind: Payment["kind"] = "ON_DELIVERY") => b.payments.find((p) => p.poId === poId && p.kind === kind)?.id ?? null;
  const invoices: Invoice[] = [
    { id: "INV-0001", ref: "ABS-INV-2611", vendorId: "V-01", poId: "PO-0001", date: "2026-10-27", dueDate: "2026-11-10", status: "PAID", lines: invLines(po("PO-0001"), (l) => l.received), vatRate: 0.18, source: "PORTAL", confidence: 1, duplicate: false, paymentId: payOf("PO-0001"), history: [ev("2026-10-27T10:00:00Z", "VENDOR", "Invoice sent through the vendor portal", "Faktura portal vasitəsilə göndərildi"), ev("2026-10-27T10:01:00Z", "SYSTEM", "Matched to PO-0001 and GRN-0001/0002", "PO-0001 və GRN-0001/0002 ilə uyğunlaşdırıldı"), ev("2026-11-09T12:00:00Z", "USER", "Paid", "Ödənildi")] },
    { id: "INV-0002", ref: "GSN-1093", vendorId: "V-11", poId: "PO-0003", date: "2026-10-15", dueDate: "2026-11-14", status: "PAID", lines: invLines(po("PO-0003"), (l) => l.received), vatRate: 0.18, source: "EMAIL", confidence: 0.96, duplicate: false, paymentId: payOf("PO-0003"), history: [ev("2026-10-15T09:00:00Z", "AI", "Read from the e-mailed PDF", "E-poçtla gələn PDF-dən oxundu"), ev("2026-11-12T11:00:00Z", "USER", "Paid", "Ödənildi")] },
    { id: "INV-0003", ref: "QAF-77821", vendorId: "V-02", poId: "PO-0002", date: "2026-11-05", dueDate: "2026-12-05", status: "MISMATCH", lines: invLines(po("PO-0002"), (l) => l.qty), vatRate: 0.18, source: "UPLOAD", confidence: 0.93, duplicate: false, paymentId: payOf("PO-0002"), history: [ev("2026-11-05T14:00:00Z", "AI", "Read from the uploaded PDF", "Yüklənmiş PDF-dən oxundu"), ev("2026-11-05T14:01:00Z", "SYSTEM", "Billed 18,000 kg but only 12,000 kg received", "18 000 kq fakturalanıb, amma yalnız 12 000 kq qəbul edilib")] },
    { id: "INV-0004", ref: "YOL-4410", vendorId: "V-12", poId: "PO-0007", date: "2026-10-12", dueDate: "2026-11-11", status: "SIGN_OFF", lines: invLines(po("PO-0007"), (l) => l.received), vatRate: 0.18, source: "PORTAL", confidence: 1, duplicate: false, paymentId: payOf("PO-0007"), history: [ev("2026-10-12T08:00:00Z", "VENDOR", "Invoice sent through the vendor portal", "Faktura portal vasitəsilə göndərildi"), ev("2026-10-12T08:01:00Z", "SYSTEM", "Three-way match passed", "Üçtərəfli uyğunlaşdırma keçdi")] },
    { id: "INV-0005", ref: "ETM-2026-388", vendorId: "V-08", poId: "PO-0008", date: "2026-10-17", dueDate: "2026-11-16", status: "MISMATCH", lines: invLines(po("PO-0008"), (l) => l.qty, (l) => l.rate * 1.04), vatRate: 0.18, source: "EMAIL", confidence: 0.88, duplicate: false, paymentId: payOf("PO-0008"), history: [ev("2026-10-17T09:30:00Z", "AI", "Read from the e-mailed PDF", "E-poçtla gələn PDF-dən oxundu"), ev("2026-10-17T09:31:00Z", "SYSTEM", "Billed a damaged board and 4% over the PO rate", "Zədəli lövhə və PO qiymətindən 4% yuxarı fakturalanıb")] },
    { id: "INV-0006", ref: "ETM-2026-388", vendorId: "V-08", poId: "PO-0008", date: "2026-10-18", dueDate: "2026-11-17", status: "TO_MATCH", lines: invLines(po("PO-0008"), (l) => l.qty, (l) => l.rate * 1.04), vatRate: 0.18, source: "EMAIL", confidence: 0.9, duplicate: true, paymentId: null, history: [ev("2026-10-18T07:10:00Z", "AI", "Read from a second e-mail — same number as INV-0005", "İkinci e-poçtdan oxundu — INV-0005 ilə eyni nömrə")] },
  ];
  const payRuns: PayRun[] = [{ id: "RUN-01", ref: "RUN-2026-11-A", date: "2026-11-09", status: "EXPORTED", paymentIds: b.payments.filter((p) => p.status === "PAID" && p.paidAt && p.paidAt >= "2026-11-01").map((p) => p.id), cashToday: 412_000, buffer: 120_000, by: PEOPLE.finance }];

  // ---------------------------------------------------------------- agreements and prices
  const mat = (k: string) => b.materials.find((m) => m.key === k);
  const agreements: Agreement[] = [
    { id: "AGR-0001", ref: "FA-2026-01", vendorId: "V-01", title: T("Ready-mix concrete, all grades", "Hazır beton, bütün markalar"), from: "2026-09-15", to: "2027-09-15", cap: 260_000, rates: [{ material: "conc_fdn", rate: 166, unit: "m³", minQty: 6 }, { material: "conc_col", rate: 259, unit: "m³", minQty: 4 }, { material: "conc_beam", rate: 238, unit: "m³", minQty: 4 }, { material: "conc_slab", rate: 207, unit: "m³", minQty: 6 }, { material: "conc_slab_grd", rate: 133, unit: "m³", minQty: 8 }, { material: "conc_blind", rate: 104, unit: "m³", minQty: 4 }], status: "ACTIVE", terms: T("Prices fixed for 12 months. Pump hire included above 30 m³ per pour.", "Qiymətlər 12 ay sabitdir. 30 m³-dən çox betonlamada nasos daxildir."), poIds: ["PO-0001", "PO-0004"] },
    { id: "AGR-0002", ref: "FA-2026-02", vendorId: "V-02", title: T("Reinforcement bar, cut and bent", "Armatur, kəsilmiş və əyilmiş"), from: "2026-10-01", to: "2026-12-31", cap: 120_000, rates: [{ material: "rebar_a500", rate: 1.84, unit: "kg", minQty: 1000 }, { material: "rebar_ai", rate: 1.95, unit: "kg", minQty: 500 }, { material: "x-wire", rate: 2.8, unit: "kg", minQty: 50 }], status: "EXPIRING", terms: T("Rate holds while the LME index stays within ±5%.", "LME indeksi ±5% daxilində qaldıqca qiymət qüvvədədir."), poIds: ["PO-0002", "PO-0006"] },
    { id: "AGR-0003", ref: "FA-2026-03", vendorId: "V-11", title: T("Aggregates and cement", "Doldurucular və sement"), from: "2026-10-01", to: "2027-06-30", cap: 70_000, rates: [{ material: "crushed_stone", rate: 36, unit: "m³", minQty: 20 }, { material: "fill_carbonate", rate: 26, unit: "m³", minQty: 20 }, { material: "x-cement", rate: 8.2, unit: "ədəd", minQty: 100 }, { material: "sand_cement", rate: mat("sand_cement")?.rate ?? 30, unit: mat("sand_cement")?.unit ?? "m³", minQty: 5 }], status: "ACTIVE", terms: T("Delivery to site within 48 hours of call-off.", "Sifarişdən 48 saat ərzində meydançaya çatdırılma."), poIds: ["PO-0003"] },
    { id: "AGR-0004", ref: "FA-2026-04", vendorId: "V-12", title: T("Asphalt, kerbs and paving", "Asfalt, bordyur və səki daşı"), from: "2027-03-01", to: "2027-09-30", cap: 190_000, rates: [{ material: "asphalt_coarse", rate: mat("asphalt_coarse")?.rate ?? 20, unit: "m²", minQty: 200 }, { material: "asphalt_fine", rate: mat("asphalt_fine")?.rate ?? 18, unit: "m²", minQty: 200 }, { material: "kerb", rate: mat("kerb")?.rate ?? 12, unit: "m", minQty: 50 }, { material: "paving", rate: mat("paving")?.rate ?? 30, unit: "m²", minQty: 50 }], status: "DRAFT", terms: T("Draft — waiting for the client's paving sample approval.", "Qaralama — sifarişçinin səki nümunəsi təsdiqi gözlənilir."), poIds: [] },
  ];

  const series = (key: string, en: string, az: string, unit: string, catEn: string, catAz: string, base: number, drift: number, call: PriceSeries["call"], leadDays: number, material: string | null): PriceSeries => {
    const hist = monthsBetween("2025-12", "2026-11").map((mm, i) => ({ month: mm, price: round(base * (1 + drift * (i - 11) / 11 + Math.sin(i * 1.3) * 0.015), 2) }));
    const last = hist[hist.length - 1]!.price;
    const fc = monthsBetween("2026-12", "2027-05").map((mm, i) => {
      const p = round(last * (1 + (call === "BUY_NOW" ? 0.018 : call === "WAIT" ? -0.012 : 0.002) * (i + 1)), 2);
      return { month: mm, price: p, low: round(p * (1 - 0.02 * (i + 1)), 2), high: round(p * (1 + 0.025 * (i + 1)), 2) };
    });
    return { key, name: T(en, az), unit, category: T(catEn, catAz), history: hist, forecast: fc, call, leadDays, material };
  };
  const priceSeries: PriceSeries[] = [
    series("rebar", "Rebar A500C", "A500C armatur", "t", "Steel", "Polad", 1_840, 0.06, "BUY_NOW", 9, "rebar_a500"),
    series("steel", "Structural steel S255", "S255 konstruksiya poladı", "t", "Steel", "Polad", 4_420, 0.05, "BUY_NOW", 28, "steel_struct"),
    series("cement", "Cement M400", "Sement M400", "t", "Concrete", "Beton", 172, 0.02, "HOLD", 4, "x-cement"),
    series("readymix", "Ready-mix B25", "Hazır beton B25", "m³", "Concrete", "Beton", 168, 0.015, "HOLD", 2, "conc_col"),
    series("diesel", "Diesel", "Dizel", "l", "Fuel", "Yanacaq", 1.0, -0.04, "WAIT", 1, "x-diesel"),
    series("limestone", "Sawn limestone", "Kəsilmiş əhəng daşı", "m²", "Masonry", "Hörgü", 46, -0.03, "WAIT", 7, "wall_limestone"),
    series("roof", "Roof sheet H60", "Dam profnastili H60", "m²", "Roofing", "Dam örtüyü", 22, 0.04, "BUY_NOW", 12, "roof_sheet"),
    series("bitumen", "Bitumen membrane", "Bitum membranı", "m²", "Roofing", "Dam örtüyü", 9.6, -0.02, "WAIT", 6, "x-membrane"),
  ];

  const invites: VendorInvite[] = [
    { id: "INVT-01", company: "Kür Polad Zavodu", contact: "Rəşid Əliyev", email: "sales@kurpolad.az", trade: "Steel", status: "IN_REVIEW", sentAt: "2026-11-12", checklist: [{ key: "trn", label: T("Tax registration (VÖEN)", "VÖEN"), ok: true, note: null }, { key: "licence", label: T("Trade licence", "Ticarət lisenziyası"), ok: true, note: null }, { key: "insurance", label: T("Insurance certificate", "Sığorta sertifikatı"), ok: null, note: null }, { key: "refs", label: T("Two project references", "İki layihə arayışı"), ok: true, note: "Sumqayıt hub, Gəncə mall" }, { key: "hse", label: T("HSE policy and record", "ƏMSE siyasəti və göstəriciləri"), ok: null, note: null }, { key: "iso", label: T("ISO 9001 certificate", "ISO 9001 sertifikatı"), ok: false, note: "Expired 2025" }], score: null, vendorId: null },
    { id: "INVT-02", company: "Alov Metal Konstruksiya", contact: "Fərhad Səfərli", email: "info@alovmetal.az", trade: "Steel", status: "INVITED", sentAt: "2026-11-15", checklist: [], score: null, vendorId: null },
    { id: "INVT-03", company: "Pəncərə Dünyası", contact: "Səbinə Abbasova", email: "office@pencere.az", trade: "Doors and windows", status: "INVITED", sentAt: "2026-11-16", checklist: [], score: null, vendorId: null },
  ];

  const expedites: Expedite[] = [
    { id: "EXP-1", poId: "PO-0002", at: "2026-11-06T10:00:00Z", by: PEOPLE.buyer, note: T("Vendor confirmed the 6 t balance for 19 November.", "Təchizatçı 6 t qalığı 19 noyabra təsdiqlədi."), newDate: "2026-11-19" },
    { id: "EXP-2", poId: "PO-0008", at: "2026-10-20T09:00:00Z", by: PEOPLE.buyer, note: T("Replacement board promised next week.", "Əvəzedici lövhə gələn həftə vəd edildi."), newDate: null },
  ];

  // ---------------------------------------------------------------- equipment
  const eq = (id: string, code: string, en: string, az: string, category: Equipment["category"], ownership: Equipment["ownership"], vendorId: string | null, status: Equipment["status"], zoneEn: string, zoneAz: string, activity: string | null, dayRate: number, hireFrom: string | null, hireTo: string | null, nextService: string, hours: number[], inv: Equipment["hireInvoices"] = []): Equipment => ({
    id,
    code,
    name: T(en, az),
    category,
    ownership,
    vendorId,
    status,
    zone: T(zoneEn, zoneAz),
    activityId: activity ? act(activity).id : null,
    dayRate,
    hireFrom,
    hireTo,
    nextService,
    hours,
    hireInvoices: inv,
  });
  const equipment: Equipment[] = [
    eq("EQ-01", "CRN-50", "Mobile crane 50 t", "Avtokran 50 t", "CRANE", "HIRED", "V-14", "BROKEN_DOWN", "Warehouse grid 1–9", "Anbar, 1–9 oxları", "WH-160", 720, "2026-11-01", "2027-03-31", "2026-11-16", [6, 7, 5, 0, 0, 0, 0], [{ ref: "ATL-H-1101", period: "Nov 2026 (1–15)", billed: 10_800, accrued: 8_640 }]),
    eq("EQ-02", "EXC-21", "Excavator 21 t", "Ekskavator 21 t", "EXCAVATOR", "HIRED", null, "ON_SITE", "Admin building", "İnzibati bina", "AD-120", 380, "2026-10-05", "2026-12-20", "2026-12-01", [8, 8, 2, 8, 8, 7, 0], [{ ref: "ATI-0937", period: "Oct 2026", billed: 9_880, accrued: 9_880 }]),
    eq("EQ-03", "PMP-36", "Concrete pump 36 m", "Beton nasosu 36 m", "PUMP", "HIRED", "V-01", "IDLE", "Main gate yard", "Əsas darvaza həyəti", null, 450, "2026-10-20", "2027-02-28", "2026-12-10", [4, 0, 6, 0, 0, 3, 0], [{ ref: "ABS-P-1102", period: "Nov 2026 (1–15)", billed: 6_750, accrued: 6_750 }]),
    eq("EQ-04", "LDR-03", "Wheel loader 3 m³", "Təkərli yükləyici 3 m³", "LOADER", "OWNED", null, "ON_SITE", "Warehouse grid 1–9", "Anbar, 1–9 oxları", "WH-120", 210, null, null, "2026-11-25", [7, 8, 8, 6, 8, 7, 0]),
    eq("EQ-05", "GEN-100", "Generator 100 kVA", "Generator 100 kVA", "GENERATOR", "OWNED", null, "ON_SITE", "Site compound", "Meydança düşərgəsi", "G-020", 95, null, null, "2026-11-19", [12, 12, 12, 12, 12, 10, 4]),
    eq("EQ-06", "CMP-01", "Plate compactor", "Vibroplitə", "COMPACTOR", "OWNED", null, "AVAILABLE", "Main store", "Əsas anbar", null, 40, null, null, "2027-01-10", [0, 3, 2, 0, 4, 0, 0]),
    eq("EQ-07", "TLH-14", "Telehandler 14 m", "Teleskopik yükləyici 14 m", "LIFT", "HIRED", "V-14", "ON_SITE", "Admin building", "İnzibati bina", "AD-125", 260, "2026-11-04", "2026-11-24", "2026-12-04", [8, 7, 8, 8, 6, 5, 0], [{ ref: "ATL-H-1102", period: "Nov 2026 (4–15)", billed: 3_380, accrued: 3_120 }]),
    eq("EQ-08", "TRK-02", "Tipper truck 20 t", "Özüboşaldan 20 t", "VEHICLE", "OWNED", null, "MAINTENANCE", "Workshop", "Emalatxana", null, 150, null, null, "2026-11-17", [8, 6, 0, 0, 0, 0, 0]),
  ];

  // ---------------------------------------------------------------- workforce
  const first = ["Elçin", "Rüfət", "Anar", "Vüsal", "Kamal", "Tural", "Orxan", "Nicat", "Samir", "Ceyhun", "Fuad", "Ramin", "Elnur", "Zaur", "Murad", "Emin", "Rəşad", "Ilqar", "Pərviz", "Arif", "Teymur", "Nurlan", "Seymur", "Vaqif"];
  const last = ["Məmmədov", "Əliyev", "Həsənov", "Quliyev", "İsmayılov", "Hüseynov", "Babayev", "Rzayev", "Kərimov", "Abbasov", "Səfərov", "Nəsirov"];
  const trades: [string, string, string, string][] = [
    ["Concrete and formwork", "Beton və qəlib", "SC-02", "WH-120"],
    ["Steel fixer", "Armaturçu", "SC-02", "WH-125"],
    ["Steel fixer", "Armaturçu", "SC-02", "AD-125"],
    ["Plant operator", "Texnika operatoru", "SC-01", "AD-120"],
    ["Labourer", "Fəhlə", "SC-02", "AD-120"],
    ["Electrician", "Elektrik", "SC-06", "G-020"],
  ];
  const workers: Worker[] = Array.from({ length: 24 }, (_, i) => {
    const [ten, taz, emp, a] = trades[i % trades.length]!;
    const role: Worker["role"] = i % 8 === 0 ? "FOREMAN" : ten === "Plant operator" ? "OPERATOR" : "OPERATIVE";
    return {
      id: `WK-${String(i + 1).padStart(3, "0")}`,
      name: `${first[i % first.length]} ${last[(i * 7) % last.length]}`,
      trade: T(ten, taz),
      employer: emp,
      role,
      rate: role === "FOREMAN" ? 9.5 : role === "OPERATOR" ? 8 : 6 + (i % 3),
      activityId: act(a).id,
      certs: [
        { name: T("Safety induction", "Təhlükəsizlik təlimatı"), expires: addDays("2027-03-01", (i * 13) % 120) },
        ...(i % 5 === 0 ? [{ name: T("Work at height", "Hündürlükdə iş"), expires: addDays(TODAY, (i % 3) * 9 - 3) }] : []),
        ...(ten === "Plant operator" ? [{ name: T("Plant operator card", "Operator vəsiqəsi"), expires: addDays(TODAY, 21) }] : []),
      ],
    };
  });
  const attendance: AttendanceRow[] = [];
  for (let d = addDays(TODAY, -6); d <= TODAY; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (dow === 0) continue;
    for (const w of workers) {
      const x = r();
      const status: AttendanceStatus = d === TODAY && x > 0.82 ? "ABSENT" : x > 0.95 ? "LEAVE" : x > 0.9 ? "HALF" : x > 0.88 ? "ABSENT" : "PRESENT";
      attendance.push({ date: d, workerId: w.id, status, hours: status === "PRESENT" ? 9 : status === "HALF" ? 4.5 : 0, activityId: w.activityId });
    }
  }

  // ---------------------------------------------------------------- safety
  const incidents: Incident[] = [
    { id: "INC-0001", ref: "INC-0001", date: "2026-10-22", title: T("Worker slipped into a flooded pit", "İşçi su basmış çuxura sürüşdü"), kind: "FIRST_AID", severity: "MEDIUM", zone: T("Warehouse grid C", "Anbar, C oxu"), status: "CLOSED", reportedBy: PEOPLE.site, description: T("Minor bruise. Pit edges now fenced and ladders added.", "Kiçik zədə. Çuxur kənarları hasarlanıb və nərdivan qoyulub."), actions: [{ text: T("Fence open pits", "Açıq çuxurları hasarlamaq"), owner: PEOPLE.site, due: "2026-10-23", done: true }] },
    { id: "INC-0002", ref: "INC-0002", date: "2026-11-08", title: T("Rebar bundle swung near workers during unloading", "Boşaltma zamanı armatur bağlaması işçilərə yaxın yelləndi"), kind: "NEAR_MISS", severity: "HIGH", zone: T("Main store", "Əsas anbar"), status: "INVESTIGATING", reportedBy: PEOPLE.store, description: T("Tag line not used. Exclusion zone not marked.", "İstiqamətləndirici ip istifadə edilməyib. Təhlükə zonası işarələnməyib."), actions: [{ text: T("Retrain banksman on tag lines", "Siqnalçını ip istifadəsinə yenidən öyrətmək"), owner: PEOPLE.qa, due: "2026-11-20", done: false }, { text: T("Mark unloading exclusion zone", "Boşaltma təhlükə zonasını işarələmək"), owner: PEOPLE.store, due: "2026-11-18", done: true }] },
    { id: "INC-0003", ref: "INC-0003", date: "2026-11-14", title: T("Diesel spill at the generator", "Generator yanında dizel dağıldı"), kind: "ENVIRONMENT", severity: "LOW", zone: T("Site compound", "Meydança düşərgəsi"), status: "OPEN", reportedBy: PEOPLE.site, description: T("About 20 litres. Absorbent used; tray needed.", "Təxminən 20 litr. Absorbent istifadə edilib; altlıq lazımdır."), actions: [{ text: T("Fit a drip tray under the generator", "Generatorun altına damcı altlığı qoymaq"), owner: PEOPLE.site, due: "2026-11-19", done: false }] },
  ];
  const permits: Permit[] = [
    { id: "PTW-0011", ref: "PTW-0011", kind: "EXCAVATION", title: T("Admin building strip footings", "İnzibati bina lent bünövrələri"), zone: T("Admin building", "İnzibati bina"), from: "2026-11-10", to: "2026-11-24", status: "ACTIVE", issuedTo: "Abşeron Torpaq İşləri MMC", issuedBy: PEOPLE.qa, activityId: act("AD-120").id, checks: [{ item: T("Services scanned", "Kommunikasiyalar yoxlanılıb"), ok: true }, { item: T("Edge protection", "Kənar mühafizəsi"), ok: true }, { item: T("Daily inspection", "Gündəlik yoxlama"), ok: true }] },
    { id: "PTW-0012", ref: "PTW-0012", kind: "LIFTING", title: T("Crane lifts for rebar cages", "Armatur karkasları üçün kran qaldırma"), zone: T("Warehouse grid 1–9", "Anbar, 1–9 oxları"), from: "2026-11-12", to: "2026-11-16", status: "SUSPENDED", issuedTo: "Atlas Kran İcarəsi", issuedBy: PEOPLE.qa, activityId: act("WH-125").id, checks: [{ item: T("Crane inspection valid", "Kran yoxlaması qüvvədədir"), ok: false }, { item: T("Lift plan approved", "Qaldırma planı təsdiqlənib"), ok: true }] },
    { id: "PTW-0013", ref: "PTW-0013", kind: "HOT_WORK", title: T("Welding embedded plates", "Gömülü lövhələrin qaynağı"), zone: T("Main store", "Əsas anbar"), from: "2026-11-17", to: "2026-11-21", status: "DRAFT", issuedTo: "Polad Montaj MMC", issuedBy: PEOPLE.qa, activityId: act("WH-150").id, checks: [{ item: T("Fire watch assigned", "Yanğın nəzarətçisi təyin edilib"), ok: false }, { item: T("Extinguisher within 5 m", "5 m-də yanğınsöndürən"), ok: true }] },
    { id: "PTW-0009", ref: "PTW-0009", kind: "ELECTRICAL", title: T("Temporary site power", "Müvəqqəti elektrik təchizatı"), zone: T("Site compound", "Meydança düşərgəsi"), from: "2026-10-12", to: "2026-10-18", status: "CLOSED", issuedTo: "Enerji Montaj MMC", issuedBy: PEOPLE.qa, activityId: act("G-020").id, checks: [{ item: T("Isolation locked out", "Ayırma bloklanıb"), ok: true }] },
  ];
  const toolbox: ToolboxTalk[] = [
    { id: "TBT-1", date: "2026-11-17", topic: T("Working near open excavations", "Açıq qazıntılar yaxınlığında iş"), by: PEOPLE.qa, attendees: 41, zone: T("Admin building", "İnzibati bina") },
    { id: "TBT-2", date: "2026-11-13", topic: T("Lifting with tag lines", "İstiqamətləndirici iplə qaldırma"), by: PEOPLE.qa, attendees: 36, zone: T("Main store", "Əsas anbar") },
    { id: "TBT-3", date: "2026-11-10", topic: T("Cold weather and hydration", "Soyuq hava və maye qəbulu"), by: PEOPLE.site, attendees: 44, zone: T("Site wide", "Bütün meydança") },
    { id: "TBT-4", date: "2026-11-06", topic: T("Rebar caps on starter bars", "Buraxılış armaturlarına qoruyucu papaqlar"), by: PEOPLE.qa, attendees: 29, zone: T("Warehouse grid 1–9", "Anbar, 1–9 oxları") },
  ];
  const ppeChecks: PpeCheck[] = [
    { id: "PPE-1", at: `${TODAY}T08:12:00Z`, camera: "CAM-02 Gate", zone: T("Main gate", "Əsas darvaza"), missing: ["HELMET"], status: "WAITING", workerId: "WK-007" },
    { id: "PPE-2", at: `${TODAY}T09:40:00Z`, camera: "CAM-04 Warehouse", zone: T("Warehouse grid C", "Anbar, C oxu"), missing: ["VEST"], status: "WAITING", workerId: null },
    { id: "PPE-3", at: `${addDays(TODAY, -1)}T14:05:00Z`, camera: "CAM-04 Warehouse", zone: T("Warehouse grid C", "Anbar, C oxu"), missing: ["HARNESS"], status: "CONFIRMED", workerId: "WK-013" },
    { id: "PPE-4", at: `${addDays(TODAY, -1)}T10:22:00Z`, camera: "CAM-01 Admin", zone: T("Admin building", "İnzibati bina"), missing: ["GLOVES"], status: "FALSE_ALARM", workerId: null },
  ];

  // ---------------------------------------------------------------- submittals
  const sub = (n: number, en: string, az: string, spec: string, manufacturer: string, rev: number, submitBy: string, actCode: string, lead: number, status: Submittal["status"], material: string | null, sheet: string | null, comments: [string, string] | null = null, mrId: string | null = null): Submittal => {
    const a = act(actCode);
    return { id: `SUB-${String(n).padStart(4, "0")}`, ref: `SUB-${String(n).padStart(4, "0")}`, title: T(en, az), spec, manufacturer, rev, submitBy, requiredOnSite: a.start, leadDays: lead, status, activityId: a.id, material, reviewer: n % 2 ? PEOPLE.engineer : PEOPLE.architect, mrId, sheetId: sheet, comments: comments ? T(comments[0], comments[1]) : null };
  };
  const submittals: Submittal[] = [
    sub(1, "Ready-mix concrete mix design B25", "B25 hazır beton tərkibi", "03 30 00", "Abşeron Beton MMC", 1, "2026-10-10", "WH-120", 2, "APPROVED", "conc_fdn", "KS-7", null, "MR-0001"),
    sub(2, "Rebar mill certificates A500C", "A500C armatur zavod sertifikatları", "03 20 00", "Qafqaz Armatur MMC", 0, "2026-10-14", "WH-125", 9, "APPROVED", "rebar_a500", "KS-12", null, "MR-0002"),
    sub(3, "Steel truss shop drawings F-1", "F-1 ferma sex çertyojları", "05 12 00", "Xəzər Polad Konstruksiya", 2, "2026-11-12", "WH-150", 28, "REVISE", "steel_struct", "KS-21", ["Connection detail must follow the RFI-0004 answer.", "Birləşmə detalı RFI-0004 cavabına uyğun olmalıdır."]),
    sub(4, "Profiled roof sheet H60 sample", "H60 dam profnastili nümunəsi", "07 41 13", "Qala Dam Sistemləri", 0, "2026-11-20", "WH-170", 12, "UNDER_REVIEW", "roof_sheet", "AR-11"),
    sub(5, "Sawn limestone sample panel", "Kəsilmiş əhəng daşı nümunə paneli", "04 43 00", "Bakı Daş Karxanası", 0, "2026-11-25", "WH-180", 7, "SUBMITTED", "wall_limestone", "AR-10"),
    sub(6, "PVC window system", "PVC pəncərə sistemi", "08 53 13", "Nur PVC Pəncərə", 0, "2026-12-10", "AD-180", 21, "DRAFT", "window_pvc", "AR-19"),
    sub(7, "Fire pump set data sheet", "Yanğın nasos qurğusu texniki vərəqi", "21 30 00", "Aqua Mühəndis MMC", 0, "2026-12-01", "PS-120", 35, "DRAFT", null, "MEP-24"),
    sub(8, "Waterproofing membrane SBS 4 mm", "SBS 4 mm hidroizolyasiya membranı", "07 13 00", "Qala Dam Sistemləri", 1, "2026-10-28", "TK-110", 6, "APPROVED_AS_NOTED", "x-membrane", null, ["Lap 100 mm at all joints.", "Bütün birləşmələrdə 100 mm bindirmə."]),
  ];

  // ---------------------------------------------------------------- look-ahead constraints
  const cn = (n: number, actCode: string, kind: Constraint["kind"], en: string, az: string, owner: string, due: string, link: Constraint["link"], status: Constraint["status"] = "OPEN"): Constraint => ({ id: `CN-${String(n).padStart(3, "0")}`, activityId: act(actCode).id, kind, text: T(en, az), status, owner, due, link });
  const constraints: Constraint[] = [
    cn(1, "WH-150", "RFI", "Truss connection detail (RFI-0004)", "Ferma birləşmə detalı (RFI-0004)", PEOPLE.engineer, "2026-11-21", { kind: "RFI", id: "RFI-0004" }),
    cn(2, "WH-150", "MATERIAL", "Steel trusses not ordered yet (RFQ-0003 open)", "Metal fermalar hələ sifariş edilməyib (RFQ-0003 açıqdır)", PEOPLE.buyer, "2026-11-24", { kind: "MR", id: "MR-0003" }),
    cn(3, "WH-160", "EQUIPMENT", "Crane 50 t failed inspection", "50 t kran yoxlamadan keçmədi", PEOPLE.site, "2026-11-20", { kind: "EQUIPMENT", id: "EQ-01" }),
    cn(4, "WH-130", "MATERIAL", "Rebar balance 6 t due 19 Nov (PO-0002)", "Armatur qalığı 6 t, 19 noyabr (PO-0002)", PEOPLE.buyer, "2026-11-19", { kind: "PO", id: "PO-0002" }),
    cn(5, "WH-130", "INSPECTION", "NCR-0001 cover spacers to close", "NCR-0001 aralayıcılar bağlanmalıdır", PEOPLE.qa, "2026-11-19", { kind: "INSPECTION", id: "NCR-0001" }),
    cn(6, "AD-130", "MATERIAL", "Ready-mix for admin frame (PO-0004, 20 Nov)", "İnzibati karkas üçün beton (PO-0004, 20 noyabr)", PEOPLE.buyer, "2026-11-20", { kind: "PO", id: "PO-0004" }, "CLEARED"),
    cn(7, "AD-130", "PERMIT", "Lifting permit renewal", "Qaldırma icazəsinin yenilənməsi", PEOPLE.qa, "2026-11-22", { kind: "PERMIT", id: "PTW-0012" }),
    cn(8, "AD-125", "CREW", "4 more steel fixers needed", "Daha 4 armaturçu lazımdır", "Monolit Beton Qrup", "2026-11-18", null),
    cn(9, "WH-140", "DESIGN", "Column starter bar layout confirmed", "Dirək buraxılış armaturlarının sxemi təsdiqlənib", PEOPLE.engineer, "2026-11-12", { kind: "RFI", id: "RFI-0003" }, "CLEARED"),
    cn(10, "PS-110", "PERMIT", "Excavation permit for pump station", "Nasosxana üçün qazma icazəsi", PEOPLE.qa, "2026-12-01", null),
  ];

  // ---------------------------------------------------------------- portfolio
  const projects: DemoProject[] = [
    { id: "PRJ-QOBU", code: "QOBU", name: T("Qobu warehouse and administration building", "Qobu anbar və inzibati bina"), client: "Cəfərov Mədət İslam oğlu", location: T("Qobu, Absheron", "Qobu, Abşeron"), start: PROJECT_START, finish: "2027-09-08", contractFinish: PROJECT_FINISH, pct: 13.7, plannedPct: 17.2, status: "ACTIVE", health: "at_risk", tasks: b.activities.length, blocked: 1, overdue: 4, openMrs: 7, value: 1_170_000, nextMilestone: { name: T("Warehouse foundations complete", "Anbarın bünövrələri tamamlandı"), date: "2026-12-06" }, source: "QOBU" },
    { id: "PRJ-SUM", code: "SUM-LH", name: T("Sumqayıt logistics hub, phase 2", "Sumqayıt logistika mərkəzi, 2-ci mərhələ"), client: "Caspian Logistics MMC", location: T("Sumqayıt", "Sumqayıt"), start: "2026-03-02", finish: "2027-02-26", contractFinish: "2027-03-15", pct: 61, plannedPct: 58, status: "ACTIVE", health: "on_track", tasks: 118, blocked: 0, overdue: 2, openMrs: 4, value: 3_420_000, nextMilestone: { name: T("Roof closed", "Dam bağlandı"), date: "2026-12-14" }, source: "DEMO" },
    { id: "PRJ-XIR", code: "XIR-SCH4", name: T("Xırdalan school no. 4 extension", "Xırdalan 4 nömrəli məktəbin genişləndirilməsi"), client: "Abşeron Təhsil İdarəsi", location: T("Xırdalan", "Xırdalan"), start: "2026-06-15", finish: "2027-08-20", contractFinish: "2027-07-30", pct: 22, plannedPct: 31, status: "ACTIVE", health: "blocked", tasks: 86, blocked: 3, overdue: 7, openMrs: 9, value: 2_150_000, nextMilestone: { name: T("Ground floor slab", "Birinci mərtəbə plitəsi"), date: "2026-11-28" }, source: "DEMO" },
    { id: "PRJ-GNJ", code: "GNJ-MALL", name: T("Gəncə retail fit-out", "Gəncə ticarət mərkəzinin daxili tərtibatı"), client: "Gəncə Mall MMC", location: T("Gəncə", "Gəncə"), start: "2027-01-11", finish: "2027-06-25", contractFinish: "2027-06-30", pct: 0, plannedPct: 0, status: "PLANNING", health: "on_track", tasks: 64, blocked: 0, overdue: 0, openMrs: 1, value: 880_000, nextMilestone: { name: T("Site handover to contractor", "Meydançanın podratçıya təhvili"), date: "2027-01-11" }, source: "DEMO" },
  ];
  const templates: ProjectTemplate[] = [
    { id: "TPL-1", name: T("Steel-frame warehouse", "Metal karkaslı anbar"), kind: "WAREHOUSE", version: 3, tasks: 42, wbs: 14, milestones: 9, links: 51, days: 320, status: "IN_USE", lanes: [{ name: T("Substructure", "Yeraltı hissə"), start: 10, dur: 70 }, { name: T("Frame and steelwork", "Karkas və metal"), start: 45, dur: 90 }, { name: T("Envelope", "Bina qabığı"), start: 95, dur: 70 }, { name: T("Services and finishes", "Mühəndis sistemləri və bəzək"), start: 130, dur: 150 }, { name: T("Testing and handover", "Sınaq və təhvil"), start: 280, dur: 40 }] },
    { id: "TPL-2", name: T("Two-storey office block", "İkimərtəbəli ofis binası"), kind: "GENERAL", version: 2, tasks: 36, wbs: 12, milestones: 7, links: 40, days: 260, status: "IN_USE", lanes: [{ name: T("Substructure", "Yeraltı hissə"), start: 0, dur: 50 }, { name: T("Frame", "Karkas"), start: 40, dur: 70 }, { name: T("Envelope", "Bina qabığı"), start: 100, dur: 50 }, { name: T("Fit-out", "Daxili işlər"), start: 140, dur: 110 }] },
    { id: "TPL-3", name: T("Villa, per unit", "Villa, hər bina"), kind: "VILLA", version: 5, tasks: 28, wbs: 9, milestones: 6, links: 31, days: 210, status: "IN_USE", lanes: [{ name: T("Foundations", "Bünövrə"), start: 0, dur: 35 }, { name: T("Structure", "Konstruksiya"), start: 30, dur: 60 }, { name: T("Roof", "Dam"), start: 85, dur: 25 }, { name: T("Finishes", "Bəzək"), start: 105, dur: 100 }] },
    { id: "TPL-4", name: T("Retail fit-out", "Ticarət obyektinin daxili tərtibatı"), kind: "FIT_OUT", version: 1, tasks: 22, wbs: 6, milestones: 4, links: 24, days: 140, status: "ARCHIVED", lanes: [{ name: T("Strip-out", "Söküntü"), start: 0, dur: 15 }, { name: T("Services", "Mühəndis sistemləri"), start: 10, dur: 70 }, { name: T("Finishes", "Bəzək"), start: 60, dur: 70 }] },
  ];

  return { programmes, revisions, resources, snapshots, dataDate: TODAY, invoices, payRuns, agreements, priceSeries, invites, equipment, workers, attendance, incidents, permits, toolbox, ppeChecks, submittals, constraints, projects, templates, expedites };
}

export type Phase2 = ReturnType<typeof seedPhase2>;
// Re-exported for page code that wants the material type alongside.
export type { Material, GoodsReceipt };
