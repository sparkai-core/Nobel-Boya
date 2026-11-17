import { Navigate, Route, Routes } from "react-router-dom";
import { VpShell } from "./VpShell";
import { VpDashboard } from "./DashboardPage";
import { VpRfqInbox } from "./RfqInboxPage";
import { VpRfqDetail } from "./RfqDetailPage";
import { VpQuotes } from "./QuotesPage";
import { VpOrders } from "./OrdersPage";
import { VpOrderDetail } from "./OrderDetailPage";
import { VpDeliveries } from "./DeliveriesPage";
import { VpPayments } from "./PaymentsPage";
import { VpProfile } from "./ProfilePage";
import { VpInvoices } from "./InvoicesPage";
import { VpDocuments } from "./DocumentsPage";
import { VpAccept } from "./AcceptPage";

/**
 * Vendor portal: its own shell and routes under /vendor/*. No login: it opens as the vendor in the demo switcher.
 * The invite page (/vendor/accept) stands on its own, before the vendor is inside the portal.
 */
export function VendorPortal() {
  return (
    <Routes>
      <Route path="accept" element={<VpAccept />} />
      <Route path="*" element={<PortalPages />} />
    </Routes>
  );
}

function PortalPages() {
  return (
    <VpShell>
      <Routes>
        <Route index element={<VpDashboard />} />
        <Route path="rfqs" element={<VpRfqInbox />} />
        <Route path="rfqs/:id" element={<VpRfqDetail />} />
        <Route path="quotes" element={<VpQuotes />} />
        <Route path="orders" element={<VpOrders />} />
        <Route path="orders/:id" element={<VpOrderDetail />} />
        <Route path="deliveries" element={<VpDeliveries />} />
        <Route path="payments" element={<VpPayments />} />
        <Route path="invoices" element={<VpInvoices />} />
        <Route path="documents" element={<VpDocuments />} />
        <Route path="profile" element={<VpProfile />} />
        <Route path="*" element={<Navigate to="/vendor" replace />} />
      </Routes>
    </VpShell>
  );
}
