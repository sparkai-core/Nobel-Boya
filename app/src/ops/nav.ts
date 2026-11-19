import {
  AlertOctagon,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  CalendarDays,
  CalendarRange,
  ChartGantt,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Construction,
  FileCheck2,
  FileInput,
  FileQuestion,
  FileSignature,
  FileSpreadsheet,
  FileStack,
  Flag,
  Gauge,
  GitCompareArrows,
  GitFork,
  HardHat,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LibraryBig,
  ListTree,
  type LucideIcon,
  Network,
  NotebookPen,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Route,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SquarePlus,
  Table2,
  TimerReset,
  TrendingDown,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  Zap,
  Receipt,
  Banknote,
} from "lucide-react";
import { P } from "../data";

export type NavLinkDef = { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: "approvals" | "exceptions" | "checks" | "delays" | "rfis" | "invoices" | "constraints" | "safety" };
export type NavGroup = { id: string; label: string | null; links: NavLinkDef[] };
export type ModuleKey = "estimate" | "pm" | "procurement";
export type ModuleDef = { key: ModuleKey; label: string; short: string; icon: LucideIcon; home: string; match: (path: string) => boolean; groups: NavGroup[] };

export const MODULES: ModuleDef[] = [
  {
    key: "estimate",
    label: "Estimation",
    short: "Estimate",
    icon: Table2,
    home: "/overview",
    match: (p) => p.startsWith(P) && !p.startsWith(`${P}/pm`) && !p.startsWith(`${P}/procurement`),
    groups: [
      {
        id: "est",
        label: null,
        links: [
          { to: "/overview", label: "Overview", icon: Gauge },
          { to: "/drawings", label: "Drawings", icon: Layers },
          { to: "/bill", label: "Bill of quantities", icon: Table2 },
          { to: "/checks", label: "Checks", icon: ClipboardCheck, badge: "checks" },
          { to: "/rates", label: "Rates and mark-ups", icon: ReceiptText },
          { to: "/export", label: "Export", icon: FileSpreadsheet },
        ],
      },
    ],
  },
  {
    key: "pm",
    label: "Project management",
    short: "Projects",
    icon: ChartGantt,
    home: `${P}/pm`,
    match: (p) => p.startsWith(`${P}/pm`),
    groups: [
      {
        id: "pm-plan",
        label: "Plan",
        links: [
          { to: `${P}/pm`, label: "Overview", icon: LayoutDashboard, end: true },
          { to: `${P}/pm/programme`, label: "Programme", icon: ChartGantt },
          { to: `${P}/pm/planning`, label: "Planning (P6 / MS Project)", icon: FileInput },
          { to: `${P}/pm/wbs`, label: "WBS", icon: ListTree },
          { to: `${P}/pm/milestones`, label: "Milestones", icon: Flag },
          { to: `${P}/pm/calendar`, label: "Working calendar", icon: CalendarDays },
        ],
      },
      {
        id: "pm-progress",
        label: "Progress",
        links: [
          { to: `${P}/pm/progress-tracking`, label: "Progress tracking", icon: TrendingUp },
          { to: `${P}/pm/lookahead`, label: "Look-ahead", icon: CalendarRange, badge: "constraints" },
          { to: `${P}/pm/daily-reports`, label: "Daily reports", icon: NotebookPen },
        ],
      },
      {
        id: "pm-analyse",
        label: "Analyse",
        links: [
          { to: `${P}/pm/critical-path`, label: "Critical path", icon: Route },
          { to: `${P}/pm/dependencies`, label: "Dependencies", icon: Network },
          { to: `${P}/pm/finish-risk`, label: "Finish risk", icon: TrendingDown },
          { to: `${P}/pm/health`, label: "Health", icon: HeartPulse },
        ],
      },
      {
        id: "pm-control",
        label: "Control",
        links: [
          { to: `${P}/pm/delays`, label: "Delays", icon: AlertOctagon, badge: "delays" },
          { to: `${P}/pm/live`, label: "Live programme", icon: Zap },
          { to: `${P}/pm/recovery`, label: "Recovery", icon: TimerReset },
        ],
      },
      {
        id: "pm-site",
        label: "Site & HSE",
        links: [
          { to: `${P}/pm/equipment`, label: "Equipment", icon: Construction },
          { to: `${P}/pm/workforce`, label: "Workforce", icon: UsersRound },
          { to: `${P}/pm/safety`, label: "Safety", icon: ShieldCheck, badge: "safety" },
          { to: `${P}/pm/inspections`, label: "Inspections", icon: ShieldAlert },
        ],
      },
      {
        id: "pm-commercial",
        label: "Commercial",
        links: [
          { to: `${P}/pm/rfis`, label: "RFIs", icon: FileQuestion, badge: "rfis" },
          { to: `${P}/pm/submittals`, label: "Submittals", icon: FileCheck2 },
          { to: `${P}/pm/changes`, label: "Changes", icon: GitFork },
          { to: `${P}/pm/billing`, label: "Progress billing", icon: Coins },
        ],
      },
      {
        id: "pm-team",
        label: "Team",
        links: [
          { to: `${P}/pm/parties`, label: "Parties", icon: Users },
          { to: `${P}/pm/subcontractors`, label: "Subcontractors", icon: HardHat },
        ],
      },
    ],
  },
  {
    key: "procurement",
    label: "Procurement",
    short: "Procure",
    icon: ShoppingCart,
    home: `${P}/procurement`,
    match: (p) => p.startsWith(`${P}/procurement`),
    groups: [
      {
        id: "pr-home",
        label: null,
        links: [{ to: `${P}/procurement`, label: "Overview", icon: LayoutDashboard, end: true }],
      },
      {
        id: "pr-plan",
        label: "Plan & intelligence",
        links: [
          { to: `${P}/procurement/schedule`, label: "Procurement schedule", icon: CalendarRange },
          { to: `${P}/procurement/analytics`, label: "Spend analytics", icon: BarChart3 },
        ],
      },
      {
        id: "pr-sourcing",
        label: "Sourcing",
        links: [
          { to: `${P}/procurement/requests`, label: "Material requests", icon: ClipboardList },
          { to: `${P}/procurement/rfqs`, label: "RFQs", icon: Send },
          { to: `${P}/procurement/quotes`, label: "Quotations", icon: FileStack },
          { to: `${P}/procurement/compare`, label: "Comparison", icon: GitCompareArrows },
        ],
      },
      {
        id: "pr-purchasing",
        label: "Purchasing",
        links: [
          { to: `${P}/procurement/approvals`, label: "Approvals", icon: BadgeCheck, badge: "approvals" },
          { to: `${P}/procurement/orders`, label: "Purchase orders", icon: ShoppingCart, end: true },
          { to: `${P}/procurement/orders/new`, label: "New purchase order", icon: SquarePlus },
          { to: `${P}/procurement/agreements`, label: "Framework agreements", icon: FileSignature },
          { to: `${P}/procurement/catalogue`, label: "Materials catalogue", icon: LibraryBig },
        ],
      },
      {
        id: "pr-orders",
        label: "Delivery & stock",
        links: [
          { to: `${P}/procurement/deliveries`, label: "Expediting", icon: PackageSearch },
          { to: `${P}/procurement/receipts`, label: "Goods receipt", icon: Truck },
          { to: `${P}/procurement/inventory`, label: "Inventory", icon: Boxes },
        ],
      },
      {
        id: "pr-money",
        label: "Money",
        links: [
          { to: `${P}/procurement/invoices`, label: "Supplier invoices", icon: Receipt, badge: "invoices" },
          { to: `${P}/procurement/pay-run`, label: "Pay run", icon: Banknote },
          { to: `${P}/procurement/payments`, label: "Payments", icon: Wallet },
          { to: `${P}/procurement/budget`, label: "Budget vs committed", icon: PackageCheck },
        ],
      },
      {
        id: "pr-vendors",
        label: "Vendors",
        links: [
          { to: `${P}/procurement/vendors`, label: "Vendors", icon: Building2, end: true },
          { to: `${P}/procurement/vendors/onboarding`, label: "Vendor onboarding", icon: UserPlus },
        ],
      },
    ],
  },
];
