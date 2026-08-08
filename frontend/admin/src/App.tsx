import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './theme/ThemeProvider';
import AdminLiveMapPage from './pages/AdminLiveMapPage';
import PricingEnginePage from './pages/PricingEnginePage';
import FinanceDashboardPage from './pages/FinanceDashboardPage';
import IdentityLinkPage from './pages/IdentityLinkPage';
import IntegrationsHubPage from './pages/IntegrationsHubPage';
import VehiclePricingPage from './pages/VehiclePricingPage';
import RewardsRulesPage from './pages/RewardsRulesPage';
import PaymentProvidersPage from './pages/PaymentProvidersPage';
import ChannelFunnelPage from './pages/ChannelFunnelPage';
import UsersListPage from './pages/UsersListPage';
import RideOpsPage from './pages/RideOpsPage';
import RideManagementPage from './pages/RideManagementPage';
import OrderOpsPage from './pages/OrderOpsPage';
import AuditLogPage from './pages/AuditLogPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import KycQueuePage from './pages/KycQueuePage';
import SmsChannelPage from './pages/SmsChannelPage';
import FeatureFlagsPage from './pages/FeatureFlagsPage';
import AirdropsPage from './pages/AirdropsPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import CmsPagesPage from './pages/CmsPagesPage';
import MarketplaceCatalogPage from './pages/MarketplaceCatalogPage';
import MerchantsOversightPage from './pages/MerchantsOversightPage';
import DriversManagementPage from './pages/DriversManagementPage';
import DriverProfilePage from './pages/DriverProfilePage';
import CustomersManagementPage from './pages/CustomersManagementPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import TokensManagementPage from './pages/TokensManagementPage';
import MarketplaceManagementPage from './pages/MarketplaceManagementPage';
import DispatcherPanelPage from './pages/DispatcherPanelPage';
import TrustOpsPage from './pages/TrustOpsPage';
import PromotionsPage from './pages/PromotionsPage';
import BroadcastCenterPage from './pages/BroadcastCenterPage';
import PlatformAnalyticsPage from './pages/PlatformAnalyticsPage';
import SubscriptionFeesPage from './pages/SubscriptionFeesPage';
import TeamPage from './pages/TeamPage';
import InviteAcceptPage from './pages/InviteAcceptPage';

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem('movr_admin_token');
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Admin ops console — mockup routes + existing tools. */
const App: React.FC = () => {
  return (
    <ThemeProvider>
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
        <Route
          path="/settings"
          element={
            <RequireAdmin>
              <AdminSettingsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/team"
          element={
            <RequireAdmin>
              <TeamPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <Navigate to="/overview" replace />
            </RequireAdmin>
          }
        />
        <Route
          path="/overview"
          element={
            <RequireAdmin>
              <AdminOverviewPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/cms"
          element={
            <RequireAdmin>
              <CmsPagesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/marketplace"
          element={
            <RequireAdmin>
              <MarketplaceCatalogPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/marketplace-mgmt"
          element={
            <RequireAdmin>
              <MarketplaceManagementPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/customers/:id"
          element={
            <RequireAdmin>
              <CustomerProfilePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/customers"
          element={
            <RequireAdmin>
              <CustomersManagementPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/promotions"
          element={
            <RequireAdmin>
              <PromotionsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/tokens"
          element={
            <RequireAdmin>
              <TokensManagementPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/dispatch"
          element={
            <RequireAdmin>
              <DispatcherPanelPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/trust"
          element={
            <RequireAdmin>
              <TrustOpsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAdmin>
              <PlatformAnalyticsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/broadcasts"
          element={
            <RequireAdmin>
              <BroadcastCenterPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/live-map"
          element={
            <RequireAdmin>
              <AdminLiveMapPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/map"
          element={
            <RequireAdmin>
              <AdminLiveMapPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/pricing"
          element={
            <RequireAdmin>
              <PricingEnginePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/subscription-fees"
          element={
            <RequireAdmin>
              <SubscriptionFeesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/finance"
          element={
            <RequireAdmin>
              <FinanceDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <UsersListPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/drivers/:id"
          element={
            <RequireAdmin>
              <DriverProfilePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/drivers"
          element={
            <RequireAdmin>
              <DriversManagementPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/merchants"
          element={
            <RequireAdmin>
              <MerchantsOversightPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/kyc-queue"
          element={
            <RequireAdmin>
              <KycQueuePage />
            </RequireAdmin>
          }
        />
        <Route
          path="/rides/:id"
          element={
            <RequireAdmin>
              <RideOpsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/rides"
          element={
            <RequireAdmin>
              <RideManagementPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAdmin>
              <OrderOpsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAdmin>
              <OrderOpsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/identity"
          element={
            <RequireAdmin>
              <IdentityLinkPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/feature-flags"
          element={
            <RequireAdmin>
              <FeatureFlagsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/airdrops"
          element={
            <RequireAdmin>
              <AirdropsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/integrations"
          element={
            <RequireAdmin>
              <IntegrationsHubPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/vehicles"
          element={
            <RequireAdmin>
              <VehiclePricingPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireAdmin>
              <RewardsRulesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/payments"
          element={
            <RequireAdmin>
              <PaymentProvidersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireAdmin>
              <AuditLogPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/channels"
          element={
            <RequireAdmin>
              <ChannelFunnelPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/sms"
          element={
            <RequireAdmin>
              <SmsChannelPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
