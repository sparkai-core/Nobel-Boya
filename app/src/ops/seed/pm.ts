import { addDays, diffDays, maxDate, PROJECT_FINISH, PROJECT_START, TODAY } from "../dates";
import type {
  Activity,
  CalendarDay,
  ChangeOrder,
  DailyReport,
  DelayEvent,
  Dependency,
  Inspection,
  Ipc,
  LiveImpact,
  Milestone,
  Party,
  ProgressZone,
  RecoveryScenario,
  Rfi,
  Subcontractor,
  WbsNode,
} from "../types";
import { data } from "../../data";
import { rng, round, sectionValue, T } from "./util";

// ---------------------------------------------------------------- people

export const PEOPLE = {
  pm: "Elvin Məmmədov",
  planner: "Leyla Hüseynova",
  site: "Rauf Əliyev",
  qs: "Nigar Quliyeva",
  buyer: "Tural Həsənov",
  store: "Kamran İsmayılov",
  finance: "Səbinə Rzayeva",
  qa: "Orxan Babayev",
  director: "Ramil Səfərov",
  client: "Mədət Cəfərov",
  engineer: "Fuad Nəsirov",
  architect: "Aynur Kərimova",
};

// ---------------------------------------------------------------- subcontractors

export const SUBS: Subcontractor[] = [
  { id: "SC-01", code: "SC-01", name: "Abşeron Torpaq İşləri MMC", trade: T("Earthworks and excavation", "Torpaq və qazma işləri"), contact: "Vüqar Abbasov", phone: "+994 50 412 18 22", email: "office@abseron-torpaq.az", status: "ACTIVE", workers: 14, equipment: 6, packageValue: 61_400, notes: null },
  { id: "SC-02", code: "SC-02", name: "Monolit Beton Qrup", trade: T("Concrete, formwork and rebar fixing", "Beton, qəlib və armatur işləri"), contact: "Samir Hacıyev", phone: "+994 55 307 44 10", email: "info@monolit-beton.az", status: "ACTIVE", workers: 38, equipment: 4, packageValue: 228_900, notes: T("Two crews: warehouse footings and admin foundations.", "İki briqada: anbar bünövrələri və inzibati bina bünövrələri.") },
  { id: "SC-03", code: "SC-03", name: "Polad Montaj MMC", trade: T("Structural steel erection", "Metal konstruksiyaların quraşdırılması"), contact: "Elşən Qasımov", phone: "+994 70 220 91 03", email: "montaj@polad.az", status: "ACTIVE", workers: 6, equipment: 2, packageValue: 126_500, notes: T("Mobilises to site when the first trusses are delivered.", "İlk fermalar gətiriləndə meydançaya çıxır.") },
  { id: "SC-04", code: "SC-04", name: "Daş Usta MMC", trade: T("Masonry", "Hörgü işləri"), contact: "Nail Məlikov", phone: "+994 51 640 12 77", email: "dasusta@mail.az", status: "ACTIVE", workers: 0, equipment: 0, packageValue: 51_000, notes: null },
  { id: "SC-05", code: "SC-05", name: "Dam-Pro MMC", trade: T("Roofing and rainwater", "Dam örtüyü və su axıdıcılar"), contact: "Ceyhun Rəhimov", phone: "+994 50 733 05 64", email: "info@dampro.az", status: "ACTIVE", workers: 0, equipment: 0, packageValue: 32_800, notes: null },
  { id: "SC-06", code: "SC-06", name: "Enerji Montaj MMC", trade: T("Electrical, low current and CCTV", "Elektrik, zəif cərəyan və videomüşahidə"), contact: "Rəşad Novruzov", phone: "+994 55 118 62 40", email: "enerji.montaj@gmail.com", status: "ACTIVE", workers: 3, equipment: 1, packageValue: 54_900, notes: T("Temporary site power installed in October.", "Müvəqqəti elektrik təchizatı oktyabrda quraşdırılıb.") },
  { id: "SC-07", code: "SC-07", name: "Aqua-Tex Mühəndis", trade: T("Plumbing, HVAC and firefighting", "Santexnika, HVAC və yanğınsöndürmə"), contact: "Kənan Zeynalov", phone: "+994 70 455 31 19", email: "aquatex@aquatex.az", status: "ACTIVE", workers: 0, equipment: 0, packageValue: 39_700, notes: null },
  { id: "SC-08", code: "SC-08", name: "Yaşıl Şəhər Abadlıq", trade: T("Paving and landscaping", "Səki və yaşıllaşdırma"), contact: "Tofiq Əhmədov", phone: "+994 51 908 20 35", email: "yasilseher@mail.az", status: "ACTIVE", workers: 0, equipment: 0, packageValue: 247_300, notes: null },
  { id: "SC-09", code: "SC-09", name: "Final Bəzək MMC", trade: T("Finishes, plaster and tiling", "Bəzək, suvaq və üzlük işləri"), contact: "Günel Mustafayeva", phone: "+994 55 671 48 02", email: "final.bezek@mail.az", status: "SUSPENDED", workers: 0, equipment: 0, packageValue: 68_800, notes: T("Suspended until insurance certificate is renewed.", "Sığorta sertifikatı yenilənənə qədər dayandırılıb.") },
];

const OWNER_BY_SECTION: Record<string, string> = {
  sub: "SC-02",
  frame: "SC-02",
  rebar: "SC-02",
  steel: "SC-03",
  masonry: "SC-04",
  roof: "SC-05",
  openings: "SC-04",
  finish: "SC-09",
  elec: "SC-06",
  lowcur: "SC-06",
  pa: "SC-06",
  alarm: "SC-06",
  hvac: "SC-07",
  plumb: "SC-07",
  fire: "SC-07",
  ext: "SC-08",
};

// ---------------------------------------------------------------- WBS and programme

export const WBS: WbsNode[] = [
  { id: "W0", parentId: null, code: "QOBU", name: T("Qobu warehouse and administration building", "Qobu anbar və inzibati bina"), building: null },
  { id: "W1", parentId: "W0", code: "1", name: T("General and preliminaries", "Ümumi və hazırlıq işləri"), building: null },
  { id: "W2", parentId: "W0", code: "2", name: T("Warehouse", "Anbar binası"), building: "WH" },
  { id: "W21", parentId: "W2", code: "2.1", name: T("Substructure", "Yeraltı hissə"), building: "WH" },
  { id: "W22", parentId: "W2", code: "2.2", name: T("Frame and steelwork", "Karkas və metal konstruksiyalar"), building: "WH" },
  { id: "W23", parentId: "W2", code: "2.3", name: T("Envelope", "Bina qabığı"), building: "WH" },
  { id: "W24", parentId: "W2", code: "2.4", name: T("Services and finishes", "Mühəndis sistemləri və bəzək"), building: "WH" },
  { id: "W3", parentId: "W0", code: "3", name: T("Administration building", "İnzibati bina"), building: "AD" },
  { id: "W31", parentId: "W3", code: "3.1", name: T("Substructure", "Yeraltı hissə"), building: "AD" },
  { id: "W32", parentId: "W3", code: "3.2", name: T("Frame", "Karkas"), building: "AD" },
  { id: "W33", parentId: "W3", code: "3.3", name: T("Envelope", "Bina qabığı"), building: "AD" },
  { id: "W34", parentId: "W3", code: "3.4", name: T("Services and finishes", "Mühəndis sistemləri və bəzək"), building: "AD" },
  { id: "W4", parentId: "W0", code: "4", name: T("Pump station and water tanks", "Nasosxana və su anbarları"), building: "PS" },
  { id: "W5", parentId: "W0", code: "5", name: T("External works", "Abadlaşdırma"), building: "SITE" },
  { id: "W6", parentId: "W0", code: "6", name: T("Testing and handover", "Sınaq və təhvil"), building: null },
];

type Spec = {
  code: string;
  wbs: string;
  b: string;
  en: string;
  az: string;
  section: string | null;
  /** Baseline start, days from project start. */
  s: number;
  d: number;
  preds?: (string | [string, "FS" | "SS" | "FF", number])[];
  /** Days the current programme has slipped against the baseline. */
  slip?: number;
  /** Progress points behind the time-elapsed share, for work in progress. */
  behind?: number;
  fixed?: number;
  crew?: number;
  owner?: string;
  prio?: Activity["priority"];
};

const SPECS: Spec[] = [
  { code: "G-010", wbs: "W1", b: "SITE", en: "Mobilisation and site set-up", az: "Mobilizasiya və meydançanın təşkili", section: null, s: 0, d: 10, fixed: 18_000, crew: 9, owner: "SC-01" },
  { code: "G-020", wbs: "W1", b: "SITE", en: "Temporary works, fencing and site power", az: "Müvəqqəti tikililər, hasar və elektrik", section: null, s: 4, d: 14, preds: [["G-010", "SS", 4]], fixed: 9_500, crew: 6, owner: "SC-06" },

  { code: "WH-110", wbs: "W21", b: "WH", en: "Excavation and blinding", az: "Qazma işləri və hazırlıq betonu", section: null, s: 10, d: 14, preds: ["G-010"], slip: 2, fixed: 22_800, crew: 12, owner: "SC-01" },
  { code: "WH-120", wbs: "W21", b: "WH", en: "Pad footings Ms-1 to Ms-4", az: "Dirək altı bünövrələr Ms-1 – Ms-4", section: "sub", s: 20, d: 24, preds: [["WH-110", "SS", 8]], slip: 4, behind: 3, crew: 16, prio: "HIGH" },
  { code: "WH-125", wbs: "W21", b: "WH", en: "Reinforcement to footings and columns", az: "Bünövrə və dirək armaturu", section: "rebar", s: 18, d: 34, preds: [["WH-110", "SS", 6]], slip: 4, behind: 6, crew: 10, prio: "HIGH" },
  { code: "WH-130", wbs: "W21", b: "WH", en: "Ground beams MR-1 to MR-3", az: "Rand tirləri MR-1 – MR-3", section: "sub", s: 40, d: 18, preds: ["WH-120"], slip: 4, crew: 12 },
  { code: "WH-140", wbs: "W22", b: "WH", en: "RC columns 400 × 500 mm", az: "Dəmir-beton dirəklər 400 × 500 mm", section: "frame", s: 46, d: 21, preds: [["WH-120", "FS", 2], ["WH-125", "FF", 0]], slip: 4, crew: 14, prio: "HIGH" },
  { code: "WH-150", wbs: "W22", b: "WH", en: "Steel truss fabrication (off-site)", az: "Metal fermaların hazırlanması (zavodda)", section: "steel", s: 28, d: 42, slip: 12, behind: 9, crew: 8, owner: "SC-03", prio: "CRITICAL" },
  { code: "WH-160", wbs: "W22", b: "WH", en: "Steel erection and bracing", az: "Metal konstruksiyaların quraşdırılması və bərkidilməsi", section: "steel", s: 70, d: 35, preds: ["WH-150", ["WH-140", "FS", 0]], slip: 12, crew: 6, prio: "CRITICAL" },
  { code: "WH-170", wbs: "W23", b: "WH", en: "Roof sheeting and rainwater goods", az: "Dam örtüyü və su axıdıcılar", section: "roof", s: 91, d: 28, preds: [["WH-160", "SS", 21]], slip: 12, crew: 8, prio: "CRITICAL" },
  { code: "WH-180", wbs: "W23", b: "WH", en: "Limestone external walls 400 mm", az: "Xarici əhəng daşı divarlar 400 mm", section: "masonry", s: 96, d: 42, preds: [["WH-140", "FS", 10]], slip: 4, crew: 12 },
  { code: "WH-190", wbs: "W24", b: "WH", en: "Ground slab B15 and joints", az: "Döşəmə plitəsi B15 və tikişlər", section: "frame", s: 105, d: 21, preds: [["WH-170", "SS", 14], "WH-130"], slip: 12, crew: 14 },
  { code: "WH-200", wbs: "W23", b: "WH", en: "Roller shutters and doors", az: "Jalüz və digər qapılar", section: "openings", s: 145, d: 14, preds: ["WH-180"], slip: 4, crew: 4 },
  { code: "WH-210", wbs: "W24", b: "WH", en: "Electrical installation", az: "Elektrik quraşdırma işləri", section: "elec", s: 119, d: 60, preds: [["WH-170", "FS", 0]], slip: 12, crew: 5 },
  { code: "WH-220", wbs: "W24", b: "WH", en: "Firefighting and fire alarm", az: "Yanğınsöndürmə və yanğın siqnalizasiyası", section: "fire", s: 126, d: 60, preds: [["WH-170", "FS", 7]], slip: 12, crew: 4 },
  { code: "WH-230", wbs: "W24", b: "WH", en: "Polished concrete floor", az: "Cilalanmış beton döşəmə", section: "finish", s: 126, d: 20, preds: ["WH-190"], slip: 12, crew: 6 },
  { code: "WH-250", wbs: "W24", b: "WH", en: "Racking, dock levellers and warehouse fit-out", az: "Rəflər, rampa platformaları və anbarın daxili təchizatı", section: null, s: 146, d: 134, preds: ["WH-230", ["WH-210", "SS", 10]], slip: 12, fixed: 48_000, crew: 8, owner: "SC-03", prio: "HIGH" },
  { code: "WH-240", wbs: "W24", b: "WH", en: "Facade render and paint", az: "Fasad suvağı və boyası", section: "finish", s: 186, d: 30, preds: ["WH-180"], slip: 4, crew: 8 },

  { code: "AD-110", wbs: "W31", b: "AD", en: "Excavation", az: "Qazma işləri", section: null, s: 14, d: 10, preds: ["G-010"], fixed: 6_400, crew: 6, owner: "SC-01" },
  { code: "AD-120", wbs: "W31", b: "AD", en: "Strip foundations", az: "Lent bünövrələr", section: "sub", s: 24, d: 20, preds: ["AD-110"], slip: 3, behind: 2, crew: 10 },
  { code: "AD-125", wbs: "W31", b: "AD", en: "Reinforcement to foundations and frame", az: "Bünövrə və karkas armaturu", section: "rebar", s: 26, d: 60, preds: [["AD-110", "FS", 2]], slip: 3, behind: 4, crew: 8 },
  { code: "AD-130", wbs: "W32", b: "AD", en: "Ground floor columns and beams", az: "Birinci mərtəbə dirək və tirləri", section: "frame", s: 46, d: 21, preds: ["AD-120"], slip: 3, crew: 10 },
  { code: "AD-140", wbs: "W32", b: "AD", en: "First floor slab", az: "Birinci mərtəbə örtüyü", section: "frame", s: 67, d: 18, preds: ["AD-130"], slip: 3, crew: 12 },
  { code: "AD-150", wbs: "W32", b: "AD", en: "First floor columns and roof slab", az: "İkinci mərtəbə dirəkləri və dam plitəsi", section: "frame", s: 85, d: 21, preds: ["AD-140", ["AD-125", "FF", 0]], slip: 3, crew: 12 },
  { code: "AD-160", wbs: "W33", b: "AD", en: "Timber roof and sheeting", az: "Taxta çatı və örtük", section: "roof", s: 106, d: 21, preds: ["AD-150"], slip: 3, crew: 6 },
  { code: "AD-170", wbs: "W33", b: "AD", en: "Masonry walls and partitions", az: "Divar və arakəsmə hörgüsü", section: "masonry", s: 100, d: 35, preds: [["AD-150", "SS", 14]], slip: 3, crew: 10 },
  { code: "AD-180", wbs: "W33", b: "AD", en: "PVC windows and doors", az: "PVC pəncərə və qapılar", section: "openings", s: 136, d: 18, preds: ["AD-170"], slip: 3, crew: 4 },
  { code: "AD-190", wbs: "W34", b: "AD", en: "Services first fix", az: "Mühəndis sistemləri – ilkin montaj", section: "hvac", s: 130, d: 35, preds: [["AD-170", "SS", 21]], slip: 3, crew: 8 },
  { code: "AD-200", wbs: "W34", b: "AD", en: "Plaster and suspended ceilings", az: "Suvaq və asma tavanlar", section: "finish", s: 166, d: 30, preds: ["AD-190"], slip: 3, crew: 10 },
  { code: "AD-210", wbs: "W34", b: "AD", en: "Floor and wall tiling", az: "Döşəmə və divar üzlüyü", section: "finish", s: 192, d: 28, preds: [["AD-200", "SS", 14]], slip: 3, crew: 8 },
  { code: "AD-220", wbs: "W34", b: "AD", en: "Services second fix", az: "Mühəndis sistemləri – son montaj", section: "elec", s: 200, d: 30, preds: [["AD-200", "FS", 0]], slip: 3, crew: 6 },
  { code: "AD-230", wbs: "W34", b: "AD", en: "Low current, CCTV and public address", az: "Zəif cərəyan, videomüşahidə və səsləndirmə", section: "lowcur", s: 215, d: 25, preds: [["AD-220", "SS", 10]], slip: 3, crew: 4 },
  { code: "AD-240", wbs: "W34", b: "AD", en: "Painting and final finishes", az: "Rəngləmə və son bəzək", section: "finish", s: 228, d: 25, preds: ["AD-210"], slip: 3, crew: 8 },

  { code: "PS-110", wbs: "W4", b: "PS", en: "Pump station excavation and RC chamber", az: "Nasosxananın qazılması və dəmir-beton kamerası", section: null, s: 60, d: 30, preds: ["G-020"], fixed: 24_600, crew: 8, owner: "SC-02" },
  { code: "PS-120", wbs: "W4", b: "PS", en: "Pumps and pipework", az: "Nasoslar və boru kəmərləri", section: "plumb", s: 120, d: 30, preds: ["PS-110"], crew: 4 },
  { code: "PS-130", wbs: "W4", b: "PS", en: "Pump station electrics and controls", az: "Nasosxananın elektrik və idarəetməsi", section: "elec", s: 150, d: 20, preds: [["PS-120", "SS", 10]], crew: 3 },
  { code: "TK-110", wbs: "W4", b: "TK", en: "Tank excavation and base slabs", az: "Çənlərin qazılması və bünövrə plitələri", section: null, s: 70, d: 21, preds: ["G-020"], fixed: 19_800, crew: 8, owner: "SC-02" },
  { code: "TK-120", wbs: "W4", b: "TK", en: "Tank walls and roof slabs", az: "Çən divarları və örtük plitələri", section: null, s: 91, d: 30, preds: ["TK-110"], fixed: 32_600, crew: 10, owner: "SC-02" },
  { code: "TK-130", wbs: "W4", b: "TK", en: "Pipework and leak testing", az: "Boru kəmərləri və sızma sınağı", section: "plumb", s: 140, d: 20, preds: ["TK-120"], crew: 4 },

  { code: "SW-110", wbs: "W5", b: "SITE", en: "Underground utilities", az: "Yeraltı kommunikasiyalar", section: "ext", s: 160, d: 40, preds: ["G-020"], crew: 10 },
  { code: "SW-120", wbs: "W5", b: "SITE", en: "Sub-base and kerbs", az: "Əsas qatı və bordyurlar", section: "ext", s: 200, d: 30, preds: ["SW-110"], crew: 12 },
  { code: "SW-130", wbs: "W5", b: "SITE", en: "Asphalt roads and yard", az: "Asfalt yollar və həyət", section: "ext", s: 230, d: 25, preds: ["SW-120"], crew: 10 },
  { code: "SW-140", wbs: "W5", b: "SITE", en: "Paving and landscaping", az: "Səki daşı və yaşıllaşdırma", section: "ext", s: 250, d: 40, preds: [["SW-130", "SS", 10]], crew: 12 },

  { code: "G-900", wbs: "W6", b: "SITE", en: "Testing and commissioning", az: "Sınaq və istismara vermə", section: null, s: 282, d: 28, preds: [["WH-250", "FS", 2], "WH-220", "AD-240", "PS-130", "TK-130"], slip: 12, fixed: 15_000, crew: 6, owner: "SC-07" },
  { code: "G-910", wbs: "W6", b: "SITE", en: "Snagging and handover", az: "Qüsurların aradan qaldırılması və təhvil", section: null, s: 310, d: 16, preds: ["G-900", "SW-140"], slip: 12, fixed: 6_000, crew: 8, owner: "SC-09" },
];

function buildProgramme() {
  // Budget: split each building × section value evenly across the activities that carry it.
  const sharers = new Map<string, number>();
  for (const s of SPECS) if (s.section) sharers.set(`${s.b}/${s.section}`, (sharers.get(`${s.b}/${s.section}`) ?? 0) + 1);
  // The admin "services" activities carry all admin services sections between them.
  const adServices = ["hvac", "plumb", "alarm", "pa"].reduce((a, k) => a + (sectionValue.get(`AD/${k}`) ?? 0), 0);
  const whFire = (sectionValue.get("WH/fire") ?? 0) + (sectionValue.get("WH/alarm") ?? 0) + (sectionValue.get("WH/hvac") ?? 0);
  const whElec = (sectionValue.get("WH/elec") ?? 0) + (sectionValue.get("WH/lowcur") ?? 0);

  const activities: Activity[] = SPECS.map((s, i) => {
    const bStart = addDays(PROJECT_START, s.s);
    const bEnd = addDays(PROJECT_START, s.s + s.d);
    const slip = s.slip ?? 0;
    const start = addDays(bStart, slip > 0 && s.s > 30 ? slip : Math.min(slip, 2));
    const end = addDays(bEnd, slip);
    let budget = s.fixed ?? 0;
    if (s.section) {
      const key = `${s.b}/${s.section}`;
      let v = sectionValue.get(key) ?? 0;
      if (s.b === "AD" && s.section === "hvac") v = adServices;
      if (s.b === "WH" && s.section === "fire") v = whFire;
      if (s.b === "WH" && s.section === "elec") v = whElec;
      budget = v / (sharers.get(key) ?? 1);
    }
    let status: Activity["status"] = "NOT_STARTED";
    let pct = 0;
    let aStart: string | null = null;
    let aEnd: string | null = null;
    if (end <= TODAY) {
      status = "COMPLETED";
      pct = 100;
      aStart = start;
      aEnd = end;
    } else if (start <= TODAY) {
      status = "IN_PROGRESS";
      aStart = start;
      const share = diffDays(start, TODAY) / Math.max(1, diffDays(start, end));
      pct = Math.max(5, Math.round(share * 100 - (s.behind ?? 0)));
    }
    const a: Activity = {
      id: `A${String(i + 1).padStart(3, "0")}`,
      code: s.code,
      wbsId: s.wbs,
      name: T(s.en, s.az),
      building: s.b,
      section: s.section,
      start,
      end,
      bStart,
      bEnd,
      aStart,
      aEnd,
      pct,
      status,
      priority: s.prio ?? "MEDIUM",
      isMilestone: false,
      owner: s.owner ?? (s.section ? (OWNER_BY_SECTION[s.section] ?? "SC-02") : "SC-02"),
      budget: Math.round(budget),
      crew: s.crew ?? 6,
      blockedReason: null,
    };
    if (s.code === "WH-150") {
      a.status = "BLOCKED";
      a.blockedReason = T("Waiting on RFI-0004: truss-to-column connection detail is missing on KS-21.", "RFI-0004 gözlənilir: KS-21-də ferma–dirək birləşmə detalı yoxdur.");
    }
    return a;
  });

  const byCode = new Map(activities.map((a) => [a.code, a]));
  const links: Dependency[] = [];
  for (const s of SPECS)
    for (const p of s.preds ?? []) {
      const [code, type, lag] = typeof p === "string" ? [p, "FS" as const, 0] : p;
      const from = byCode.get(code);
      const to = byCode.get(s.code);
      if (from && to) links.push({ id: `L${links.length + 1}`, from: from.id, to: to.id, type, lag });
    }
  return { activities, links, byCode };
}

export function seedPm() {
  const { activities, links, byCode } = buildProgramme();
  const id = (code: string) => byCode.get(code)!.id;
  const endOf = (code: string) => byCode.get(code)!.end;
  const bEndOf = (code: string) => byCode.get(code)!.bEnd;

  const ms = (code: string, en: string, az: string, drivers: string[], payment: number | null, target?: string): Milestone => {
    const baseline = drivers.map(bEndOf).reduce((a, b) => maxDate(a, b));
    const forecast = drivers.map(endOf).reduce((a, b) => maxDate(a, b));
    const done = forecast <= TODAY;
    return { id: code, code, name: T(en, az), baseline, target: target ?? baseline, forecast, actual: done ? forecast : null, payment, drivers: drivers.map(id) };
  };

  const milestones: Milestone[] = [
    ms("M01", "Site mobilised", "Meydança hazırdır", ["G-010"], 35_000),
    ms("M02", "Warehouse foundations complete", "Anbarın bünövrələri tamamlandı", ["WH-120", "WH-130"], null),
    ms("M03", "Warehouse steel frame erected", "Anbarın metal karkası quraşdırıldı", ["WH-160"], 90_000),
    ms("M04", "Warehouse weathertight", "Anbar bağlı konturda", ["WH-170", "WH-180"], 70_000),
    ms("M05", "Admin building frame complete", "İnzibati binanın karkası tamamlandı", ["AD-150"], 60_000),
    ms("M06", "Admin building weathertight", "İnzibati bina bağlı konturda", ["AD-160", "AD-180"], null),
    ms("M07", "Pump station and tanks complete", "Nasosxana və çənlər tamamlandı", ["PS-130", "TK-130"], 40_000),
    ms("M08", "Services first fix complete", "Mühəndis sistemlərinin ilkin montajı bitdi", ["AD-190", "WH-210"], null),
    ms("M09", "External works complete", "Abadlaşdırma tamamlandı", ["SW-140"], 80_000),
    ms("M10", "Testing and commissioning complete", "Sınaq və istismara vermə bitdi", ["G-900"], null),
    ms("M11", "Practical completion and handover", "Təhvil-təslim", ["G-910"], 120_000, PROJECT_FINISH),
  ];

  const delays: DelayEvent[] = [
    { id: "DL-0001", ref: "DL-0001", title: T("Heavy rain stopped excavation for two days", "Güclü yağış qazma işlərini iki gün dayandırdı"), cause: "WEATHER", activityId: id("WH-110"), startedAt: "2026-10-20", daysLost: 2, floatAbsorbed: 2, status: "RESOLVED", severity: "LOW", party: "Neutral", notes: T("Recorded 31 mm on site. Pumps hired to dewater the pits.", "Meydançada 31 mm qeydə alınıb. Çuxurların suyunu çəkmək üçün nasos icarəyə götürülüb."), milestoneIds: [], criticalPathChanged: false, links: [{ kind: "REPORT", id: "DR-2026-10-20" }] },
    { id: "DL-0002", ref: "DL-0002", title: T("Rebar delivery arrived 6 t short", "Armatur 6 t əskik gətirildi"), cause: "MATERIAL_DELIVERY", activityId: id("WH-125"), startedAt: "2026-11-03", daysLost: 4, floatAbsorbed: 1, status: "CONFIRMED", severity: "HIGH", party: "Qafqaz Armatur MMC", notes: T("Vendor confirmed the balance for 19 November.", "Təchizatçı qalan hissəni 19 noyabra təsdiqləyib."), milestoneIds: ["M02"], criticalPathChanged: false, links: [{ kind: "PO", id: "PO-0002" }] },
    { id: "DL-0003", ref: "DL-0003", title: T("Truss connection detail missing (RFI-0004)", "Ferma birləşmə detalı yoxdur (RFI-0004)"), cause: "RFI", activityId: id("WH-150"), startedAt: "2026-11-06", daysLost: 12, floatAbsorbed: 0, status: "OPEN", severity: "CRITICAL", party: "Storm Building MMC", notes: T("Fabrication of the first nine trusses cannot start until the designer issues the detail.", "Layihəçi detalı verənə qədər ilk doqquz fermanın hazırlanmasına başlamaq olmur."), milestoneIds: ["M03", "M04", "M11"], criticalPathChanged: true, links: [{ kind: "RFI", id: "RFI-0004" }, { kind: "CHANGE", id: "VO-0002" }] },
    { id: "DL-0004", ref: "DL-0004", title: T("Steel fixers short on the admin foundations", "İnzibati bina bünövrəsində armaturçu çatışmır"), cause: "MANPOWER", activityId: id("AD-125"), startedAt: "2026-11-10", daysLost: 2, floatAbsorbed: 2, status: "MITIGATED", severity: "MEDIUM", party: "Monolit Beton Qrup", notes: T("Four fixers moved from the warehouse crew from 12 November.", "12 noyabrdan anbar briqadasından dörd armaturçu keçirilib."), milestoneIds: [], criticalPathChanged: false, links: [] },
    { id: "DL-0005", ref: "DL-0005", title: T("Excavator hydraulic failure", "Ekskavatorun hidravlika nasazlığı"), cause: "EQUIPMENT", activityId: id("AD-120"), startedAt: "2026-11-12", daysLost: 1, floatAbsorbed: 0, status: "RESOLVED", severity: "MEDIUM", party: "Abşeron Torpaq İşləri MMC", notes: null, milestoneIds: ["M05"], criticalPathChanged: false, links: [] },
    { id: "DL-0006", ref: "DL-0006", title: T("Utility connection permit still pending", "Kommunikasiya qoşulma icazəsi hələ verilməyib"), cause: "AUTHORITY", activityId: id("SW-110"), startedAt: "2026-11-14", daysLost: 6, floatAbsorbed: 6, status: "UNDER_REVIEW", severity: "MEDIUM", party: "Azersu / Azerishiq", notes: T("Application filed 2 November. Float covers it if issued before March.", "Müraciət 2 noyabrda verilib. Mart ayından əvvəl verilsə, ehtiyat vaxt bunu örtür."), milestoneIds: [], criticalPathChanged: false, links: [] },
  ];

  const impacts: LiveImpact[] = [
    { id: "LI-01", kind: "WEATHER_IMPACT", activityId: id("WH-120"), startedAt: "2026-11-19", text: T("Forecast: 25–35 mm rain on 19–20 November", "Proqnoz: 19–20 noyabrda 25–35 mm yağış"), status: "REPORTED", daysImpact: 2, crewPlanned: null, crewOnSite: null, hoursLost: 16 },
    { id: "LI-02", kind: "MANPOWER_SHORTAGE", activityId: id("AD-125"), startedAt: "2026-11-10", text: T("8 steel fixers on site against 12 planned", "Plan üzrə 12 əvəzinə meydançada 8 armaturçu"), status: "MITIGATED", daysImpact: 2, crewPlanned: 12, crewOnSite: 8, hoursLost: null },
    { id: "LI-03", kind: "EQUIPMENT_FAILURE", activityId: id("WH-160"), startedAt: "2026-11-16", text: T("Mobile crane 50 t failed its annual inspection", "50 t avtokran illik yoxlamadan keçmədi"), status: "UNDER_REVIEW", daysImpact: 3, crewPlanned: null, crewOnSite: null, hoursLost: null },
  ];

  const recovery: RecoveryScenario[] = [
    { id: "RS-1", name: T("Second fabrication shift at the steel yard", "Metal sexində ikinci növbə"), status: "CALCULATED", daysRecovered: 8, cost: 14_500, risk: "medium", summary: T("Run a night shift at Xəzər Polad for five weeks once the connection detail is issued.", "Birləşmə detalı veriləndən sonra Xəzər Poladda beş həftə gecə növbəsi."), assumptions: [T("RFI-0004 answered by 21 November", "RFI-0004 21 noyabra qədər cavablanır"), T("Galvanising capacity is available", "Sinkləmə gücü mövcuddur")], actions: [{ title: T("Agree night-shift rate with the fabricator", "İstehsalçı ilə gecə növbəsi qiymətini razılaşdırmaq"), owner: PEOPLE.buyer, due: "2026-11-20", days: 0 }, { title: T("Start the second shift", "İkinci növbəni başlatmaq"), owner: "Polad Montaj MMC", due: "2026-11-24", days: 8 }] },
    { id: "RS-2", name: T("Sheet the roof bay by bay as trusses land", "Fermalar quraşdırıldıqca damı aşırım-aşırım örtmək"), status: "DRAFT", daysRecovered: 6, cost: 2_000, risk: "low", summary: T("Start WH-170 after three bays instead of after half the frame.", "WH-170-i karkasın yarısından sonra yox, üç aşırımdan sonra başlamaq."), assumptions: [T("Bracing in the first three bays is complete", "İlk üç aşırımda bərkidici elementlər tamamlanıb")], actions: [{ title: T("Re-sequence WH-170 to start-to-start + 7 days", "WH-170-i başlanğıc–başlanğıc + 7 günə keçirmək"), owner: PEOPLE.planner, due: "2026-11-19", days: 6 }] },
    { id: "RS-3", name: T("Split the steel package with a second supplier", "Metal paketini ikinci təchizatçı ilə bölmək"), status: "DRAFT", daysRecovered: 10, cost: 21_800, risk: "high", summary: T("Move 40% of the trusses to Sumqayıt Metal Servis.", "Fermaların 40%-ni Sumqayıt Metal Servisə vermək."), assumptions: [T("Second supplier holds the same steel grade", "İkinci təchizatçıda eyni polad markası var"), T("Inspection of two shops is possible", "İki sexin yoxlanılması mümkündür")], actions: [{ title: T("Issue an RFQ for 9 trusses", "9 ferma üçün RFQ göndərmək"), owner: PEOPLE.buyer, due: "2026-11-21", days: 0 }, { title: T("Weld procedure approval", "Qaynaq prosedurunun təsdiqi"), owner: PEOPLE.qa, due: "2026-11-28", days: 10 }] },
  ];

  // Daily reports: every working day (Mon–Sat) from 19 October to today.
  const r = rng(11);
  const reports: DailyReport[] = [];
  const zoneOf = (a: Activity) => (a.building === "WH" ? T("Warehouse grid 1–9", "Anbar, 1–9 oxları") : a.building === "AD" ? T("Admin building", "İnzibati bina") : T("Site", "Meydança"));
  for (let day = "2026-10-19"; day <= TODAY; day = addDays(day, 1)) {
    const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (dow === 0 || day === "2026-11-09") continue;
    const live = activities.filter((a) => a.start <= day && a.end >= day && !a.isMilestone).slice(0, 5);
    const weather: DailyReport["weather"] = day === "2026-10-20" || day === "2026-10-21" ? "RAIN" : r() < 0.2 ? "WIND" : r() < 0.5 ? "CLOUDY" : "SUNNY";
    const temp = Math.round(19 - diffDays("2026-10-19", day) * 0.22 + r() * 3);
    const entries = live.map((a) => {
      const pct = Math.min(100, Math.max(1, Math.round((diffDays(a.start, day) / Math.max(1, diffDays(a.start, a.end))) * 100)));
      const unit = a.section === "rebar" ? "kg" : a.section === "sub" || a.section === "frame" ? "m³" : "m²";
      const qty = unit === "kg" ? Math.round(600 + r() * 900) : Math.round(6 + r() * 30);
      return { activityId: a.id, zone: zoneOf(a).en, text: T(`${a.name.en}: ${pct}% reached`, `${a.name.az}: ${pct}% icra olunub`), qty, unit, pct, over: r() < 0.12 };
    });
    const labourBase = 28 + live.length * 7;
    reports.push({
      id: `DR-${day}`,
      date: day,
      status: day === TODAY ? "DRAFT" : day === addDays(TODAY, -1) ? "SUBMITTED" : "APPROVED",
      author: PEOPLE.site,
      weather,
      tempC: temp,
      conditions: weather === "RAIN" ? T("Pits flooded in the morning, pumps running", "Səhər çuxurları su basıb, nasoslar işləyir") : T("Ground firm, access road clear", "Torpaq bərkdir, giriş yolu açıqdır"),
      entries,
      labour: [
        { trade: T("Concrete and formwork", "Beton və qəlib"), count: Math.round(labourBase * 0.4) },
        { trade: T("Steel fixers", "Armaturçular"), count: Math.round(labourBase * 0.25) },
        { trade: T("Plant operators", "Texnika operatorları"), count: 5 },
        { trade: T("Labourers", "Fəhlələr"), count: Math.round(labourBase * 0.3) },
      ],
      plant: [
        { name: T("Excavator 21 t", "Ekskavator 21 t"), status: day === "2026-11-12" ? "BROKEN_DOWN" : "WORKING", hours: day === "2026-11-12" ? 2 : 8 },
        { name: T("Concrete pump 36 m", "Beton nasosu 36 m"), status: r() < 0.4 ? "WORKING" : "STANDBY", hours: Math.round(r() * 7) },
        { name: T("Mobile crane 50 t", "Avtokran 50 t"), status: day >= "2026-11-16" ? "BROKEN_DOWN" : "IDLE", hours: 0 },
      ],
      materials: [{ key: "conc_fdn", qty: Math.round(8 + r() * 18), unit: "m³" }, { key: "rebar_a500", qty: Math.round(500 + r() * 900), unit: "kg" }],
      blockers:
        day >= "2026-11-06"
          ? [{ text: T("Truss connection detail missing (RFI-0004)", "Ferma birləşmə detalı yoxdur (RFI-0004)"), severity: "CRITICAL", owner: PEOPLE.engineer, due: "2026-11-21", status: "OPEN" }]
          : [],
      photos: [["KS-7", "KS-12", "AR-10", "BP-7"][Math.floor(r() * 4)]!, ["KS-5", "KS-21", "AR-11"][Math.floor(r() * 3)]!],
      notes: day === "2026-11-03" ? T("Rebar delivery short by 6 t. Footings Ms-3 and Ms-4 re-sequenced.", "Armatur 6 t əskik gəlib. Ms-3 və Ms-4 bünövrələrinin ardıcıllığı dəyişdirilib.") : null,
    });
  }

  const zone = (code: string, en: string, az: string, building: string, level: number, category: ProgressZone["category"], act: string, photo: string): ProgressZone => {
    const a = byCode.get(act)!;
    const plannedShare = Math.min(1, Math.max(0, diffDays(a.bStart, TODAY) / Math.max(1, diffDays(a.bStart, a.bEnd))));
    const expected = Math.round(plannedShare * 100);
    return {
      id: code,
      code,
      name: T(en, az),
      building,
      level,
      category,
      activityId: a.id,
      expectedPct: expected,
      actualPct: a.pct,
      captures: [
        { date: addDays(TODAY, -14), pct: Math.max(0, a.pct - 22), confidence: 0.81, source: "DRONE", photo, note: T("Formwork and rebar visible on most bases", "Əksər bünövrələrdə qəlib və armatur görünür") },
        { date: addDays(TODAY, -7), pct: Math.max(0, a.pct - 10), confidence: 0.86, source: "PHONE", photo, note: T("Concrete poured on the first row", "Birinci cərgədə beton tökülüb") },
        { date: TODAY, pct: a.pct, confidence: 0.9, source: "DRONE", photo, note: T("Progress matches the daily report", "İrəliləyiş gündəlik hesabata uyğundur") },
      ],
    };
  };
  const zones: ProgressZone[] = [
    zone("WH-Z1", "Warehouse excavation", "Anbar qazma işləri", "WH", 0, "EXCAVATION", "WH-110", "KS-5"),
    zone("WH-Z2", "Warehouse pad footings", "Anbar bünövrələri", "WH", 0, "CONCRETE", "WH-120", "KS-7"),
    zone("WH-Z3", "Warehouse reinforcement", "Anbar armaturu", "WH", 0, "STEEL", "WH-125", "KS-12"),
    zone("WH-Z4", "Warehouse columns", "Anbar dirəkləri", "WH", 1, "CONCRETE", "WH-140", "KS-12"),
    zone("WH-Z5", "Warehouse steel frame", "Anbar metal karkası", "WH", 2, "STEEL", "WH-150", "KS-21"),
    zone("AD-Z1", "Admin excavation", "İnzibati bina qazma", "AD", 0, "EXCAVATION", "AD-110", "AR-10"),
    zone("AD-Z2", "Admin foundations", "İnzibati bina bünövrəsi", "AD", 0, "CONCRETE", "AD-120", "AR-10"),
    zone("AD-Z3", "Admin reinforcement", "İnzibati bina armaturu", "AD", 1, "STEEL", "AD-125", "AR-11"),
    zone("AD-Z4", "Admin first floor", "İnzibati bina ikinci mərtəbə", "AD", 2, "CONCRETE", "AD-140", "AR-11"),
    zone("SITE-Z1", "Site set-up and fencing", "Meydança və hasar", "SITE", 0, "GENERAL", "G-020", "BP-7"),
  ];

  const parties: Party[] = [
    { id: "PT-1", role: "OWNER", name: data.project.client, people: [{ name: PEOPLE.client, title: T("Client representative", "Sifarişçi nümayəndəsi"), access: "PROJECT_VIEWER" }] },
    { id: "PT-2", role: "CONSULTANT", name: data.project.designer, people: [{ name: PEOPLE.engineer, title: T("Structural engineer", "Konstruktor mühəndis"), access: "PROJECT_MEMBER" }, { name: PEOPLE.architect, title: T("Architect", "Memar"), access: "PROJECT_MEMBER" }] },
    {
      id: "PT-3",
      role: "CONTRACTOR",
      name: "Qobu Tikinti MMC",
      people: [
        { name: PEOPLE.director, title: T("Project director", "Layihə direktoru"), access: "PROJECT_ADMIN" },
        { name: PEOPLE.pm, title: T("Project manager", "Layihə meneceri"), access: "PROJECT_ADMIN" },
        { name: PEOPLE.planner, title: T("Planner", "Planlaşdırıcı"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.site, title: T("Site engineer", "Sahə mühəndisi"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.qs, title: T("Quantity surveyor", "Smeta mühəndisi"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.buyer, title: T("Procurement officer", "Satınalma mütəxəssisi"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.store, title: T("Storekeeper", "Anbardar"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.finance, title: T("Finance", "Maliyyə"), access: "PROJECT_MEMBER" },
        { name: PEOPLE.qa, title: T("QA/QC engineer", "Keyfiyyət mühəndisi"), access: "PROJECT_MEMBER" },
      ],
    },
    ...SUBS.map((s, i) => ({ id: `PT-S${i + 1}`, role: "SUBCONTRACTOR" as const, name: s.name, people: [{ name: s.contact, title: T("Package manager", "Paket meneceri"), access: "PROJECT_VIEWER" as const }] })),
  ];

  const rfis: Rfi[] = [
    { id: "RFI-0001", ref: "RFI-0001", subject: T("Founding level of footing Ms-3", "Ms-3 bünövrəsinin oturma səviyyəsi"), question: T("KS-7 shows −2.10 but the section on KS-9 shows −2.25. Which level governs?", "KS-7-də −2.10, KS-9-dakı kəsikdə isə −2.25 göstərilib. Hansı səviyyə əsasdır?"), discipline: "struct", sheetId: "KS-7", activityId: id("WH-120"), raisedBy: PEOPLE.site, raisedAt: "2026-10-16", dueAt: "2026-10-21", status: "CLOSED", priority: "HIGH", answer: T("Use −2.25 throughout. KS-7 will be revised.", "Hər yerdə −2.25 götürülsün. KS-7 düzəldiləcək."), answeredBy: PEOPLE.engineer, answeredAt: "2026-10-19", costImpact: false, timeImpact: false },
    { id: "RFI-0002", ref: "RFI-0002", subject: T("Ground slab joint layout", "Döşəmə plitəsinin tikiş sxemi"), question: T("No saw-cut joint layout is given for the 1,109 m² slab. Please confirm the spacing.", "1 109 m² plitə üçün kəsik tikiş sxemi verilməyib. Addımı təsdiqləyin."), discipline: "struct", sheetId: "KS-12", activityId: id("WH-190"), raisedBy: PEOPLE.site, raisedAt: "2026-10-24", dueAt: "2026-11-05", status: "ANSWERED", priority: "MEDIUM", answer: T("6 × 6 m grid aligned with the column lines.", "Dirək oxlarına uyğun 6 × 6 m tor."), answeredBy: PEOPLE.engineer, answeredAt: "2026-11-02", costImpact: false, timeImpact: false },
    { id: "RFI-0003", ref: "RFI-0003", subject: T("Lap length for Ø16 column bars", "Ø16 dirək armaturunun bindirmə uzunluğu"), question: T("Please confirm the lap length for A500C Ø16 in B25.", "B25 betonda A500C Ø16 üçün bindirmə uzunluğunu təsdiqləyin."), discipline: "struct", sheetId: "KS-12", activityId: id("WH-125"), raisedBy: PEOPLE.qa, raisedAt: "2026-10-28", dueAt: "2026-11-02", status: "CLOSED", priority: "MEDIUM", answer: T("50 diameters, 800 mm, staggered.", "50 diametr, 800 mm, pilləli."), answeredBy: PEOPLE.engineer, answeredAt: "2026-10-30", costImpact: false, timeImpact: false },
    { id: "RFI-0004", ref: "RFI-0004", subject: T("Truss-to-column connection detail missing", "Ferma–dirək birləşmə detalı yoxdur"), question: T("KS-21 gives the truss members but no connection to the RC column heads. Plate size, bolts and embedded parts are needed before fabrication.", "KS-21-də ferma elementləri var, amma dəmir-beton dirək başlığına birləşmə yoxdur. Hazırlıqdan əvvəl lövhə ölçüsü, boltlar və gömülü hissələr lazımdır."), discipline: "struct", sheetId: "KS-21", activityId: id("WH-150"), raisedBy: PEOPLE.pm, raisedAt: "2026-11-06", dueAt: "2026-11-13", status: "OPEN", priority: "URGENT", answer: null, answeredBy: null, answeredAt: null, costImpact: true, timeImpact: true },
    { id: "RFI-0005", ref: "RFI-0005", subject: T("Window sizes on AR-19 do not match the schedule", "AR-19-dakı pəncərə ölçüləri cədvələ uyğun deyil"), question: T("Window OK-2 is 1500 × 1500 on the elevation but 1200 × 1500 in the schedule.", "OK-2 pəncərəsi fasadda 1500 × 1500, cədvəldə isə 1200 × 1500-dür."), discipline: "arch", sheetId: "AR-19", activityId: id("AD-180"), raisedBy: PEOPLE.qs, raisedAt: "2026-11-12", dueAt: "2026-11-20", status: "OPEN", priority: "MEDIUM", answer: null, answeredBy: null, answeredAt: null, costImpact: true, timeImpact: false },
    { id: "RFI-0006", ref: "RFI-0006", subject: T("Fire pump duty point", "Yanğın nasosunun iş nöqtəsi"), question: T("Flow and head for the fire pump set are not stated. Needed to close the pump RFQ.", "Yanğın nasos qurğusunun sərfi və basqısı göstərilməyib. Nasos RFQ-nu bağlamaq üçün lazımdır."), discipline: "fire", sheetId: "MEP-24", activityId: id("PS-120"), raisedBy: PEOPLE.buyer, raisedAt: "2026-11-14", dueAt: "2026-11-24", status: "OPEN", priority: "HIGH", answer: null, answeredBy: null, answeredAt: null, costImpact: false, timeImpact: true },
    { id: "RFI-0007", ref: "RFI-0007", subject: T("Bracing Özr-2 schedule total", "Özr-2 bərkidici cədvəlinin yekunu"), question: T("The KS-21 schedule prints 808.80 kg for Özr-2; the rows add up differently. Which is correct?", "KS-21 cədvəlində Özr-2 üçün 808.80 kq yazılıb, sətirlərin cəmi fərqlidir. Hansı düzgündür?"), discipline: "struct", sheetId: "KS-21", activityId: id("WH-150"), raisedBy: PEOPLE.qs, raisedAt: "2026-11-04", dueAt: "2026-11-11", status: "ANSWERED", priority: "MEDIUM", answer: T("Row totals govern. The printed total will be corrected.", "Sətirlərin cəmi əsasdır. Çap olunmuş yekun düzəldiləcək."), answeredBy: PEOPLE.engineer, answeredAt: "2026-11-10", costImpact: true, timeImpact: false },
    { id: "RFI-0008", ref: "RFI-0008", subject: T("Asphalt build-up for the yard", "Həyət üçün asfalt qatları"), question: T("Please confirm coarse and fine layer thicknesses for the HGV yard.", "Yük maşını həyəti üçün iri və xırda dənəli qatların qalınlığını təsdiqləyin."), discipline: "site", sheetId: "BP-6", activityId: id("SW-130"), raisedBy: PEOPLE.qs, raisedAt: "2026-11-16", dueAt: "2026-12-01", status: "OPEN", priority: "LOW", answer: null, answeredBy: null, answeredAt: null, costImpact: true, timeImpact: false },
  ];

  const rate = (k: string) => data.rates[k]?.rate ?? 0;
  const changes: ChangeOrder[] = [
    { id: "VO-0001", ref: "VO-0001", title: T("Second roller shutter on the north elevation", "Şimal fasadında ikinci jalüz qapı"), reason: "CLIENT", description: T("Client asked for a second loading door between grids 6 and 7.", "Sifarişçi 6–7 oxları arasında ikinci yükləmə qapısı istəyib."), status: "APPROVED", raisedAt: "2026-10-27", decidedAt: "2026-11-04", daysDelta: 0, rfiId: null, lines: [{ itemId: null, description: T("Sealed roller shutter door", "Hermetik jalüz qapı"), unit: "ədəd", qtyDelta: 1, rate: rate("door_roller") }, { itemId: null, description: T("Limestone wall omitted at the opening", "Açılışda əhəng daşı divar çıxılır"), unit: "m²", qtyDelta: -16.8, rate: rate("wall_limestone") }] },
    { id: "VO-0002", ref: "VO-0002", title: T("Heavier truss connection plates (from RFI-0004)", "Ağır ferma birləşmə lövhələri (RFI-0004 üzrə)"), reason: "RFI", description: T("Expected outcome of RFI-0004: 18 mm plates, 4 × M20 bolts and embedded parts at every column head.", "RFI-0004-ün gözlənilən nəticəsi: hər dirək başlığında 18 mm lövhə, 4 × M20 bolt və gömülü hissələr."), status: "UNDER_REVIEW", raisedAt: "2026-11-11", decidedAt: null, daysDelta: 5, rfiId: "RFI-0004", lines: [{ itemId: null, description: T("Structural steel plates and stiffeners", "Konstruksiya polad lövhələri və bərkidicilər"), unit: "kg", qtyDelta: 1250, rate: rate("steel_struct") }, { itemId: null, description: T("Embedded parts and anchors", "Gömülü hissələr və ankerlər"), unit: "kg", qtyDelta: 420, rate: rate("steel_embed") }] },
    { id: "VO-0003", ref: "VO-0003", title: T("Entrance canopy to the admin building", "İnzibati binanın giriş çətiri"), reason: "CLIENT", description: T("Steel canopy over the main entrance with paved approach.", "Əsas girişin üzərində metal çətir və döşənmiş yanaşma."), status: "SUBMITTED", raisedAt: "2026-11-13", decidedAt: null, daysDelta: 4, rfiId: null, lines: [{ itemId: null, description: T("Structural steel canopy", "Metal çətir"), unit: "kg", qtyDelta: 620, rate: rate("steel_struct") }, { itemId: null, description: T("Paving 80 mm", "Səki daşı 80 mm"), unit: "m²", qtyDelta: 18, rate: rate("paving") }] },
    { id: "VO-0004", ref: "VO-0004", title: T("Thicker slab in the loading bay", "Yükləmə zonasında qalın plitə"), reason: "SITE", description: T("Ground slab thickened to 200 mm over 70 m² where trucks turn.", "Yük maşınlarının döndüyü 70 m² sahədə plitə 200 mm-ə qədər qalınlaşdırılıb."), status: "APPROVED", raisedAt: "2026-11-05", decidedAt: "2026-11-09", daysDelta: 0, rfiId: null, lines: [{ itemId: null, description: T("Concrete B15 in ground slab", "Döşəmə plitəsində B15 beton"), unit: "m³", qtyDelta: 14, rate: rate("conc_slab_grd") }, { itemId: null, description: T("Rebar A500C", "A500C armatur"), unit: "kg", qtyDelta: 1100, rate: rate("rebar_a500") }] },
    { id: "VO-0005", ref: "VO-0005", title: T("Omit metal ceiling in the store room", "Anbar otağında metal tavanın çıxarılması"), reason: "DESIGN", description: T("Exposed soffit painted instead of a metal suspended ceiling.", "Metal asma tavan əvəzinə açıq tavan rənglənir."), status: "DRAFT", raisedAt: "2026-11-16", decidedAt: null, daysDelta: -1, rfiId: null, lines: [{ itemId: null, description: T("Metal suspended ceiling", "Metal asma tavan"), unit: "m²", qtyDelta: -42, rate: rate("ceil_metal") }, { itemId: null, description: T("Paint to soffit", "Tavanın rənglənməsi"), unit: "m²", qtyDelta: 42, rate: rate("int_paint") }] },
  ];

  const ok = (en: string, az: string, result: "OK" | "NOK" | "NA" = "OK") => ({ item: T(en, az), result });
  const inspections: Inspection[] = [
    { id: "WIR-0001", ref: "WIR-0001", kind: "WIR", title: T("Formation level, warehouse pits", "Anbar çuxurlarının oturma səviyyəsi"), activityId: id("WH-110"), poId: null, location: T("Warehouse grid 1–9", "Anbar, 1–9 oxları"), requestedAt: "2026-10-22", inspectedAt: "2026-10-23", inspector: PEOPLE.engineer, status: "PASSED", checklist: [ok("Levels within ±20 mm", "Səviyyələr ±20 mm daxilində"), ok("No standing water", "Durğun su yoxdur"), ok("Bearing stratum confirmed", "Daşıyıcı qat təsdiqlənib")], notes: null, photos: ["KS-5"] },
    { id: "WIR-0002", ref: "WIR-0002", kind: "WIR", title: T("Blinding concrete B7.5", "B7.5 hazırlıq betonu"), activityId: id("WH-110"), poId: null, location: T("Warehouse grid 1–9", "Anbar, 1–9 oxları"), requestedAt: "2026-10-27", inspectedAt: "2026-10-27", inspector: PEOPLE.qa, status: "PASSED", checklist: [ok("Thickness 100 mm", "Qalınlıq 100 mm"), ok("Surface level", "Səth düzdür")], notes: null, photos: ["KS-7"] },
    { id: "WIR-0003", ref: "WIR-0003", kind: "WIR", title: T("Reinforcement to footings Ms-1", "Ms-1 bünövrələrinin armaturu"), activityId: id("WH-125"), poId: null, location: T("Grid A/1–A/5", "A/1–A/5 oxları"), requestedAt: "2026-11-02", inspectedAt: "2026-11-03", inspector: PEOPLE.engineer, status: "PASSED_WITH_COMMENTS", checklist: [ok("Bar sizes and spacing", "Armatur ölçüsü və addımı"), ok("Laps and anchorage", "Bindirmə və ankerləmə"), ok("Cover 50 mm", "Qoruyucu qat 50 mm", "NOK")], notes: T("Add spacers at the corners before the pour.", "Betonlamadan əvvəl künclərə aralayıcı əlavə edilsin."), photos: ["KS-12"] },
    { id: "WIR-0004", ref: "WIR-0004", kind: "WIR", title: T("Reinforcement to footings Ms-3", "Ms-3 bünövrələrinin armaturu"), activityId: id("WH-125"), poId: null, location: T("Grid C/1–C/9", "C/1–C/9 oxları"), requestedAt: "2026-11-11", inspectedAt: "2026-11-12", inspector: PEOPLE.engineer, status: "FAILED", checklist: [ok("Bar sizes and spacing", "Armatur ölçüsü və addımı"), ok("Cover spacers", "Qoruyucu qat aralayıcıları", "NOK"), ok("Starter bars for columns", "Dirəklər üçün buraxılışlar")], notes: T("Spacers missing on six bases. NCR-0001 raised.", "Altı bünövrədə aralayıcı yoxdur. NCR-0001 açılıb."), photos: ["KS-12"] },
    { id: "WIR-0005", ref: "WIR-0005", kind: "WIR", title: T("Admin strip foundation reinforcement", "İnzibati bina lent bünövrə armaturu"), activityId: id("AD-125"), poId: null, location: T("Admin building", "İnzibati bina"), requestedAt: "2026-11-18", inspectedAt: null, inspector: PEOPLE.engineer, status: "REQUESTED", checklist: [ok("Bar sizes and spacing", "Armatur ölçüsü və addımı", "NA"), ok("Cover", "Qoruyucu qat", "NA")], notes: null, photos: [] },
    { id: "MIR-0001", ref: "MIR-0001", kind: "MIR", title: T("Ready-mix concrete B25, cube results", "B25 hazır beton, kub nəticələri"), activityId: id("WH-120"), poId: "PO-0001", location: T("Site laboratory", "Meydança laboratoriyası"), requestedAt: "2026-10-30", inspectedAt: "2026-11-06", inspector: PEOPLE.qa, status: "PASSED", checklist: [ok("7-day strength ≥ 70%", "7 günlük möhkəmlik ≥ 70%"), ok("Slump 120 ± 20 mm", "Konus çökməsi 120 ± 20 mm"), ok("Delivery tickets match", "Çatdırılma qəbzləri uyğundur")], notes: null, photos: [] },
    { id: "MIR-0002", ref: "MIR-0002", kind: "MIR", title: T("Rebar A500C mill certificates", "A500C armatur zavod sertifikatları"), activityId: id("WH-125"), poId: "PO-0002", location: T("Main store", "Əsas anbar"), requestedAt: "2026-11-03", inspectedAt: "2026-11-04", inspector: PEOPLE.qa, status: "PASSED_WITH_COMMENTS", checklist: [ok("Certificates for every heat", "Hər əritmə üçün sertifikat"), ok("Tags match certificates", "Etiketlər sertifikata uyğundur"), ok("Quantity matches the order", "Miqdar sifarişə uyğundur", "NOK")], notes: T("6 t still to come on the same order.", "Eyni sifariş üzrə hələ 6 t gəlməlidir."), photos: [] },
    { id: "MIR-0003", ref: "MIR-0003", kind: "MIR", title: T("Sawn limestone samples", "Kəsilmiş əhəng daşı nümunələri"), activityId: id("WH-180"), poId: null, location: T("Main store", "Əsas anbar"), requestedAt: "2026-11-17", inspectedAt: null, inspector: PEOPLE.architect, status: "REQUESTED", checklist: [ok("Size 390 × 190 × 190", "Ölçü 390 × 190 × 190", "NA"), ok("Strength class M35", "Möhkəmlik sinfi M35", "NA")], notes: null, photos: [] },
    { id: "NCR-0001", ref: "NCR-0001", kind: "NCR", title: T("Cover spacers missing on footings Ms-3", "Ms-3 bünövrələrində aralayıcılar yoxdur"), activityId: id("WH-125"), poId: null, location: T("Grid C/1–C/9", "C/1–C/9 oxları"), requestedAt: "2026-11-12", inspectedAt: "2026-11-12", inspector: PEOPLE.qa, status: "OPEN", checklist: [ok("Spacers fitted", "Aralayıcılar quraşdırılıb", "NOK"), ok("Re-inspection booked", "Təkrar yoxlama təyin edilib")], notes: T("Corrective action: fit 50 mm spacers and re-inspect before the pour.", "Düzəliş: 50 mm aralayıcılar qoyulsun və betonlamadan əvvəl təkrar yoxlansın."), photos: ["KS-12"] },
    { id: "NCR-0002", ref: "NCR-0002", kind: "NCR", title: T("Honeycombing on footing Ms-2", "Ms-2 bünövrəsində boşluqlar"), activityId: id("WH-120"), poId: null, location: T("Grid B/4", "B/4 oxu"), requestedAt: "2026-11-05", inspectedAt: "2026-11-05", inspector: PEOPLE.qa, status: "CLOSED", checklist: [ok("Repair mortar applied", "Təmir məhlulu tətbiq edilib"), ok("Engineer accepted repair", "Mühəndis təmiri qəbul edib")], notes: null, photos: ["KS-7"] },
  ];

  const sectionsByBuilding = new Map<string, string[]>();
  for (const k of sectionValue.keys()) {
    const [b, s] = k.split("/") as [string, string];
    sectionsByBuilding.set(b, [...(sectionsByBuilding.get(b) ?? []), s]);
  }
  const pctOf = (b: string, s: string) => {
    const acts = activities.filter((a) => a.building === b && a.section === s);
    if (!acts.length) return 0;
    const tot = acts.reduce((x, a) => x + a.budget, 0) || 1;
    return round(acts.reduce((x, a) => x + a.budget * a.pct, 0) / tot / 100, 3);
  };
  const ipcLines = [...sectionsByBuilding.entries()].flatMap(([b, ss]) => ss.map((s) => ({ building: b, section: s, pctToDate: pctOf(b, s) })));
  const ipcs: Ipc[] = [
    { id: "IPC-01", no: 1, from: "2026-10-05", to: "2026-10-31", status: "PAID", submittedAt: "2026-11-02", certifiedAt: "2026-11-09", retention: 0.05, advanceRecovery: 0.1, lines: ipcLines.map((l) => ({ building: l.building, section: l.section, pctPrev: 0, pctToDate: round(l.pctToDate * 0.45, 3) })) },
    { id: "IPC-02", no: 2, from: "2026-11-01", to: "2026-11-30", status: "DRAFT", submittedAt: null, certifiedAt: null, retention: 0.05, advanceRecovery: 0.1, lines: ipcLines.map((l) => ({ building: l.building, section: l.section, pctPrev: round(l.pctToDate * 0.45, 3), pctToDate: l.pctToDate })) },
  ];

  const calendar: CalendarDay[] = [
    { date: "2026-11-08", name: T("Victory Day", "Zəfər Günü"), kind: "HOLIDAY" },
    { date: "2026-11-09", name: T("National Flag Day", "Dövlət Bayrağı Günü"), kind: "HOLIDAY" },
    { date: "2026-12-31", name: T("World Azerbaijanis Solidarity Day", "Dünya Azərbaycanlılarının Həmrəyliyi Günü"), kind: "HOLIDAY" },
    { date: "2027-01-01", name: T("New Year", "Yeni il"), kind: "HOLIDAY" },
    { date: "2027-01-02", name: T("New Year", "Yeni il"), kind: "HOLIDAY" },
    { date: "2027-01-04", name: T("Winter shutdown", "Qış fasiləsi"), kind: "SHUTDOWN" },
    { date: "2027-01-05", name: T("Winter shutdown", "Qış fasiləsi"), kind: "SHUTDOWN" },
    { date: "2027-01-06", name: T("Winter shutdown", "Qış fasiləsi"), kind: "SHUTDOWN" },
    { date: "2027-03-08", name: T("International Women's Day", "Beynəlxalq Qadınlar Günü"), kind: "HOLIDAY" },
    { date: "2027-03-10", name: T("Ramadan holiday", "Ramazan bayramı"), kind: "HOLIDAY" },
    { date: "2027-03-11", name: T("Ramadan holiday", "Ramazan bayramı"), kind: "HOLIDAY" },
    { date: "2027-03-20", name: T("Novruz", "Novruz bayramı"), kind: "HOLIDAY" },
    { date: "2027-03-22", name: T("Novruz", "Novruz bayramı"), kind: "HOLIDAY" },
    { date: "2027-03-23", name: T("Novruz", "Novruz bayramı"), kind: "HOLIDAY" },
    { date: "2027-03-24", name: T("Novruz", "Novruz bayramı"), kind: "HOLIDAY" },
    { date: "2027-05-09", name: T("Victory over Fascism Day", "Faşizm üzərində Qələbə Günü"), kind: "HOLIDAY" },
    { date: "2027-05-17", name: T("Gurban holiday", "Qurban bayramı"), kind: "HOLIDAY" },
    { date: "2027-05-18", name: T("Gurban holiday", "Qurban bayramı"), kind: "HOLIDAY" },
    { date: "2027-05-28", name: T("Independence Day", "Müstəqillik Günü"), kind: "HOLIDAY" },
    { date: "2027-06-15", name: T("National Salvation Day", "Milli Qurtuluş Günü"), kind: "HOLIDAY" },
    { date: "2027-06-26", name: T("Armed Forces Day", "Silahlı Qüvvələr Günü"), kind: "HOLIDAY" },
    { date: "2026-12-27", name: T("Extra working Sunday (slab pour)", "Əlavə iş günü (plitə betonlaması)"), kind: "EXTRA" },
  ];

  return { wbs: WBS, activities, links, milestones, delays, impacts, recovery, reports, zones, parties, subs: SUBS, rfis, changes, inspections, ipcs, calendar, workweek: [1, 2, 3, 4, 5, 6] };
}
