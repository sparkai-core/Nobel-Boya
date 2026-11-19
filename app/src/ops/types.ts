/**
 * Operations data model for the Project Management, Procurement and Vendor Portal modules.
 * Everything lives in the browser (seed data + persisted zustand store). Dates are ISO "YYYY-MM-DD"
 * (or full ISO timestamps where a time matters). Money is AZN.
 */

/** Display text in both interface languages. User-entered text uses the same string for both. */
export type Txt = { en: string; az: string };

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Trades map 1:1 onto the rate groups of the BOQ dataset (data.rates[*].group). */
export type Trade =
  | "Concrete"
  | "Reinforcement"
  | "Steel"
  | "Earthworks and bases"
  | "Masonry"
  | "Finishes"
  | "Roofing"
  | "Doors and windows"
  | "External works"
  | "Building services";

// ---------------------------------------------------------------- procurement

export type VendorStatus = "APPROVED" | "ON_HOLD" | "DISQUALIFIED";

export type Vendor = {
  id: string;
  name: string;
  trade: Trade;
  /** Secondary trades the vendor also quotes for. */
  trades: Trade[];
  city: string;
  trn: string;
  licence: string | null;
  contact: string;
  email: string;
  phone: string;
  website: string | null;
  paymentTerms: string;
  status: VendorStatus;
  risk: Risk;
  /** 0–100 sub scores. */
  scores: { reliability: number; quality: number; price: number; delivery: number };
  /** 0–10 overall score. */
  overall: number;
  avgDeliveryDays: number;
  since: string;
  portal: boolean;
  note: Txt | null;
  /** Past projects used for the vendor record. */
  history: { project: string; year: number; value: number; onTime: boolean }[];
};

/** A material is a BOQ rate line: the key is the rate key in data.rates. */
export type Material = {
  key: string;
  name: Txt;
  unit: string;
  trade: Trade;
  /** Budget rate (sample BOQ rate), AZN per unit. */
  rate: number;
  /** Total measured quantity in the BOQ. */
  budgetQty: number;
};

export type Line = {
  key: string;
  /** Material key (BOQ rate key) when the line is a catalogued material. */
  material: string | null;
  description: Txt;
  spec: string | null;
  qty: number;
  unit: string;
};

export type MrStatus = "DRAFT" | "SUBMITTED" | "SOURCING" | "FULFILLED" | "CANCELLED";

export type MaterialRequest = {
  id: string;
  ref: string;
  title: Txt;
  status: MrStatus;
  priority: Priority;
  requestedBy: string;
  trade: Trade;
  building: string;
  activityId: string | null;
  neededBy: string;
  createdAt: string;
  submittedAt: string | null;
  notes: Txt | null;
  source: "BOQ" | "PROGRAMME" | "STOCK" | "MANUAL";
  lines: Line[];
};

export type InvitationStatus = "INVITED" | "ACKNOWLEDGED" | "SUBMITTED" | "DECLINED";
export type Invitation = { vendorId: string; status: InvitationStatus; at: string; reason: string | null };

export type RfqStatus = "DRAFT" | "OPEN" | "CLOSED" | "AWARDED" | "CANCELLED";

export type Rfq = {
  id: string;
  ref: string;
  title: Txt;
  mrId: string | null;
  status: RfqStatus;
  trade: Trade;
  createdAt: string;
  dueDate: string;
  note: Txt | null;
  lines: Line[];
  invitations: Invitation[];
  awardedQuoteId: string | null;
};

export type QuoteStatus = "PROCESSING" | "NEEDS_REVIEW" | "EXTRACTED" | "MANUAL";
export type QuoteLine = {
  key: string;
  description: Txt;
  qty: number;
  unit: string;
  unitPrice: number;
  /** 0–1 reading confidence. */
  confidence: number;
  match: "MATCHED" | "REVIEW" | "UNMATCHED";
};
export type QuoteCheck = { label: Txt; result: "PASSED" | "WARNING" | "FAILED"; detail: Txt };
export type HistoryEvent = { at: string; actor: "SYSTEM" | "AI" | "USER" | "VENDOR"; text: Txt };

export type Quotation = {
  id: string;
  /** Vendor's own quote reference. */
  ref: string;
  rfqId: string | null;
  vendorId: string;
  status: QuoteStatus;
  source: "PORTAL" | "UPLOAD" | "MANUAL";
  receivedAt: string;
  validUntil: string;
  deliveryDays: number;
  paymentTerms: string;
  vatRate: number;
  shipping: number;
  lines: QuoteLine[];
  risk: Risk;
  /** 0–1 overall reading confidence. */
  confidence: number;
  checks: QuoteCheck[];
  duplicate: boolean;
  notes: Txt | null;
  history: HistoryEvent[];
  outcome: "WON" | "LOST" | null;
};

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Approval = {
  id: string;
  ref: string;
  quoteId: string;
  rfqId: string | null;
  vendorId: string;
  title: Txt;
  amount: number;
  status: ApprovalStatus;
  /** Two approvals are needed above APPROVAL_LIMIT. */
  requiredLevels: 1 | 2;
  /** Approvals given so far. */
  level: 0 | 1 | 2;
  requestedBy: string;
  requestedAt: string;
  firstBy: string | null;
  firstAt: string | null;
  finalBy: string | null;
  finalAt: string | null;
  notes: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH";
  poId: string | null;
};

export type PoStatus = "DRAFT" | "ISSUED" | "PART_RECEIVED" | "CLOSED" | "CANCELLED";
export type PoLine = { key: string; material: string | null; description: Txt; qty: number; unit: string; rate: number; received: number };

export type PurchaseOrder = {
  id: string;
  ref: string;
  vendorId: string;
  quoteId: string | null;
  approvalId: string | null;
  rfqId: string | null;
  mrId: string | null;
  status: PoStatus;
  issuedAt: string;
  expectedAt: string;
  paymentTerms: string;
  deliverTo: Txt;
  vatRate: number;
  shipping: number;
  lines: PoLine[];
  /** Vendor side: has the vendor accepted the order in the portal. */
  vendorAck: "PENDING" | "ACCEPTED";
  dispatchedAt: string | null;
  dispatchNote: string | null;
};

export type ShortReason = "NOT_DELIVERED" | "DAMAGED" | "WRONG_ITEM";
export type GrnStatus = "DRAFT" | "PART_RECEIVED" | "RECEIVED" | "REJECTED";
export type GrnLine = {
  key: string;
  material: string | null;
  description: Txt;
  unit: string;
  ordered: number;
  /** Received on earlier receipts of the same order. */
  prior: number;
  accepted: number;
  shortReason: ShortReason | null;
};

export type GoodsReceipt = {
  id: string;
  ref: string;
  poId: string;
  vendorId: string;
  status: GrnStatus;
  receivedAt: string | null;
  receivedBy: string | null;
  remarks: string | null;
  lines: GrnLine[];
};

export type Store = "Main store" | "Warehouse site" | "Admin site";

export type StockItem = {
  key: string;
  name: Txt;
  unit: string;
  trade: Trade;
  store: Store;
  onHand: number;
  reorder: number;
  updatedAt: string;
};

export type Movement = {
  id: string;
  key: string;
  type: "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "TRANSFER";
  qty: number;
  at: string;
  ref: string;
  note: Txt | null;
  activityId: string | null;
};

export type ExceptionReason = "DUPLICATE" | "OVER_BUDGET" | "LOW_CONFIDENCE" | "EXPIRING" | "RISK" | "MISSING_TRN";

export type ProcException = {
  id: string;
  quoteId: string;
  reason: ExceptionReason;
  /** The check that stopped the quote: Read → Check → Risk screen. */
  stage: "READ" | "CHECK" | "RISK";
  severity: "critical" | "warning";
  status: "open" | "assigned" | "resolved" | "dismissed";
  assignee: string | null;
  raisedAt: string;
  detail: Txt;
  action: "review" | "validate" | "re_extract";
  history: HistoryEvent[];
};

export type PaymentStatus = "SCHEDULED" | "READY" | "PAID" | "ON_HOLD";

export type Payment = {
  id: string;
  ref: string;
  poId: string;
  vendorId: string;
  amount: number;
  kind: "ADVANCE" | "ON_DELIVERY" | "RETENTION";
  dueDate: string;
  status: PaymentStatus;
  paidAt: string | null;
  method: "Bank transfer" | "Cheque" | "Cash" | null;
  bankRef: string | null;
  holdReason: string | null;
};

// ---------------------------------------------------------------- project management

export type ActivityStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";

export type WbsNode = { id: string; parentId: string | null; code: string; name: Txt; building: string | null };

export type Activity = {
  id: string;
  code: string;
  wbsId: string;
  name: Txt;
  building: string;
  /** BOQ section id (data.sections) the work belongs to; null for general items. */
  section: string | null;
  /** Current programme dates. */
  start: string;
  end: string;
  /** Baseline dates. */
  bStart: string;
  bEnd: string;
  aStart: string | null;
  aEnd: string | null;
  pct: number;
  status: ActivityStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isMilestone: boolean;
  /** Subcontractor id, or a crew name. */
  owner: string;
  budget: number;
  crew: number;
  blockedReason: Txt | null;
};

export type LinkType = "FS" | "SS" | "FF" | "SF";
export type Dependency = { id: string; from: string; to: string; type: LinkType; lag: number };

export type Milestone = {
  id: string;
  code: string;
  name: Txt;
  baseline: string;
  target: string;
  forecast: string;
  actual: string | null;
  /** Payment tied to the milestone, if any. */
  payment: number | null;
  drivers: string[];
};

export type DelayCause =
  | "WEATHER"
  | "MATERIAL_DELIVERY"
  | "DESIGN_CHANGE"
  | "RFI"
  | "MANPOWER"
  | "EQUIPMENT"
  | "AUTHORITY"
  | "SUBCONTRACTOR"
  | "SITE_CONDITION"
  | "VARIATION";

export type DelayStatus = "OPEN" | "UNDER_REVIEW" | "CONFIRMED" | "MITIGATED" | "RESOLVED" | "REJECTED";

export type DelayEvent = {
  id: string;
  ref: string;
  title: Txt;
  cause: DelayCause;
  activityId: string;
  startedAt: string;
  daysLost: number;
  floatAbsorbed: number;
  status: DelayStatus;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  party: string;
  notes: Txt | null;
  milestoneIds: string[];
  criticalPathChanged: boolean;
  /** Linked records in other modules. */
  links: { kind: "PO" | "RFI" | "CHANGE" | "REPORT"; id: string }[];
};

export type ImpactKind = "TASK_DELAY" | "MANPOWER_SHORTAGE" | "WEATHER_IMPACT" | "EQUIPMENT_FAILURE";
export type LiveImpact = {
  id: string;
  kind: ImpactKind;
  activityId: string;
  startedAt: string;
  text: Txt;
  status: "REPORTED" | "UNDER_REVIEW" | "CONFIRMED" | "MITIGATED" | "RESOLVED" | "REJECTED";
  daysImpact: number;
  crewPlanned: number | null;
  crewOnSite: number | null;
  hoursLost: number | null;
};

export type RecoveryScenario = {
  id: string;
  name: Txt;
  status: "DRAFT" | "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "APPLIED" | "REJECTED";
  daysRecovered: number;
  cost: number;
  risk: "low" | "medium" | "high";
  summary: Txt;
  assumptions: Txt[];
  actions: { title: Txt; owner: string; due: string; days: number }[];
};

export type Weather = "SUNNY" | "CLOUDY" | "RAIN" | "WIND";
export type PlantStatus = "WORKING" | "IDLE" | "STANDBY" | "BROKEN_DOWN";

export type DailyReport = {
  id: string;
  date: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  author: string;
  weather: Weather;
  tempC: number;
  conditions: Txt;
  entries: { activityId: string; zone: string; text: Txt; qty: number; unit: string; pct: number; over: boolean }[];
  labour: { trade: Txt; count: number }[];
  plant: { name: Txt; status: PlantStatus; hours: number }[];
  materials: { key: string; qty: number; unit: string }[];
  blockers: { text: Txt; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; owner: string; due: string; status: "OPEN" | "RESOLVED" }[];
  /** Sheet ids used as site photos (renders of the drawing package). */
  photos: string[];
  notes: Txt | null;
};

export type ProgressZone = {
  id: string;
  code: string;
  name: Txt;
  building: string;
  /** Storey index used by the level rail (0 = ground). */
  level: number;
  category: "EXCAVATION" | "CONCRETE" | "STEEL" | "MEP" | "FINISHING" | "GENERAL";
  activityId: string;
  expectedPct: number;
  actualPct: number;
  captures: { date: string; pct: number; confidence: number; source: "DRONE" | "PHONE" | "CCTV"; photo: string; note: Txt }[];
};

export type PartyRole = "OWNER" | "CONSULTANT" | "CONTRACTOR" | "SUBCONTRACTOR" | "VENDOR";
export type Party = {
  id: string;
  role: PartyRole;
  name: string;
  people: { name: string; title: Txt; access: "PROJECT_ADMIN" | "PROJECT_MEMBER" | "PROJECT_VIEWER" }[];
};

export type Subcontractor = {
  id: string;
  code: string;
  name: string;
  trade: Txt;
  contact: string;
  phone: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "COMPLETED";
  workers: number;
  equipment: number;
  packageValue: number;
  notes: Txt | null;
};

export type RfiStatus = "OPEN" | "ANSWERED" | "CLOSED";
export type Rfi = {
  id: string;
  ref: string;
  subject: Txt;
  question: Txt;
  discipline: string;
  sheetId: string | null;
  activityId: string | null;
  raisedBy: string;
  raisedAt: string;
  dueAt: string;
  status: RfiStatus;
  priority: Priority;
  answer: Txt | null;
  answeredBy: string | null;
  answeredAt: string | null;
  costImpact: boolean;
  timeImpact: boolean;
};

export type ChangeStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type ChangeOrder = {
  id: string;
  ref: string;
  title: Txt;
  reason: "CLIENT" | "DESIGN" | "SITE" | "RFI";
  description: Txt;
  status: ChangeStatus;
  raisedAt: string;
  decidedAt: string | null;
  daysDelta: number;
  rfiId: string | null;
  /** qtyDelta × rate gives the cost delta of each line. */
  lines: { itemId: string | null; description: Txt; unit: string; qtyDelta: number; rate: number }[];
};

export type InspectionKind = "WIR" | "MIR" | "NCR";
export type InspectionStatus = "REQUESTED" | "PASSED" | "PASSED_WITH_COMMENTS" | "FAILED" | "OPEN" | "CLOSED";
export type Inspection = {
  id: string;
  ref: string;
  kind: InspectionKind;
  title: Txt;
  activityId: string | null;
  poId: string | null;
  location: Txt;
  requestedAt: string;
  inspectedAt: string | null;
  inspector: string;
  status: InspectionStatus;
  checklist: { item: Txt; result: "OK" | "NOK" | "NA" }[];
  notes: Txt | null;
  photos: string[];
};

export type Ipc = {
  id: string;
  no: number;
  from: string;
  to: string;
  status: "DRAFT" | "SUBMITTED" | "CERTIFIED" | "PAID";
  submittedAt: string | null;
  certifiedAt: string | null;
  retention: number;
  advanceRecovery: number;
  /** Progress per building × BOQ section, as a share of the section value. */
  lines: { building: string; section: string; pctPrev: number; pctToDate: number }[];
};

export type CalendarDay = { date: string; name: Txt; kind: "HOLIDAY" | "SHUTDOWN" | "EXTRA" };

/** A running feed shown on dashboards (newest first). */
export type FeedEvent = { id: string; at: string; module: "PM" | "PROC" | "VENDOR"; text: Txt; link: string | null; actor: string };

export type OpsData = {
  vendors: Vendor[];
  materials: Material[];
  mrs: MaterialRequest[];
  rfqs: Rfq[];
  quotes: Quotation[];
  approvals: Approval[];
  pos: PurchaseOrder[];
  grns: GoodsReceipt[];
  stock: StockItem[];
  movements: Movement[];
  exceptions: ProcException[];
  payments: Payment[];

  wbs: WbsNode[];
  activities: Activity[];
  links: Dependency[];
  milestones: Milestone[];
  delays: DelayEvent[];
  impacts: LiveImpact[];
  recovery: RecoveryScenario[];
  reports: DailyReport[];
  zones: ProgressZone[];
  parties: Party[];
  subs: Subcontractor[];
  rfis: Rfi[];
  changes: ChangeOrder[];
  inspections: Inspection[];
  ipcs: Ipc[];
  calendar: CalendarDay[];
  workweek: number[];

  // ---- phase 2
  programmes: Programme[];
  revisions: ProgrammeRev[];
  resources: Resource[];
  snapshots: ProgressSnapshot[];
  dataDate: string;
  invoices: Invoice[];
  payRuns: PayRun[];
  agreements: Agreement[];
  priceSeries: PriceSeries[];
  invites: VendorInvite[];
  equipment: Equipment[];
  workers: Worker[];
  attendance: AttendanceRow[];
  incidents: Incident[];
  permits: Permit[];
  toolbox: ToolboxTalk[];
  ppeChecks: PpeCheck[];
  submittals: Submittal[];
  constraints: Constraint[];
  projects: DemoProject[];
  templates: ProjectTemplate[];
  expedites: Expedite[];

  feed: FeedEvent[];
  /** Running counters used to number new records (MR-0001 …). */
  seq: Record<string, number>;
  /** Project facts the user enters (nothing here is invented). */
  setup: ProjectSetup;
};

/** Facts about the project and the company that only the user can give. */
export type ProjectSetup = {
  /** The user's company name, printed on orders and shown to vendors. Shared by every project. */
  company: string;
  plannedStart: string | null;
  contractFinish: string | null;
  contractValue: number | null;
  /** Cash available for the next pay run. */
  cashAvailable: number | null;
};

// ---------------------------------------------------------------- phase 2: planning and progress

export type Tool = "P6" | "MSP";

/** An imported or kept programme (P6 / MS Project schedule) of the project. */
export type Programme = {
  id: string;
  name: string;
  tool: Tool;
  file: string;
  projectCode: string;
  dataDate: string;
  contractFinish: string;
  finish: string;
  activities: number;
  links: number;
  wbsLevels: number;
  calendars: number;
  donePct: number;
  updatedAt: string;
  /** The programme the project currently follows. */
  current: boolean;
  warnings: Txt[];
};

/** A saved point of a programme: what every activity looked like at that revision. */
export type ProgrammeRev = {
  id: string;
  programmeId: string;
  rev: number;
  label: Txt;
  kind: "IMPORTED" | "MANUAL" | "KEPT";
  file: string | null;
  at: string;
  by: string;
  finish: string;
  activities: number;
  snapshot: { code: string; name: string; start: string; end: string; pct: number }[];
};

export type ResourceType = "LABOUR" | "PLANT" | "MATERIAL";
export type Resource = {
  id: string;
  code: string;
  name: Txt;
  type: ResourceType;
  unit: string;
  budget: number;
  used: number;
  activityIds: string[];
  /** Month "YYYY-MM" → quantity used (past) / still to come (future). */
  monthly: { month: string; used: number; toCome: number }[];
};

/** A submitted weekly progress update (P6-style data-date update). */
export type ProgressSnapshot = {
  id: string;
  dataDate: string;
  submittedAt: string;
  by: string;
  plannedPct: number;
  actualPct: number;
  spi: number;
  cpi: number;
  note: Txt | null;
  lines: { activityId: string; pctBefore: number; pct: number; remaining: number }[];
};

// ---------------------------------------------------------------- phase 2: procurement money and purchasing

export type InvoiceStatus = "TO_MATCH" | "MISMATCH" | "CREDIT_REQUESTED" | "SIGN_OFF" | "BOOKED" | "PAID" | "REJECTED";
export type InvoiceLine = { key: string; description: Txt; unit: string; qty: number; rate: number; poLineKey: string | null };

/** A supplier bill, matched three ways against the order and the goods received. */
export type Invoice = {
  id: string;
  /** Vendor's own invoice number. */
  ref: string;
  vendorId: string;
  poId: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  vatRate: number;
  source: "PORTAL" | "UPLOAD" | "EMAIL";
  confidence: number;
  duplicate: boolean;
  paymentId: string | null;
  history: HistoryEvent[];
};

export type PayRun = {
  id: string;
  ref: string;
  date: string;
  status: "PROPOSED" | "APPROVED" | "EXPORTED" | "CANCELLED";
  paymentIds: string[];
  cashToday: number;
  buffer: number;
  by: string;
};

/** Framework agreement / price list with a vendor. Call-offs become purchase orders. */
export type Agreement = {
  id: string;
  ref: string;
  vendorId: string;
  title: Txt;
  from: string;
  to: string;
  /** Spend cap in AZN. */
  cap: number;
  rates: { material: string; rate: number; unit: string; minQty: number }[];
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "DRAFT";
  terms: Txt;
  poIds: string[];
};

/** Monthly market price history and forecast for a tracked material. */
export type PriceSeries = {
  key: string;
  name: Txt;
  unit: string;
  category: Txt;
  /** Past 12 months, oldest first. */
  history: { month: string; price: number }[];
  /** Next 6 months. */
  forecast: { month: string; price: number; low: number; high: number }[];
  call: "BUY_NOW" | "WAIT" | "HOLD";
  leadDays: number;
  material: string | null;
};

export type VendorInvite = {
  id: string;
  company: string;
  contact: string;
  email: string;
  trade: Trade;
  status: "INVITED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  sentAt: string;
  checklist: { key: string; label: Txt; ok: boolean | null; note: string | null }[];
  score: number | null;
  vendorId: string | null;
};

/** Delivery chasing on a purchase order line. */
export type Expedite = { id: string; poId: string; at: string; by: string; note: Txt; newDate: string | null };

// ---------------------------------------------------------------- phase 2: site resources

export type EquipmentCategory = "CRANE" | "EXCAVATOR" | "LOADER" | "GENERATOR" | "VEHICLE" | "LIFT" | "PUMP" | "COMPACTOR";
export type EquipmentStatus = "ON_SITE" | "IDLE" | "MAINTENANCE" | "OFF_HIRE" | "AVAILABLE" | "BROKEN_DOWN";
export type Equipment = {
  id: string;
  code: string;
  name: Txt;
  category: EquipmentCategory;
  ownership: "OWNED" | "HIRED";
  vendorId: string | null;
  status: EquipmentStatus;
  zone: Txt;
  activityId: string | null;
  dayRate: number;
  hireFrom: string | null;
  hireTo: string | null;
  nextService: string;
  /** Working hours for the last 7 days, oldest first. */
  hours: number[];
  hireInvoices: { ref: string; period: string; billed: number; accrued: number }[];
};

export type Worker = {
  id: string;
  name: string;
  trade: Txt;
  employer: string;
  role: "OPERATIVE" | "FOREMAN" | "ENGINEER" | "OPERATOR" | "SUPERVISOR";
  rate: number;
  activityId: string | null;
  certs: { name: Txt; expires: string }[];
};
export type AttendanceStatus = "PRESENT" | "HALF" | "ABSENT" | "LEAVE" | "INJURY";
export type AttendanceRow = { date: string; workerId: string; status: AttendanceStatus; hours: number; activityId: string | null };

export type Incident = {
  id: string;
  ref: string;
  date: string;
  title: Txt;
  kind: "NEAR_MISS" | "FIRST_AID" | "LOST_TIME" | "PROPERTY" | "ENVIRONMENT";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  zone: Txt;
  status: "OPEN" | "INVESTIGATING" | "CLOSED";
  reportedBy: string;
  description: Txt;
  actions: { text: Txt; owner: string; due: string; done: boolean }[];
};
export type PermitKind = "HOT_WORK" | "WORK_AT_HEIGHT" | "EXCAVATION" | "LIFTING" | "CONFINED_SPACE" | "ELECTRICAL";
export type Permit = {
  id: string;
  ref: string;
  kind: PermitKind;
  title: Txt;
  zone: Txt;
  from: string;
  to: string;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "CLOSED" | "EXPIRED";
  issuedTo: string;
  issuedBy: string;
  activityId: string | null;
  checks: { item: Txt; ok: boolean }[];
};
export type ToolboxTalk = { id: string; date: string; topic: Txt; by: string; attendees: number; zone: Txt };
export type PpeCheck = { id: string; at: string; camera: string; zone: Txt; missing: ("HELMET" | "VEST" | "BOOTS" | "GLOVES" | "HARNESS")[]; status: "WAITING" | "CONFIRMED" | "FALSE_ALARM"; workerId: string | null };

// ---------------------------------------------------------------- phase 2: documents, constraints, portfolio

export type SubmittalStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "APPROVED_AS_NOTED" | "REVISE" | "REJECTED";
export type Submittal = {
  id: string;
  ref: string;
  title: Txt;
  spec: string;
  manufacturer: string;
  rev: number;
  submitBy: string;
  requiredOnSite: string;
  leadDays: number;
  status: SubmittalStatus;
  activityId: string | null;
  material: string | null;
  reviewer: string;
  mrId: string | null;
  sheetId: string | null;
  comments: Txt | null;
};

export type ConstraintKind = "MATERIAL" | "RFI" | "INSPECTION" | "CREW" | "PERMIT" | "DESIGN" | "EQUIPMENT";
export type Constraint = {
  id: string;
  activityId: string;
  kind: ConstraintKind;
  text: Txt;
  status: "OPEN" | "CLEARED";
  owner: string;
  due: string;
  link: { kind: "MR" | "PO" | "RFI" | "INSPECTION" | "PERMIT" | "SUBMITTAL" | "EQUIPMENT"; id: string } | null;
};

export type DemoProject = {
  id: string;
  code: string;
  name: Txt;
  client: string;
  location: Txt;
  start: string;
  finish: string;
  contractFinish: string;
  pct: number;
  plannedPct: number;
  status: "ACTIVE" | "PLANNING" | "ON_HOLD" | "COMPLETED";
  health: "on_track" | "at_risk" | "blocked" | "complete";
  tasks: number;
  blocked: number;
  overdue: number;
  openMrs: number;
  value: number;
  nextMilestone: { name: Txt; date: string } | null;
  /** QOBU opens the real project; DEMO rows are portfolio dummies. */
  source: "QOBU" | "DEMO";
};

export type ProjectTemplate = {
  id: string;
  name: Txt;
  kind: "GENERAL" | "WAREHOUSE" | "VILLA" | "HIGH_RISE" | "FIT_OUT";
  version: number;
  tasks: number;
  wbs: number;
  milestones: number;
  links: number;
  days: number;
  status: "IN_USE" | "ARCHIVED";
  lanes: { name: Txt; start: number; dur: number }[];
};
