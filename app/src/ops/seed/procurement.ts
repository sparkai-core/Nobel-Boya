import { data } from "../../data";
import { addDays } from "../dates";
import type {
  Approval,
  FeedEvent,
  GoodsReceipt,
  HistoryEvent,
  Line,
  Material,
  MaterialRequest,
  Movement,
  Payment,
  ProcException,
  PurchaseOrder,
  QuoteCheck,
  Quotation,
  Rfq,
  StockItem,
  Trade,
  Vendor,
} from "../types";
import { PEOPLE } from "./pm";
import { qtyByRate, rateName, rng, round, T, topItems } from "./util";

// ---------------------------------------------------------------- vendors

const V = (
  id: string,
  name: string,
  trade: Trade,
  trades: Trade[],
  city: string,
  status: Vendor["status"],
  risk: Vendor["risk"],
  scores: [number, number, number, number],
  avg: number,
  contact: string,
  extra: Partial<Vendor> = {},
): Vendor => {
  const [reliability, quality, price, delivery] = scores;
  const overall = round((reliability * 0.3 + quality * 0.3 + price * 0.2 + delivery * 0.2) / 10, 1);
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12) || "vendor";
  return {
    id,
    name,
    trade,
    trades,
    city,
    trn: `${1300000000 + Number(id.slice(2)) * 7919}`,
    licence: `TL-${2019 + (Number(id.slice(2)) % 6)}-${4400 + Number(id.slice(2)) * 13}`,
    contact,
    email: `sales@${slug}.az`,
    phone: `+994 12 ${400 + Number(id.slice(2)) * 7} ${10 + Number(id.slice(2)) * 3} ${20 + Number(id.slice(2))}`,
    website: `www.${slug}.az`,
    paymentTerms: "30 days",
    status,
    risk,
    scores: { reliability, quality, price, delivery },
    overall,
    avgDeliveryDays: avg,
    since: "2021-03-01",
    portal: true,
    note: null,
    history: [
      { project: "Sumqayıt logistics hub", year: 2024, value: 180_000 + Number(id.slice(2)) * 9_000, onTime: reliability > 70 },
      { project: "Xırdalan school no. 4", year: 2025, value: 64_000 + Number(id.slice(2)) * 4_000, onTime: delivery > 65 },
      { project: "Bakı Ağ Şəhər block C", year: 2025, value: 210_000 - Number(id.slice(2)) * 6_000, onTime: true },
    ],
    ...extra,
  };
};

export const VENDORS: Vendor[] = [
  V("V-01", "Abşeron Beton MMC", "Concrete", ["Concrete", "Earthworks and bases"], "Xırdalan", "APPROVED", "LOW", [92, 88, 74, 90], 2, "Anar Səmədov", { paymentTerms: "15 days", since: "2019-05-12", note: T("Two batching plants within 25 km of site.", "Meydançadan 25 km radiusda iki beton zavodu.") }),
  V("V-02", "Qafqaz Armatur MMC", "Reinforcement", ["Reinforcement", "Steel"], "Sumqayıt", "APPROVED", "MEDIUM", [68, 84, 86, 61], 9, "Fərid Quliyev", { note: T("Short delivery on PO-0002. Watch delivery promises.", "PO-0002 üzrə əskik çatdırılma. Çatdırılma vədlərinə diqqət edin.") }),
  V("V-03", "Xəzər Polad Konstruksiya", "Steel", ["Steel"], "Bakı", "APPROVED", "LOW", [88, 93, 70, 84], 28, "Elçin Mirzəyev", { since: "2020-01-20" }),
  V("V-04", "Sumqayıt Metal Servis", "Steel", ["Steel", "Reinforcement"], "Sumqayıt", "APPROVED", "MEDIUM", [72, 76, 90, 58], 40, "Ruslan Əsgərov"),
  V("V-05", "Bakı Daş Karxanası", "Masonry", ["Masonry"], "Qobustan", "APPROVED", "LOW", [84, 80, 82, 79], 7, "Natiq Hümbətov"),
  V("V-06", "Qala Dam Sistemləri", "Roofing", ["Roofing"], "Bakı", "APPROVED", "LOW", [86, 85, 72, 88], 12, "Zaur Əliyev"),
  V("V-07", "Nur PVC Pəncərə", "Doors and windows", ["Doors and windows"], "Gəncə", "APPROVED", "MEDIUM", [74, 78, 84, 70], 21, "Lalə Nəbiyeva"),
  V("V-08", "Elektrik Təchizat Mərkəzi", "Building services", ["Building services"], "Bakı", "APPROVED", "LOW", [81, 83, 77, 85], 6, "Vüsal Kazımov"),
  V("V-09", "Aqua Mühəndis MMC", "Building services", ["Building services"], "Bakı", "APPROVED", "MEDIUM", [70, 82, 79, 66], 24, "Şahin Tağıyev"),
  V("V-10", "Keramika Evi", "Finishes", ["Finishes", "Doors and windows"], "Bakı", "APPROVED", "LOW", [83, 86, 75, 80], 10, "Gülnar Əhmədova"),
  V("V-11", "Gəncə Sement Ticarət", "Earthworks and bases", ["Earthworks and bases", "Concrete", "Masonry"], "Gəncə", "APPROVED", "LOW", [79, 74, 88, 76], 4, "Məhəmməd Rüstəmov"),
  V("V-12", "Yol-İnşaat Asfalt", "External works", ["External works", "Earthworks and bases"], "Şirvan", "APPROVED", "MEDIUM", [73, 77, 85, 72], 5, "Elnur Cəlilov"),
  V("V-13", "Mərkəz İzolyasiya", "Roofing", ["Roofing", "Finishes"], "Bakı", "ON_HOLD", "HIGH", [58, 71, 92, 55], 15, "Tural Abdullayev", { licence: null, note: T("Trade licence expired. On hold until renewed.", "Ticarət lisenziyasının müddəti bitib. Yenilənənə qədər dayandırılıb.") }),
  V("V-14", "Atlas Kran İcarəsi", "Steel", ["Steel"], "Bakı", "APPROVED", "MEDIUM", [77, 80, 68, 82], 3, "Orxan Qəhrəmanov", { paymentTerms: "Monthly in advance" }),
];

// ---------------------------------------------------------------- materials

const EXTRA: Material[] = [
  { key: "x-plywood", name: T("Formwork plywood 18 mm", "Qəlib faneri 18 mm"), unit: "m²", trade: "Concrete", rate: 14.5, budgetQty: 0 },
  { key: "x-wire", name: T("Binding wire 1.2 mm", "Bağlama məftili 1.2 mm"), unit: "kg", trade: "Reinforcement", rate: 2.9, budgetQty: 0 },
  { key: "x-spacers", name: T("Cover spacers 50 mm", "Aralayıcılar 50 mm"), unit: "ədəd", trade: "Reinforcement", rate: 0.18, budgetQty: 0 },
  { key: "x-cement", name: T("Cement M400, 50 kg bags", "Sement M400, 50 kq kisə"), unit: "ədəd", trade: "Concrete", rate: 8.6, budgetQty: 0 },
  { key: "x-membrane", name: T("Bitumen waterproofing membrane", "Bitum hidroizolyasiya membranı"), unit: "m²", trade: "Roofing", rate: 9.8, budgetQty: 0 },
  { key: "x-diesel", name: T("Diesel for plant", "Texnika üçün dizel"), unit: "l", trade: "Earthworks and bases", rate: 1.0, budgetQty: 0 },
  { key: "x-crane", name: T("Mobile crane 50 t hire", "50 t avtokran icarəsi"), unit: "day", trade: "Steel", rate: 720, budgetQty: 0 },
  { key: "x-cable", name: T("Temporary power cable 4 × 25 mm²", "Müvəqqəti elektrik kabeli 4 × 25 mm²"), unit: "m", trade: "Building services", rate: 11.2, budgetQty: 0 },
  { key: "x-board", name: T("Site distribution board 63 A", "Meydança paylayıcı lövhəsi 63 A"), unit: "ədəd", trade: "Building services", rate: 640, budgetQty: 0 },
];

export function buildMaterials(): Material[] {
  const fromBoq: Material[] = Object.entries(data.rates).map(([key, r]) => ({
    key,
    name: rateName(key),
    unit: r.unit,
    trade: r.group as Trade,
    rate: r.rate,
    budgetQty: round(qtyByRate.get(key) ?? 0, 2),
  }));
  return [...fromBoq, ...EXTRA];
}

// ---------------------------------------------------------------- the story

export function seedProcurement(activityByCode: Map<string, { id: string }>, materials: Material[]) {
  const mat = new Map(materials.map((m) => [m.key, m]));
  const act = (code: string) => activityByCode.get(code)?.id ?? null;
  const r = rng(7);

  let lineNo = 0;
  const ml = (key: string, qty: number, spec: string | null = null): Line => {
    const m = mat.get(key)!;
    return { key: `ln-${++lineNo}`, material: key, description: m.name, spec, qty, unit: m.unit };
  };
  const itemLine = (it: (typeof data.items)[number], share = 1): Line => ({
    key: `ln-${++lineNo}`,
    material: it.rate,
    description: { en: it.en, az: it.az },
    spec: null,
    qty: round(it.qty * share, it.unit === "ədəd" || it.unit === "dəst" || it.unit === "komp" ? 0 : 2),
    unit: it.unit,
  });
  const rateOf = (l: Line) => (l.material ? (mat.get(l.material)?.rate ?? 0) : 0);

  // ---- material requests
  const mr = (n: number, p: Omit<MaterialRequest, "id" | "ref">): MaterialRequest => ({ id: `MR-${String(n).padStart(4, "0")}`, ref: `MR-${String(n).padStart(4, "0")}`, ...p });
  const adElec = topItems("AD", "elec", 5).map((i) => itemLine(i));
  const psPlumb = topItems("PS", "plumb", 4).map((i) => itemLine(i));

  const mrs: MaterialRequest[] = [
    mr(1, { title: T("Ready-mix concrete for warehouse footings", "Anbar bünövrələri üçün hazır beton"), status: "FULFILLED", priority: "HIGH", requestedBy: PEOPLE.site, trade: "Concrete", building: "WH", activityId: act("WH-120"), neededBy: "2026-10-28", createdAt: "2026-10-12", submittedAt: "2026-10-12", notes: T("Pump access from the north road. Pours of 20–30 m³.", "Nasos girişi şimal yolundan. Hər dəfə 20–30 m³ betonlama."), source: "BOQ", lines: [ml("conc_fdn", 120, "B25 W6 F150, slump S3"), ml("conc_blind", 34, "B7.5")] }),
    mr(2, { title: T("Rebar for footings and columns", "Bünövrə və dirəklər üçün armatur"), status: "FULFILLED", priority: "URGENT", requestedBy: PEOPLE.site, trade: "Reinforcement", building: "WH", activityId: act("WH-125"), neededBy: "2026-10-30", createdAt: "2026-10-13", submittedAt: "2026-10-13", notes: null, source: "BOQ", lines: [ml("rebar_a500", 18_000, "A500C Ø12–Ø20, 11.7 m bars"), ml("rebar_ai", 2_400, "A240 Ø8 links")] }),
    mr(3, { title: T("Structural steel trusses and bracing", "Metal fermalar və bərkidicilər"), status: "SOURCING", priority: "URGENT", requestedBy: PEOPLE.pm, trade: "Steel", building: "WH", activityId: act("WH-150"), neededBy: "2026-12-14", createdAt: "2026-11-02", submittedAt: "2026-11-03", notes: T("Fabricated, shot-blasted and primed. Delivery in three lots of three trusses.", "Hazırlanmış, qumlanmış və astarlanmış. Üç fermadan ibarət üç partiya ilə çatdırılma."), source: "BOQ", lines: [ml("steel_struct", 26_000, "S255, trusses F-1 × 9, bracing Özr-1/2"), ml("steel_embed", 1_800, "Anchor bolts M20, plates 18 mm")] }),
    mr(4, { title: T("Sawn limestone for warehouse walls", "Anbar divarları üçün kəsilmiş əhəng daşı"), status: "SOURCING", priority: "MEDIUM", requestedBy: PEOPLE.site, trade: "Masonry", building: "WH", activityId: act("WH-180"), neededBy: "2027-01-08", createdAt: "2026-11-08", submittedAt: "2026-11-09", notes: null, source: "PROGRAMME", lines: [ml("wall_limestone", 790, "390 × 190 × 190, M35")] }),
    mr(5, { title: T("Roof sheeting and rainwater goods", "Dam örtüyü və su axıdıcılar"), status: "SOURCING", priority: "MEDIUM", requestedBy: PEOPLE.site, trade: "Roofing", building: "WH", activityId: act("WH-170"), neededBy: "2027-01-18", createdAt: "2026-10-30", submittedAt: "2026-10-30", notes: null, source: "BOQ", lines: [ml("roof_sheet", 1_180, "Profiled sheet H60, 0.7 mm, RAL 9002"), ml("gutter", 96), ml("downpipe", 84), ml("flashing", 210)] }),
    mr(6, { title: T("Ready-mix concrete for the admin frame", "İnzibati bina karkası üçün hazır beton"), status: "SOURCING", priority: "HIGH", requestedBy: PEOPLE.site, trade: "Concrete", building: "AD", activityId: act("AD-130"), neededBy: "2026-11-20", createdAt: "2026-11-04", submittedAt: "2026-11-04", notes: null, source: "BOQ", lines: [ml("conc_col", 22, "B25"), ml("conc_beam", 26, "B25"), ml("conc_slab", 48, "B25")] }),
    mr(7, { title: T("PVC windows and doors, admin building", "İnzibati bina üçün PVC pəncərə və qapılar"), status: "SUBMITTED", priority: "MEDIUM", requestedBy: PEOPLE.qs, trade: "Doors and windows", building: "AD", activityId: act("AD-180"), neededBy: "2027-02-12", createdAt: "2026-11-14", submittedAt: "2026-11-15", notes: T("Sizes subject to RFI-0005.", "Ölçülər RFI-0005-dən asılıdır."), source: "BOQ", lines: [ml("window_pvc", 46, "Double glazed, 5-chamber"), ml("door_pvc", 6), ml("door_mdf", 14)] }),
    mr(8, { title: T("Cables and distribution boards, admin building", "İnzibati bina üçün kabellər və paylayıcı lövhələr"), status: "SUBMITTED", priority: "LOW", requestedBy: PEOPLE.site, trade: "Building services", building: "AD", activityId: act("AD-190"), neededBy: "2027-02-20", createdAt: "2026-11-16", submittedAt: "2026-11-16", notes: null, source: "BOQ", lines: adElec }),
    mr(9, { title: T("Porcelain and ceramic floor tiles", "Keramoqranit və metlax plitələr"), status: "DRAFT", priority: "LOW", requestedBy: PEOPLE.qs, trade: "Finishes", building: "AD", activityId: act("AD-210"), neededBy: "2027-04-12", createdAt: "2026-11-17", submittedAt: null, notes: null, source: "BOQ", lines: [ml("floor_porcelain", 320, "600 × 600, R10"), ml("floor_tile", 140)] }),
    mr(10, { title: T("Fire pumps and pump-station pipework", "Yanğın nasosları və nasosxana boruları"), status: "SOURCING", priority: "HIGH", requestedBy: PEOPLE.buyer, trade: "Building services", building: "PS", activityId: act("PS-120"), neededBy: "2027-01-25", createdAt: "2026-11-10", submittedAt: "2026-11-11", notes: T("Duty point pending RFI-0006.", "İş nöqtəsi RFI-0006-dan asılıdır."), source: "PROGRAMME", lines: psPlumb }),
    mr(11, { title: T("Crushed stone and carbonate fill", "Qırmadaş və karbonat dolğu"), status: "FULFILLED", priority: "MEDIUM", requestedBy: PEOPLE.site, trade: "Earthworks and bases", building: "WH", activityId: act("WH-110"), neededBy: "2026-10-19", createdAt: "2026-10-06", submittedAt: "2026-10-06", notes: null, source: "BOQ", lines: [ml("crushed_stone", 160), ml("fill_carbonate", 240)] }),
    mr(12, { title: T("Asphalt and kerbs for the yard", "Həyət üçün asfalt və bordyurlar"), status: "DRAFT", priority: "LOW", requestedBy: PEOPLE.qs, trade: "External works", building: "SITE", activityId: act("SW-130"), neededBy: "2027-05-17", createdAt: "2026-11-16", submittedAt: null, notes: null, source: "PROGRAMME", lines: [ml("asphalt_coarse", 2_400), ml("asphalt_fine", 2_400), ml("kerb", 860)] }),
  ];
  const mrById = new Map(mrs.map((m) => [m.id, m]));

  // ---- RFQs
  const inv = (vendorId: string, status: Rfq["invitations"][number]["status"], at: string, reason: string | null = null) => ({ vendorId, status, at, reason });
  const rfq = (n: number, mrId: string | null, p: Omit<Rfq, "id" | "ref" | "mrId" | "lines"> & { lines?: Line[] }): Rfq => ({
    id: `RFQ-${String(n).padStart(4, "0")}`,
    ref: `RFQ-${String(n).padStart(4, "0")}`,
    mrId,
    lines: p.lines ?? (mrId ? mrById.get(mrId)!.lines.map((l) => ({ ...l, key: `${l.key}-q` })) : []),
    ...p,
  });
  const rfqs: Rfq[] = [
    rfq(1, "MR-0001", { title: T("Ready-mix B25 and B7.5, warehouse footings", "Hazır beton B25 və B7.5, anbar bünövrələri"), status: "AWARDED", trade: "Concrete", createdAt: "2026-10-13", dueDate: "2026-10-17", note: null, invitations: [inv("V-01", "SUBMITTED", "2026-10-15"), inv("V-11", "SUBMITTED", "2026-10-16")], awardedQuoteId: "QT-0001" }),
    rfq(2, "MR-0002", { title: T("Rebar A500C and A240", "A500C və A240 armatur"), status: "AWARDED", trade: "Reinforcement", createdAt: "2026-10-14", dueDate: "2026-10-18", note: null, invitations: [inv("V-02", "SUBMITTED", "2026-10-16"), inv("V-04", "SUBMITTED", "2026-10-17")], awardedQuoteId: "QT-0003" }),
    rfq(3, "MR-0003", { title: T("Steel trusses F-1 and bracing", "F-1 metal fermaları və bərkidicilər"), status: "OPEN", trade: "Steel", createdAt: "2026-11-04", dueDate: "2026-11-24", note: T("Price fabrication, blasting, priming and delivery. Connection plates per RFI-0004 to be priced as a separate rate.", "Hazırlıq, qumlama, astar və çatdırılma qiymətləndirilsin. RFI-0004 üzrə birləşmə lövhələri ayrıca qiymət kimi verilsin."), invitations: [inv("V-03", "SUBMITTED", "2026-11-12"), inv("V-04", "SUBMITTED", "2026-11-14"), inv("V-02", "ACKNOWLEDGED", "2026-11-06")], awardedQuoteId: null }),
    rfq(4, "MR-0004", { title: T("Sawn limestone 390 × 190 × 190", "Kəsilmiş əhəng daşı 390 × 190 × 190"), status: "OPEN", trade: "Masonry", createdAt: "2026-11-10", dueDate: "2026-11-21", note: null, invitations: [inv("V-05", "SUBMITTED", "2026-11-14"), inv("V-11", "INVITED", "2026-11-10")], awardedQuoteId: null }),
    rfq(5, "MR-0005", { title: T("Roof sheeting and rainwater goods", "Dam örtüyü və su axıdıcılar"), status: "CLOSED", trade: "Roofing", createdAt: "2026-10-31", dueDate: "2026-11-10", note: null, invitations: [inv("V-06", "SUBMITTED", "2026-11-06"), inv("V-13", "SUBMITTED", "2026-11-07"), inv("V-04", "DECLINED", "2026-11-03", "No capacity before February")], awardedQuoteId: null }),
    rfq(6, "MR-0006", { title: T("Ready-mix B25, admin frame", "Hazır beton B25, inzibati bina karkası"), status: "AWARDED", trade: "Concrete", createdAt: "2026-11-05", dueDate: "2026-11-09", note: null, invitations: [inv("V-01", "SUBMITTED", "2026-11-07"), inv("V-11", "SUBMITTED", "2026-11-08")], awardedQuoteId: "QT-0010" }),
    rfq(7, "MR-0010", { title: T("Fire pump set and pump-station pipework", "Yanğın nasos qurğusu və nasosxana boruları"), status: "OPEN", trade: "Building services", createdAt: "2026-11-12", dueDate: "2026-11-26", note: T("Duty point to follow (RFI-0006). Price the pumps as an alternative per duty.", "İş nöqtəsi sonra veriləcək (RFI-0006)."), invitations: [inv("V-09", "ACKNOWLEDGED", "2026-11-13"), inv("V-08", "INVITED", "2026-11-12")], awardedQuoteId: null }),
    rfq(8, null, { title: T("Waterproofing membrane for tanks and footings", "Çənlər və bünövrələr üçün hidroizolyasiya membranı"), status: "AWARDED", trade: "Roofing", createdAt: "2026-10-20", dueDate: "2026-10-27", note: null, lines: [ml("x-membrane", 1_450, "SBS 4 mm, two layers")], invitations: [inv("V-13", "SUBMITTED", "2026-10-24"), inv("V-06", "SUBMITTED", "2026-10-26")], awardedQuoteId: "QT-0015" }),
  ];
  const rfqById = new Map(rfqs.map((x) => [x.id, x]));

  // ---- quotations
  const checks = (over: number, conf: number, trnOk = true, expiring = false): QuoteCheck[] => [
    { label: T("Vendor details match the register", "Təchizatçı məlumatları reyestrə uyğundur"), result: trnOk ? "PASSED" : "FAILED", detail: trnOk ? T("TRN and licence found.", "VÖEN və lisenziya tapıldı.") : T("Trade licence expired.", "Ticarət lisenziyasının müddəti bitib.") },
    { label: T("Every requested line is priced", "Bütün tələb olunan sətirlər qiymətləndirilib"), result: "PASSED", detail: T("All lines matched.", "Bütün sətirlər uyğunlaşdırıldı.") },
    { label: T("Lines add up to the total", "Sətirlərin cəmi yekuna bərabərdir"), result: "PASSED", detail: T("Arithmetic checked.", "Hesab yoxlanıldı.") },
    { label: T("Price against the BOQ budget", "Qiymət smeta büdcəsinə qarşı"), result: over > 0.08 ? "WARNING" : "PASSED", detail: over > 0 ? T(`${Math.round(over * 100)}% above the BOQ rate.`, `Smeta qiymətindən ${Math.round(over * 100)}% yuxarı.`) : T(`${Math.round(-over * 100)}% below the BOQ rate.`, `Smeta qiymətindən ${Math.round(-over * 100)}% aşağı.`) },
    { label: T("Reading confidence", "Oxunma etibarlılığı"), result: conf < 0.75 ? "FAILED" : conf < 0.88 ? "WARNING" : "PASSED", detail: T(`${Math.round(conf * 100)}% average.`, `Orta ${Math.round(conf * 100)}%.`) },
    { label: T("Price holds long enough", "Qiymət kifayət qədər qüvvədədir"), result: expiring ? "WARNING" : "PASSED", detail: expiring ? T("Expires within 7 days.", "7 gün ərzində bitir.") : T("Valid for 30 days or more.", "30 gün və ya daha çox qüvvədədir.") },
  ];
  const hist = (receivedAt: string, source: Quotation["source"], vendor: string): HistoryEvent[] => [
    { at: `${receivedAt}T09:12:00Z`, actor: source === "PORTAL" ? "VENDOR" : "USER", text: source === "PORTAL" ? T(`${vendor} sent the quote through the vendor portal`, `${vendor} təklifi təchizatçı portalı vasitəsilə göndərdi`) : T("Quote file uploaded", "Təklif faylı yükləndi") },
    { at: `${receivedAt}T09:12:40Z`, actor: "AI", text: T("Lines read and matched to the request", "Sətirlər oxundu və sorğu ilə uyğunlaşdırıldı") },
    { at: `${receivedAt}T09:13:05Z`, actor: "SYSTEM", text: T("Checks run against the BOQ and vendor register", "Smeta və təchizatçı reyestri üzrə yoxlamalar aparıldı") },
  ];
  let qn = 0;
  const vendorName = (id: string) => VENDORS.find((v) => v.id === id)!.name;
  const quote = (rfqId: string | null, vendorId: string, factor: number, p: Partial<Quotation> & { receivedAt: string; deliveryDays: number }, lines?: Line[]): Quotation => {
    const id = `QT-${String(++qn).padStart(4, "0")}`;
    const src = lines ?? rfqById.get(rfqId!)!.lines;
    const conf = p.confidence ?? round(0.88 + r() * 0.1, 2);
    const qlines = src.map((l, i) => ({
      key: `${id}-${i}`,
      description: l.description,
      qty: l.qty,
      unit: l.unit,
      unitPrice: round(rateOf(l) * factor * (0.97 + r() * 0.06), 2),
      confidence: round(Math.min(0.99, conf + (r() - 0.5) * 0.08), 2),
      match: (conf < 0.75 && i === 0 ? "REVIEW" : "MATCHED") as "REVIEW" | "MATCHED",
    }));
    const source = p.source ?? "PORTAL";
    return {
      id,
      ref: `${vendorName(vendorId).split(" ")[0]!.slice(0, 3).toUpperCase()}-${2026}-${String(140 + qn * 7)}`,
      rfqId,
      vendorId,
      status: "EXTRACTED",
      source,
      validUntil: addDays(p.receivedAt, 30),
      paymentTerms: VENDORS.find((v) => v.id === vendorId)!.paymentTerms,
      vatRate: 0.18,
      shipping: 0,
      lines: qlines,
      risk: "LOW",
      confidence: conf,
      checks: checks(factor - 1, conf),
      duplicate: false,
      notes: null,
      history: hist(p.receivedAt, source, vendorName(vendorId)),
      outcome: null,
      ...p,
    };
  };
  const quotes: Quotation[] = [
    quote("RFQ-0001", "V-01", 0.97, { receivedAt: "2026-10-15", deliveryDays: 2, outcome: "WON", shipping: 0 }),
    quote("RFQ-0001", "V-11", 1.04, { receivedAt: "2026-10-16", deliveryDays: 3, outcome: "LOST", source: "UPLOAD" }),
    quote("RFQ-0002", "V-02", 0.95, { receivedAt: "2026-10-16", deliveryDays: 9, outcome: "WON", shipping: 450 }),
    quote("RFQ-0002", "V-04", 0.99, { receivedAt: "2026-10-17", deliveryDays: 14, outcome: "LOST" }),
    quote("RFQ-0003", "V-03", 1.02, { receivedAt: "2026-11-12", deliveryDays: 28, shipping: 1_200, notes: T("Connection plates priced at 5.10 AZN/kg as a separate rate.", "Birləşmə lövhələri ayrıca 5.10 AZN/kq qiymətləndirilib.") }),
    quote("RFQ-0003", "V-04", 0.93, { receivedAt: "2026-11-14", deliveryDays: 40, shipping: 2_400, risk: "MEDIUM", source: "UPLOAD", notes: T("Delivery from week 2 of January.", "Çatdırılma yanvarın 2-ci həftəsindən.") }),
    quote("RFQ-0004", "V-05", 1.01, { receivedAt: "2026-11-14", deliveryDays: 7, status: "NEEDS_REVIEW", confidence: 0.62, source: "UPLOAD" }),
    quote("RFQ-0005", "V-06", 1.03, { receivedAt: "2026-11-06", deliveryDays: 12, shipping: 380 }),
    quote("RFQ-0005", "V-13", 0.91, { receivedAt: "2026-11-07", deliveryDays: 15, risk: "HIGH", source: "UPLOAD" }),
    quote("RFQ-0006", "V-01", 0.98, { receivedAt: "2026-11-07", deliveryDays: 2, outcome: "WON" }),
    quote("RFQ-0006", "V-11", 1.06, { receivedAt: "2026-11-08", deliveryDays: 3, outcome: "LOST" }),
    quote(null, "V-14", 1.0, { receivedAt: "2026-11-11", deliveryDays: 3, validUntil: "2026-11-20", source: "UPLOAD", notes: T("12 months hire of a 50 t mobile crane with operator, 10 days per month.", "Operatorla 50 t avtokranın 12 aylıq icarəsi, ayda 10 gün.") }, [ml("x-crane", 120, "50 t, with operator")]),
    quote("RFQ-0008", "V-13", 0.94, { receivedAt: "2026-10-24", deliveryDays: 6, outcome: "LOST" }),
    quote("RFQ-0008", "V-13", 0.94, { receivedAt: "2026-10-25", deliveryDays: 6, duplicate: true, source: "UPLOAD", outcome: "LOST" }),
    quote("RFQ-0008", "V-06", 1.0, { receivedAt: "2026-10-26", deliveryDays: 5, outcome: "WON" }),
  ];
  // Quote-specific check tweaks
  const q = (id: string) => quotes.find((x) => x.id === id)!;
  q("QT-0007").checks = checks(0.01, 0.62);
  q("QT-0009").checks = checks(-0.09, 0.93, false);
  q("QT-0012").checks = checks(0, 0.94, true, true);
  q("QT-0014").checks = [{ label: T("Not a duplicate of an earlier quote", "Əvvəlki təklifin təkrarı deyil"), result: "FAILED", detail: T("Same total and reference as QT-0013.", "QT-0013 ilə eyni yekun və nömrə.") }, ...checks(-0.06, 0.95)];
  q("QT-0014").ref = q("QT-0013").ref;

  // ---- money helpers
  const quoteNet = (x: Quotation) => x.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const quoteTotal = (x: Quotation) => round(quoteNet(x) * (1 + x.vatRate) + x.shipping, 2);

  // ---- approvals
  const approval = (n: number, quoteId: string, p: Partial<Approval>): Approval => {
    const qq = q(quoteId);
    const amount = quoteTotal(qq);
    const rq = qq.rfqId ? rfqById.get(qq.rfqId) : null;
    return {
      id: `APR-${String(n).padStart(4, "0")}`,
      ref: `APR-${String(n).padStart(4, "0")}`,
      quoteId,
      rfqId: qq.rfqId,
      vendorId: qq.vendorId,
      title: rq?.title ?? T("Mobile crane hire, 12 months", "Avtokran icarəsi, 12 ay"),
      amount,
      status: "APPROVED",
      requiredLevels: amount > 50_000 ? 2 : 1,
      level: amount > 50_000 ? 2 : 1,
      requestedBy: PEOPLE.buyer,
      requestedAt: addDays(qq.receivedAt, 1),
      firstBy: PEOPLE.pm,
      firstAt: addDays(qq.receivedAt, 2),
      finalBy: amount > 50_000 ? PEOPLE.director : PEOPLE.pm,
      finalAt: addDays(qq.receivedAt, 2),
      notes: null,
      severity: amount > 50_000 ? "HIGH" : "LOW",
      poId: null,
      ...p,
    };
  };
  const approvals: Approval[] = [
    approval(1, "QT-0001", { poId: "PO-0001" }),
    approval(2, "QT-0003", { poId: "PO-0002" }),
    approval(3, "QT-0010", { poId: "PO-0004" }),
    approval(4, "QT-0015", { poId: "PO-0005" }),
    approval(5, "QT-0008", { status: "PENDING", level: 0, firstBy: null, firstAt: null, finalBy: null, finalAt: null, requestedAt: "2026-11-12", severity: "MEDIUM", notes: "Cheapest quote (Mərkəz İzolyasiya) is on hold — recommending Qala Dam." }),
    approval(6, "QT-0012", { status: "PENDING", level: 1, finalBy: null, finalAt: null, requestedAt: "2026-11-13", firstAt: "2026-11-14", severity: "HIGH" }),
  ];

  // ---- purchase orders
  const poFromQuote = (n: number, quoteId: string, p: Partial<PurchaseOrder> & { issuedAt: string; expectedAt: string }, receivedShare: number[] = []): PurchaseOrder => {
    const qq = q(quoteId);
    const rq = qq.rfqId ? rfqById.get(qq.rfqId) : null;
    const id = `PO-${String(n).padStart(4, "0")}`;
    return {
      id,
      ref: id,
      vendorId: qq.vendorId,
      quoteId,
      approvalId: approvals.find((a) => a.quoteId === quoteId)?.id ?? null,
      rfqId: qq.rfqId,
      mrId: rq?.mrId ?? null,
      status: "ISSUED",
      paymentTerms: qq.paymentTerms,
      deliverTo: T("Qobu site, main gate, Absheron district", "Qobu meydançası, əsas darvaza, Abşeron rayonu"),
      vatRate: qq.vatRate,
      shipping: qq.shipping,
      lines: qq.lines.map((l, i) => ({
        key: `${id}-${i}`,
        material: rq?.lines[i]?.material ?? null,
        description: l.description,
        qty: l.qty,
        unit: l.unit,
        rate: l.unitPrice,
        received: round(l.qty * (receivedShare[i] ?? 0), 2),
      })),
      vendorAck: "ACCEPTED",
      dispatchedAt: null,
      dispatchNote: null,
      ...p,
    };
  };
  const poDirect = (n: number, vendorId: string, lines: Line[], factor: number, p: Partial<PurchaseOrder> & { issuedAt: string; expectedAt: string }, receivedShare: number[] = []): PurchaseOrder => {
    const id = `PO-${String(n).padStart(4, "0")}`;
    return {
      id,
      ref: id,
      vendorId,
      quoteId: null,
      approvalId: null,
      rfqId: null,
      mrId: null,
      status: "ISSUED",
      paymentTerms: VENDORS.find((v) => v.id === vendorId)!.paymentTerms,
      deliverTo: T("Qobu site, main gate, Absheron district", "Qobu meydançası, əsas darvaza, Abşeron rayonu"),
      vatRate: 0.18,
      shipping: 0,
      lines: lines.map((l, i) => ({ key: `${id}-${i}`, material: l.material, description: l.description, qty: l.qty, unit: l.unit, rate: round(rateOf(l) * factor, 2), received: round(l.qty * (receivedShare[i] ?? 0), 2) })),
      vendorAck: "ACCEPTED",
      dispatchedAt: null,
      dispatchNote: null,
      ...p,
    };
  };

  const pos: PurchaseOrder[] = [
    poFromQuote(1, "QT-0001", { status: "CLOSED", issuedAt: "2026-10-16", expectedAt: "2026-10-26" }, [1, 1]),
    poFromQuote(2, "QT-0003", { status: "PART_RECEIVED", issuedAt: "2026-10-18", expectedAt: "2026-11-03", dispatchedAt: null }, [12_000 / 18_000, 1]),
    poDirect(3, "V-11", mrs[10]!.lines, 0.96, { status: "CLOSED", issuedAt: "2026-10-08", expectedAt: "2026-10-15", mrId: "MR-0011" }, [1, 1]),
    poFromQuote(4, "QT-0010", { status: "ISSUED", issuedAt: "2026-11-10", expectedAt: "2026-11-20", dispatchedAt: null }),
    poFromQuote(5, "QT-0015", { status: "ISSUED", issuedAt: "2026-11-15", expectedAt: "2026-11-25", vendorAck: "PENDING" }),
    poDirect(6, "V-02", [ml("rebar_ai", 1_600, "A240 Ø8 links"), ml("x-wire", 300), ml("x-spacers", 4_000, "50 mm")], 0.97, { status: "ISSUED", issuedAt: "2026-11-11", expectedAt: "2026-11-18", dispatchedAt: "2026-11-16", dispatchNote: "Truck 10-QA-417, driver Ilqar" }),
    poDirect(7, "V-12", [ml("gravel", 180, "Fraction 20–40")], 0.98, { status: "CLOSED", issuedAt: "2026-10-07", expectedAt: "2026-10-12" }, [1]),
    poDirect(8, "V-08", [ml("x-cable", 420), ml("x-board", 3)], 1.0, { status: "PART_RECEIVED", issuedAt: "2026-10-09", expectedAt: "2026-10-16" }, [1, 2 / 3]),
  ];

  // ---- goods receipts
  const grn = (n: number, po: PurchaseOrder, p: Partial<GoodsReceipt>, accepted: number[], prior: number[] = [], short: (GoodsReceipt["lines"][number]["shortReason"])[] = []): GoodsReceipt => ({
    id: `GRN-${String(n).padStart(4, "0")}`,
    ref: `GRN-${String(n).padStart(4, "0")}`,
    poId: po.id,
    vendorId: po.vendorId,
    status: "RECEIVED",
    receivedAt: null,
    receivedBy: PEOPLE.store,
    remarks: null,
    lines: po.lines.map((l, i) => ({ key: `${l.key}-g${n}`, material: l.material, description: l.description, unit: l.unit, ordered: l.qty, prior: prior[i] ?? 0, accepted: accepted[i] ?? 0, shortReason: short[i] ?? null })),
    ...p,
  });
  const P = (id: string) => pos.find((x) => x.id === id)!;
  const grns: GoodsReceipt[] = [
    grn(1, P("PO-0001"), { status: "PART_RECEIVED", receivedAt: "2026-10-23" }, [80, 34]),
    grn(2, P("PO-0001"), { status: "RECEIVED", receivedAt: "2026-10-26" }, [40, 0], [80, 34]),
    grn(3, P("PO-0002"), { status: "PART_RECEIVED", receivedAt: "2026-11-03", remarks: "Two bundles of Ø16 missing. Driver had no paperwork for them." }, [12_000, 2_400], [], ["NOT_DELIVERED", null]),
    grn(4, P("PO-0003"), { status: "RECEIVED", receivedAt: "2026-10-14" }, [160, 240]),
    grn(5, P("PO-0007"), { status: "RECEIVED", receivedAt: "2026-10-11" }, [180]),
    grn(6, P("PO-0006"), { status: "DRAFT", receivedAt: null, receivedBy: null }, [0, 0, 0]),
    grn(7, P("PO-0008"), { status: "PART_RECEIVED", receivedAt: "2026-10-16", remarks: "One distribution board arrived with a cracked door." }, [420, 2], [], [null, "DAMAGED"]),
  ];

  // ---- payments
  const poNet = (po: PurchaseOrder) => po.lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const poTotal = (po: PurchaseOrder) => round(poNet(po) * (1 + po.vatRate) + po.shipping, 2);
  const pay = (n: number, po: PurchaseOrder, share: number, p: Partial<Payment> & { dueDate: string }): Payment => ({
    id: `PAY-${String(n).padStart(4, "0")}`,
    ref: `PAY-${String(n).padStart(4, "0")}`,
    poId: po.id,
    vendorId: po.vendorId,
    amount: round(poTotal(po) * share, 2),
    kind: "ON_DELIVERY",
    status: "SCHEDULED",
    paidAt: null,
    method: null,
    bankRef: null,
    holdReason: null,
    ...p,
  });
  const payments: Payment[] = [
    pay(1, P("PO-0001"), 1, { status: "PAID", dueDate: "2026-11-10", paidAt: "2026-11-09", method: "Bank transfer", bankRef: "KB-26110917" }),
    pay(2, P("PO-0002"), 0.3, { kind: "ADVANCE", status: "PAID", dueDate: "2026-10-20", paidAt: "2026-10-20", method: "Bank transfer", bankRef: "KB-26102044" }),
    pay(3, P("PO-0002"), 0.7, { status: "SCHEDULED", dueDate: "2026-12-03" }),
    pay(4, P("PO-0003"), 1, { status: "PAID", dueDate: "2026-11-13", paidAt: "2026-11-12", method: "Bank transfer", bankRef: "KB-26111203" }),
    pay(5, P("PO-0004"), 1, { status: "SCHEDULED", dueDate: "2026-12-05" }),
    pay(6, P("PO-0005"), 1, { status: "SCHEDULED", dueDate: "2026-12-25" }),
    pay(7, P("PO-0006"), 1, { status: "SCHEDULED", dueDate: "2026-12-18" }),
    pay(8, P("PO-0007"), 1, { status: "READY", dueDate: "2026-11-11" }),
    pay(9, P("PO-0008"), 1, { status: "ON_HOLD", dueDate: "2026-11-15", holdReason: "One distribution board damaged; replacement awaited." }),
  ];

  // ---- exceptions
  const ex = (n: number, quoteId: string, p: Omit<ProcException, "id" | "quoteId" | "history">): ProcException => ({
    id: `EX-${String(n).padStart(4, "0")}`,
    quoteId,
    history: [{ at: `${p.raisedAt}T10:02:00Z`, actor: "SYSTEM", text: T("Held by the automatic checks", "Avtomatik yoxlamalar tərəfindən saxlanıldı") }],
    ...p,
  });
  const exceptions: ProcException[] = [
    ex(1, "QT-0014", { reason: "DUPLICATE", stage: "READ", severity: "warning", status: "open", assignee: null, raisedAt: "2026-10-25", detail: T("Same reference and total as QT-0013 from the same vendor.", "Eyni təchizatçıdan QT-0013 ilə eyni nömrə və yekun."), action: "review" }),
    ex(2, "QT-0007", { reason: "LOW_CONFIDENCE", stage: "READ", severity: "critical", status: "assigned", assignee: PEOPLE.buyer, raisedAt: "2026-11-14", detail: T("Scanned at an angle: 62% reading confidence on the unit price.", "Əyri skan olunub: vahid qiymətin oxunma etibarlılığı 62%."), action: "re_extract" }),
    ex(3, "QT-0009", { reason: "MISSING_TRN", stage: "RISK", severity: "critical", status: "open", assignee: null, raisedAt: "2026-11-07", detail: T("Vendor is on hold: trade licence expired on 30 September.", "Təchizatçı dayandırılıb: ticarət lisenziyası 30 sentyabrda bitib."), action: "validate" }),
    ex(4, "QT-0012", { reason: "EXPIRING", stage: "CHECK", severity: "warning", status: "open", assignee: null, raisedAt: "2026-11-15", detail: T("Price holds only until 20 November and approval is still pending.", "Qiymət yalnız 20 noyabra qədər qüvvədədir, təsdiq isə hələ gözlənilir."), action: "review" }),
    ex(5, "QT-0008", { reason: "OVER_BUDGET", stage: "CHECK", severity: "warning", status: "resolved", assignee: PEOPLE.buyer, raisedAt: "2026-11-06", detail: T("3% above the BOQ budget for roof sheeting.", "Dam örtüyü üzrə smeta büdcəsindən 3% yuxarı."), action: "review" }),
  ];

  // ---- stock
  const stockItem = (key: string, store: StockItem["store"], onHand: number, reorder: number, updatedAt: string): StockItem => {
    const m = mat.get(key)!;
    return { key, name: m.name, unit: m.unit, trade: m.trade, store, onHand, reorder, updatedAt };
  };
  const stock: StockItem[] = [
    stockItem("rebar_a500", "Main store", 3_900, 3_000, "2026-11-16"),
    stockItem("rebar_ai", "Main store", 820, 800, "2026-11-15"),
    stockItem("steel_embed", "Main store", 140, 300, "2026-11-12"),
    stockItem("crushed_stone", "Warehouse site", 52, 40, "2026-11-14"),
    stockItem("fill_carbonate", "Warehouse site", 96, 60, "2026-11-10"),
    stockItem("gravel", "Main store", 54, 30, "2026-11-08"),
    stockItem("sand_cement", "Admin site", 0, 10, "2026-11-01"),
    stockItem("x-plywood", "Main store", 260, 150, "2026-11-13"),
    stockItem("x-wire", "Main store", 96, 80, "2026-11-16"),
    stockItem("x-spacers", "Main store", 600, 2_000, "2026-11-12"),
    stockItem("x-cement", "Admin site", 140, 100, "2026-11-15"),
    stockItem("x-membrane", "Main store", 0, 200, "2026-11-15"),
    stockItem("x-diesel", "Main store", 2_150, 1_500, "2026-11-17"),
    stockItem("x-cable", "Main store", 60, 50, "2026-11-02"),
    stockItem("x-board", "Main store", 0, 0, "2026-10-16"),
    stockItem("kerb", "Warehouse site", 0, 0, "2026-10-01"),
    stockItem("wall_limestone", "Warehouse site", 0, 0, "2026-11-01"),
    stockItem("roof_sheet", "Warehouse site", 0, 0, "2026-11-01"),
  ];

  const movements: Movement[] = [
    { id: "MV-1", key: "rebar_a500", type: "RECEIPT", qty: 12_000, at: "2026-11-03", ref: "GRN-0003", note: null, activityId: null },
    { id: "MV-2", key: "rebar_a500", type: "ISSUE", qty: -5_200, at: "2026-11-06", ref: "IS-0011", note: T("Footings Ms-1 and Ms-2", "Ms-1 və Ms-2 bünövrələri"), activityId: act("WH-125") },
    { id: "MV-3", key: "rebar_a500", type: "ISSUE", qty: -2_900, at: "2026-11-13", ref: "IS-0016", note: T("Admin strip foundations", "İnzibati bina lent bünövrəsi"), activityId: act("AD-125") },
    { id: "MV-4", key: "rebar_ai", type: "RECEIPT", qty: 2_400, at: "2026-11-03", ref: "GRN-0003", note: null, activityId: null },
    { id: "MV-5", key: "rebar_ai", type: "ISSUE", qty: -1_580, at: "2026-11-15", ref: "IS-0018", note: null, activityId: act("WH-125") },
    { id: "MV-6", key: "crushed_stone", type: "RECEIPT", qty: 160, at: "2026-10-14", ref: "GRN-0004", note: null, activityId: null },
    { id: "MV-7", key: "crushed_stone", type: "ISSUE", qty: -122, at: "2026-10-28", ref: "IS-0006", note: null, activityId: act("WH-110") },
    { id: "MV-8", key: "fill_carbonate", type: "RECEIPT", qty: 240, at: "2026-10-14", ref: "GRN-0004", note: null, activityId: null },
    { id: "MV-9", key: "fill_carbonate", type: "ISSUE", qty: -144, at: "2026-11-10", ref: "IS-0014", note: null, activityId: act("WH-110") },
    { id: "MV-10", key: "x-spacers", type: "ADJUSTMENT", qty: -150, at: "2026-11-12", ref: "SC-0003", note: T("Count after NCR-0001", "NCR-0001-dən sonra sayım"), activityId: null },
    { id: "MV-11", key: "gravel", type: "RECEIPT", qty: 180, at: "2026-10-11", ref: "GRN-0005", note: null, activityId: null },
    { id: "MV-12", key: "gravel", type: "ISSUE", qty: -126, at: "2026-10-20", ref: "IS-0004", note: T("Site access road", "Meydançaya giriş yolu"), activityId: act("G-020") },
    { id: "MV-13", key: "x-cable", type: "RECEIPT", qty: 420, at: "2026-10-16", ref: "GRN-0007", note: null, activityId: null },
    { id: "MV-14", key: "x-cable", type: "ISSUE", qty: -360, at: "2026-10-18", ref: "IS-0003", note: T("Temporary site power", "Müvəqqəti elektrik təchizatı"), activityId: act("G-020") },
  ];

  const feed: FeedEvent[] = [
    { id: "F-1", at: "2026-11-17T08:40:00Z", module: "PM", text: T("Daily report for 17 November started by Rauf Əliyev", "17 noyabr gündəlik hesabatına Rauf Əliyev başladı"), link: "pm/daily-reports", actor: PEOPLE.site },
    { id: "F-2", at: "2026-11-16T16:20:00Z", module: "VENDOR", text: T("Qafqaz Armatur MMC dispatched PO-0006", "Qafqaz Armatur MMC PO-0006-nı yola saldı"), link: "procurement/orders/PO-0006", actor: "Qafqaz Armatur MMC" },
    { id: "F-3", at: "2026-11-16T11:05:00Z", module: "PM", text: T("Crane failed inspection: WH-160 at risk", "Kran yoxlamadan keçmədi: WH-160 risk altındadır"), link: "pm/live", actor: PEOPLE.site },
    { id: "F-4", at: "2026-11-15T14:30:00Z", module: "PROC", text: T("PO-0005 issued to Qala Dam Sistemləri", "PO-0005 Qala Dam Sistemlərinə verildi"), link: "procurement/orders/PO-0005", actor: PEOPLE.buyer },
    { id: "F-5", at: "2026-11-14T15:10:00Z", module: "VENDOR", text: T("Sumqayıt Metal Servis sent a quote for RFQ-0003", "Sumqayıt Metal Servis RFQ-0003 üçün təklif göndərdi"), link: "procurement/rfqs/RFQ-0003", actor: "Sumqayıt Metal Servis" },
    { id: "F-6", at: "2026-11-14T09:45:00Z", module: "PROC", text: T("First approval given for the 12-month crane hire", "12 aylıq kran icarəsi üçün ilk təsdiq verildi"), link: "procurement/approvals/APR-0006", actor: PEOPLE.pm },
    { id: "F-7", at: "2026-11-12T17:00:00Z", module: "PM", text: T("WIR-0004 failed: cover spacers missing on Ms-3", "WIR-0004 keçmədi: Ms-3-də aralayıcılar yoxdur"), link: "pm/inspections/WIR-0004", actor: PEOPLE.engineer },
    { id: "F-8", at: "2026-11-11T10:00:00Z", module: "PM", text: T("Change VO-0002 raised from RFI-0004", "RFI-0004 əsasında VO-0002 dəyişikliyi açıldı"), link: "pm/changes/VO-0002", actor: PEOPLE.qs },
    { id: "F-9", at: "2026-11-06T12:30:00Z", module: "PM", text: T("Critical delay DL-0003: truss detail missing", "Kritik gecikmə DL-0003: ferma detalı yoxdur"), link: "pm/delays", actor: PEOPLE.pm },
    { id: "F-10", at: "2026-11-03T15:40:00Z", module: "PROC", text: T("GRN-0003 posted short: 6 t rebar outstanding", "GRN-0003 əskik qəbul edildi: 6 t armatur qalır"), link: "procurement/receipts/GRN-0003", actor: PEOPLE.store },
  ];

  return { vendors: VENDORS, materials, mrs, rfqs, quotes, approvals, pos, grns, stock, movements, exceptions, payments, feed };
}
