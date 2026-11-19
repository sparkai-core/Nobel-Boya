import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route } from "react-router-dom";
import { P } from "../data";
import { useApp } from "../lib/store";
import { PageSkeleton } from "../components/kit/extra";

const ProcDashboardPage = lazy(() => import("../pages/procurement/ProcDashboardPage").then((m) => ({ default: m.ProcDashboardPage })));
const RequestsPage = lazy(() => import("../pages/procurement/RequestsPage").then((m) => ({ default: m.RequestsPage })));
const RequestNewPage = lazy(() => import("../pages/procurement/sourcing/RequestNewPage").then((m) => ({ default: m.RequestNewPage })));
const RequestDetailPage = lazy(() => import("../pages/procurement/sourcing/RequestDetailPage").then((m) => ({ default: m.RequestDetailPage })));
const RfqBoardPage = lazy(() => import("../pages/procurement/sourcing/RfqBoardPage").then((m) => ({ default: m.RfqBoardPage })));
const RfqNewPage = lazy(() => import("../pages/procurement/sourcing/RfqNewPage").then((m) => ({ default: m.RfqNewPage })));
const RfqDetailPage = lazy(() => import("../pages/procurement/sourcing/RfqDetailPage").then((m) => ({ default: m.RfqDetailPage })));
const QuotesPage = lazy(() => import("../pages/procurement/sourcing/QuotesPage").then((m) => ({ default: m.QuotesPage })));
const QuoteUploadPage = lazy(() => import("../pages/procurement/sourcing/QuoteUploadPage").then((m) => ({ default: m.QuoteUploadPage })));
const QuoteDetailPage = lazy(() => import("../pages/procurement/sourcing/QuoteDetailPage").then((m) => ({ default: m.QuoteDetailPage })));
const ComparePage = lazy(() => import("../pages/procurement/sourcing/ComparePage").then((m) => ({ default: m.ComparePage })));
const ApprovalsPage = lazy(() => import("../pages/procurement/orders/ApprovalsPage").then((m) => ({ default: m.ApprovalsPage })));
const ApprovalDetailPage = lazy(() => import("../pages/procurement/orders/ApprovalDetailPage").then((m) => ({ default: m.ApprovalDetailPage })));
const OrdersPage = lazy(() => import("../pages/procurement/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })));
const OrderDetailPage = lazy(() => import("../pages/procurement/orders/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })));
const ReceiptsPage = lazy(() => import("../pages/procurement/orders/ReceiptsPage").then((m) => ({ default: m.ReceiptsPage })));
const ReceiptDetailPage = lazy(() => import("../pages/procurement/orders/ReceiptDetailPage").then((m) => ({ default: m.ReceiptDetailPage })));
const InventoryPage = lazy(() => import("../pages/procurement/orders/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const PaymentsPage = lazy(() => import("../pages/procurement/orders/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const PaymentDetailPage = lazy(() => import("../pages/procurement/orders/PaymentDetailPage").then((m) => ({ default: m.PaymentDetailPage })));
const VendorsPage = lazy(() => import("../pages/procurement/orders/VendorsPage").then((m) => ({ default: m.VendorsPage })));
const VendorDetailPage = lazy(() => import("../pages/procurement/orders/VendorDetailPage").then((m) => ({ default: m.VendorDetailPage })));
const VendorNewPage = lazy(() => import("../pages/procurement/orders/VendorNewPage").then((m) => ({ default: m.VendorNewPage })));
const BudgetPage = lazy(() => import("../pages/procurement/orders/BudgetPage").then((m) => ({ default: m.BudgetPage })));

const PmOverviewPage = lazy(() => import("../pages/pm/schedule/PmOverviewPage").then((m) => ({ default: m.PmOverviewPage })));
const ProgrammePage = lazy(() => import("../pages/pm/schedule/ProgrammePage").then((m) => ({ default: m.ProgrammePage })));
const WbsPage = lazy(() => import("../pages/pm/schedule/WbsPage").then((m) => ({ default: m.WbsPage })));
const MilestonesPage = lazy(() => import("../pages/pm/schedule/MilestonesPage").then((m) => ({ default: m.MilestonesPage })));
const CriticalPathPage = lazy(() => import("../pages/pm/schedule/CriticalPathPage").then((m) => ({ default: m.CriticalPathPage })));
const DependenciesPage = lazy(() => import("../pages/pm/schedule/DependenciesPage").then((m) => ({ default: m.DependenciesPage })));
const CalendarPage = lazy(() => import("../pages/pm/schedule/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const FinishRiskPage = lazy(() => import("../pages/pm/schedule/FinishRiskPage").then((m) => ({ default: m.FinishRiskPage })));
const DelaysPage = lazy(() => import("../pages/pm/control/DelaysPage").then((m) => ({ default: m.DelaysPage })));
const LivePage = lazy(() => import("../pages/pm/control/LivePage").then((m) => ({ default: m.LivePage })));
const RecoveryPage = lazy(() => import("../pages/pm/control/RecoveryPage").then((m) => ({ default: m.RecoveryPage })));
const HealthPage = lazy(() => import("../pages/pm/control/HealthPage").then((m) => ({ default: m.HealthPage })));
const DailyReportsPage = lazy(() => import("../pages/pm/control/DailyReportsPage").then((m) => ({ default: m.DailyReportsPage })));
const RfisPage = lazy(() => import("../pages/pm/records/RfisPage").then((m) => ({ default: m.RfisPage })));
const RfiDetailPage = lazy(() => import("../pages/pm/records/RfiDetailPage").then((m) => ({ default: m.RfiDetailPage })));
const ChangesPage = lazy(() => import("../pages/pm/records/ChangesPage").then((m) => ({ default: m.ChangesPage })));
const ChangeDetailPage = lazy(() => import("../pages/pm/records/ChangeDetailPage").then((m) => ({ default: m.ChangeDetailPage })));
const InspectionsPage = lazy(() => import("../pages/pm/records/InspectionsPage").then((m) => ({ default: m.InspectionsPage })));
const InspectionDetailPage = lazy(() => import("../pages/pm/records/InspectionDetailPage").then((m) => ({ default: m.InspectionDetailPage })));
const BillingPage = lazy(() => import("../pages/pm/records/BillingPage").then((m) => ({ default: m.BillingPage })));
const IpcDetailPage = lazy(() => import("../pages/pm/records/IpcDetailPage").then((m) => ({ default: m.IpcDetailPage })));
const PartiesPage = lazy(() => import("../pages/pm/records/PartiesPage").then((m) => ({ default: m.PartiesPage })));
const SubcontractorsPage = lazy(() => import("../pages/pm/records/SubcontractorsPage").then((m) => ({ default: m.SubcontractorsPage })));

const PlanningPage = lazy(() => import("../pages/pm/planning/PlanningPage").then((m) => ({ default: m.PlanningPage })));
const ProgressTrackingPage = lazy(() => import("../pages/pm/progress/ProgressTrackingPage").then((m) => ({ default: m.ProgressTrackingPage })));
const LookaheadPage = lazy(() => import("../pages/pm/progress/LookaheadPage").then((m) => ({ default: m.LookaheadPage })));
const SubmittalsPage = lazy(() => import("../pages/pm/progress/SubmittalsPage").then((m) => ({ default: m.SubmittalsPage })));
const SubmittalDetailPage = lazy(() => import("../pages/pm/progress/SubmittalDetailPage").then((m) => ({ default: m.SubmittalDetailPage })));
const EquipmentPage = lazy(() => import("../pages/pm/site/EquipmentPage").then((m) => ({ default: m.EquipmentPage })));
const WorkforcePage = lazy(() => import("../pages/pm/site/WorkforcePage").then((m) => ({ default: m.WorkforcePage })));
const SafetyPage = lazy(() => import("../pages/pm/site/SafetyPage").then((m) => ({ default: m.SafetyPage })));
const InvoicesPage = lazy(() => import("../pages/procurement/money/InvoicesPage").then((m) => ({ default: m.InvoicesPage })));
const InvoiceDetailPage = lazy(() => import("../pages/procurement/money/InvoiceDetailPage").then((m) => ({ default: m.InvoiceDetailPage })));
const InvoiceInboxPage = lazy(() => import("../pages/procurement/money/InvoiceInboxPage").then((m) => ({ default: m.InvoiceInboxPage })));
const PayRunPage = lazy(() => import("../pages/procurement/money/PayRunPage").then((m) => ({ default: m.PayRunPage })));
const SchedulePage = lazy(() => import("../pages/procurement/plan/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const DeliveriesPage = lazy(() => import("../pages/procurement/plan/DeliveriesPage").then((m) => ({ default: m.DeliveriesPage })));
const AnalyticsPage = lazy(() => import("../pages/procurement/plan/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const NewOrderPage = lazy(() => import("../pages/procurement/purchasing/NewOrderPage").then((m) => ({ default: m.NewOrderPage })));
const AgreementsPage = lazy(() => import("../pages/procurement/purchasing/AgreementsPage").then((m) => ({ default: m.AgreementsPage })));
const AgreementDetailPage = lazy(() => import("../pages/procurement/purchasing/AgreementDetailPage").then((m) => ({ default: m.AgreementDetailPage })));
const CataloguePage = lazy(() => import("../pages/procurement/purchasing/CataloguePage").then((m) => ({ default: m.CataloguePage })));
const MaterialDetailPage = lazy(() => import("../pages/procurement/purchasing/MaterialDetailPage").then((m) => ({ default: m.MaterialDetailPage })));
const OnboardingPage = lazy(() => import("../pages/procurement/purchasing/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));

function RequireBill({ children }: { children: ReactNode }) {
  const generated = useApp((s) => s.generated);
  return generated ? <>{children}</> : <Navigate to={`${P}/generate`} replace />;
}

const Loading = () => <PageSkeleton />;
const r = (path: string, el: ReactNode) => (
  <Route key={path} path={`${P}/${path}`} element={<RequireBill><Suspense fallback={<Loading />}>{el}</Suspense></RequireBill>} />
);

/** Routes of the Project Management and Procurement modules (rendered inside the Shell layout). */
export function opsRoutes() {
  return [
    r("procurement", <ProcDashboardPage />),
    r("procurement/requests", <RequestsPage />),
    r("procurement/requests/new", <RequestNewPage />),
    r("procurement/requests/:id", <RequestDetailPage />),
    r("procurement/rfqs", <RfqBoardPage />),
    r("procurement/rfqs/new", <RfqNewPage />),
    r("procurement/rfqs/:id", <RfqDetailPage />),
    r("procurement/quotes", <QuotesPage />),
    r("procurement/quotes/upload", <QuoteUploadPage />),
    r("procurement/quotes/:id", <QuoteDetailPage />),
    r("procurement/compare", <ComparePage />),
    r("procurement/approvals", <ApprovalsPage />),
    r("procurement/approvals/:id", <ApprovalDetailPage />),
    r("procurement/orders", <OrdersPage />),
    r("procurement/orders/:id", <OrderDetailPage />),
    r("procurement/receipts", <ReceiptsPage />),
    r("procurement/receipts/:id", <ReceiptDetailPage />),
    r("procurement/inventory", <InventoryPage />),
    // Pages with no real data source behind them are not offered: they lead home.
    <Route key="hide-exceptions" path={`${P}/procurement/exceptions`} element={<Navigate to={`${P}/procurement`} replace />} />,
    r("procurement/payments", <PaymentsPage />),
    r("procurement/payments/:id", <PaymentDetailPage />),
    r("procurement/vendors", <VendorsPage />),
    r("procurement/vendors/new", <VendorNewPage />),
    r("procurement/vendors/:id", <VendorDetailPage />),
    r("procurement/budget", <BudgetPage />),
    r("procurement/schedule", <SchedulePage />),
    r("procurement/deliveries", <DeliveriesPage />),
    <Route key="hide-forecast" path={`${P}/procurement/forecast`} element={<Navigate to={`${P}/procurement`} replace />} />,
    r("procurement/analytics", <AnalyticsPage />),
    r("procurement/orders/new", <NewOrderPage />),
    r("procurement/agreements", <AgreementsPage />),
    r("procurement/agreements/:id", <AgreementDetailPage />),
    r("procurement/catalogue", <CataloguePage />),
    r("procurement/catalogue/:key", <MaterialDetailPage />),
    r("procurement/vendors/onboarding", <OnboardingPage />),
    r("procurement/invoices", <InvoicesPage />),
    r("procurement/invoices/inbox", <InvoiceInboxPage />),
    r("procurement/invoices/:id", <InvoiceDetailPage />),
    r("procurement/pay-run", <PayRunPage />),

    r("pm", <PmOverviewPage />),
    r("pm/programme", <ProgrammePage />),
    r("pm/wbs", <WbsPage />),
    r("pm/milestones", <MilestonesPage />),
    r("pm/critical-path", <CriticalPathPage />),
    r("pm/dependencies", <DependenciesPage />),
    r("pm/calendar", <CalendarPage />),
    r("pm/finish-risk", <FinishRiskPage />),
    r("pm/delays", <DelaysPage />),
    r("pm/live", <LivePage />),
    r("pm/recovery", <RecoveryPage />),
    r("pm/health", <HealthPage />),
    <Route key="hide-progress" path={`${P}/pm/progress`} element={<Navigate to={`${P}/pm`} replace />} />,
    r("pm/daily-reports", <DailyReportsPage />),
    r("pm/daily-reports/:id", <DailyReportsPage />),
    <Route key="hide-ai" path={`${P}/pm/ai-scheduling`} element={<Navigate to={`${P}/pm`} replace />} />,
    r("pm/rfis", <RfisPage />),
    r("pm/rfis/:id", <RfiDetailPage />),
    r("pm/changes", <ChangesPage />),
    r("pm/changes/:id", <ChangeDetailPage />),
    r("pm/inspections", <InspectionsPage />),
    r("pm/inspections/:id", <InspectionDetailPage />),
    r("pm/billing", <BillingPage />),
    r("pm/billing/:id", <IpcDetailPage />),
    r("pm/parties", <PartiesPage />),
    r("pm/subcontractors", <SubcontractorsPage />),
    r("pm/planning", <PlanningPage />),
    r("pm/planning/:tab", <PlanningPage />),
    r("pm/progress-tracking", <ProgressTrackingPage />),
    r("pm/lookahead", <LookaheadPage />),
    r("pm/submittals", <SubmittalsPage />),
    r("pm/submittals/:id", <SubmittalDetailPage />),
    r("pm/equipment", <EquipmentPage />),
    r("pm/workforce", <WorkforcePage />),
    r("pm/safety", <SafetyPage />),
  ];
}
