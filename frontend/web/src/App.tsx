// frontend/web/src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';

// Stores
import { useAuthStore } from './store/auth.store';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OtpVerifyPage from './pages/auth/OtpVerifyPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// App Pages
import DashboardPage from './pages/app/DashboardPage';
import RideDetailPage from './pages/app/RideDetailPage';
import ActiveRidePage from './pages/app/ActiveRidePage';
import MarketplacePage from './pages/app/MarketplacePage';
import StorePage from './pages/app/StorePage';
import CartPage from './pages/app/CartPage';
import WalletPage from './pages/app/WalletPage';
import TokenPage from './pages/app/TokenPage';
import StakingPage from './pages/app/StakingPage';
import ClaimPage from './pages/app/ClaimPage';
import HistoryPage from './pages/app/HistoryPage';
import ProfilePage from './pages/app/ProfilePage';
import SettingsPage from './pages/app/SettingsPage';
import RideRatingPage from './pages/app/RideRatingPage';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Merchant portal
import MerchantLoginPage from './pages/merchant/MerchantLoginPage';
import MerchantOnboardingPage from './pages/merchant/MerchantOnboardingPage';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage';
import MerchantStoreEditorPage from './pages/merchant/MerchantStoreEditorPage';
import MerchantProductsPage from './pages/merchant/MerchantProductsPage';
import MerchantAnalyticsPage from './pages/merchant/MerchantAnalyticsPage';
import MerchantPayoutsPage from './pages/merchant/MerchantPayoutsPage';
import MerchantStakingPage from './pages/merchant/MerchantStakingPage';
import MerchantLandingPage from './pages/public/MerchantLandingPage';
import DownloadAppPage from './pages/public/DownloadAppPage';
import TermsPage from './pages/public/TermsPage';
import HelpCentrePage from './pages/public/HelpCentrePage';
import HelpArticlePage from './pages/public/HelpArticlePage';
import NoConnectionPage from './pages/public/NoConnectionPage';
import ClaimTransferPage from './pages/public/ClaimTransferPage';
import OnboardingIntroPage from './pages/public/OnboardingIntroPage';
import MerchantOrderDetailPage from './pages/merchant/MerchantOrderDetailPage';
import MerchantSettingsPage from './pages/merchant/MerchantSettingsPage';
import WalletTopUpPage from './pages/app/WalletTopUpPage';
import RedeemPointsPage from './pages/app/RedeemPointsPage';
import NotificationPrefsPage from './pages/app/NotificationPrefsPage';
import SupportChatPage from './pages/app/SupportChatPage';
import MovrBotPage from './pages/app/MovrBotPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/merchants" element={<MerchantLandingPage />} />
          <Route path="/for-merchants" element={<MerchantLandingPage />} />
          <Route path="/download" element={<DownloadAppPage />} />
          <Route path="/get-app" element={<DownloadAppPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<TermsPage />} />
          <Route path="/help" element={<HelpCentrePage />} />
          <Route path="/help/:topic" element={<HelpArticlePage />} />
          <Route path="/offline" element={<NoConnectionPage />} />
          <Route path="/onboarding" element={<OnboardingIntroPage />} />
          <Route path="/claim-transfer" element={<ClaimTransferPage />} />
          <Route path="/claim-transfer/:code" element={<ClaimTransferPage />} />
          <Route path="/t/:code" element={<ClaimTransferPage />} />
          <Route path="/about" element={<LandingPage />} />
          <Route path="/features" element={<LandingPage />} />
          <Route path="/contact" element={<LandingPage />} />

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-otp" element={<OtpVerifyPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          {/* Protected App Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ride/:id" element={<RideDetailPage />} />
            <Route path="/ride/active/:id" element={<ActiveRidePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/store/:id" element={<StorePage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/wallet/topup" element={<WalletTopUpPage />} />
            <Route path="/wallet/redeem" element={<RedeemPointsPage />} />
            <Route path="/points/redeem" element={<RedeemPointsPage />} />
            <Route path="/token" element={<TokenPage />} />
            <Route path="/staking" element={<StakingPage />} />
            <Route path="/claim" element={<ClaimPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/ride/:id/rate" element={<RideRatingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/notifications" element={<NotificationPrefsPage />} />
            <Route path="/support" element={<SupportChatPage />} />
            <Route path="/bot" element={<MovrBotPage />} />
            <Route path="/channels/bot" element={<MovrBotPage />} />
          </Route>

          {/* Merchant portal */}
          <Route path="/merchant/login" element={<MerchantLoginPage />} />
          <Route path="/merchant/onboarding" element={<MerchantOnboardingPage />} />
          <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />
          <Route path="/merchant/orders/:id" element={<MerchantOrderDetailPage />} />
          <Route path="/merchant/store" element={<MerchantStoreEditorPage />} />
          <Route path="/merchant/settings" element={<MerchantSettingsPage />} />
          <Route path="/merchant/products" element={<MerchantProductsPage />} />
          <Route path="/merchant/analytics" element={<MerchantAnalyticsPage />} />
          <Route path="/merchant/payouts" element={<MerchantPayoutsPage />} />
          <Route path="/merchant/staking" element={<MerchantStakingPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
};

export default App;
