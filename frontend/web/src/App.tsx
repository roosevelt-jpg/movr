// frontend/web/src/App.tsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from './theme/ThemeProvider';

import { useAuthStore } from './store/auth.store';

import SiteChrome from './layouts/SiteChrome';
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OtpVerifyPage from './pages/auth/OtpVerifyPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

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
import EditProfilePage from './pages/app/EditProfilePage';
import RideRatingPage from './pages/app/RideRatingPage';

import LandingPage from './pages/public/LandingPage';
import NotFoundPage from './pages/public/NotFoundPage';

import MerchantLoginPage from './pages/merchant/MerchantLoginPage';
import MerchantOnboardingPage from './pages/merchant/MerchantOnboardingPage';
import MerchantDashboardPage from './pages/merchant/MerchantDashboardPage';
import MerchantStoreEditorPage from './pages/merchant/MerchantStoreEditorPage';
import MerchantProductsPage from './pages/merchant/MerchantProductsPage';
import MerchantAnalyticsPage from './pages/merchant/MerchantAnalyticsPage';
import MerchantPayoutsPage from './pages/merchant/MerchantPayoutsPage';
import MerchantStakingPage from './pages/merchant/MerchantStakingPage';
import MerchantLandingPage from './pages/public/MerchantLandingPage';
import DriverLandingPage from './pages/public/DriverLandingPage';
import DownloadAppPage from './pages/public/DownloadAppPage';
import DynamicCmsPage from './pages/public/DynamicCmsPage';
import AboutPage from './pages/public/AboutPage';
import TermsPage from './pages/public/TermsPage';
import HelpCentrePage from './pages/public/HelpCentrePage';
import HelpArticlePage from './pages/public/HelpArticlePage';
import NoConnectionPage from './pages/public/NoConnectionPage';
import ClaimTransferPage from './pages/public/ClaimTransferPage';
import OnboardingIntroPage from './pages/public/OnboardingIntroPage';
import TripSharePage from './pages/public/TripSharePage';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const OfflineGate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const goOffline = () => {
      if (location.pathname !== '/offline') {
        navigate('/offline', { replace: false, state: { from: location.pathname } });
      }
    };
    const goOnline = () => {
      if (location.pathname === '/offline') {
        navigate(-1);
      }
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (!navigator.onLine && location.pathname !== '/offline') goOffline();
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [location.pathname, navigate]);

  return null;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <OfflineGate />
          <Routes>
            {/* Every page inherits global header + footer */}
            <Route element={<SiteChrome />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/merchants" element={<MerchantLandingPage />} />
              <Route path="/for-merchants" element={<MerchantLandingPage />} />
              <Route path="/drivers" element={<DriverLandingPage />} />
              <Route path="/for-drivers" element={<DriverLandingPage />} />
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
              <Route path="/trip/:token" element={<TripSharePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/features" element={<LandingPage />} />
              <Route path="/contact" element={<LandingPage />} />
              <Route path="/pages/:slug" element={<DynamicCmsPage />} />

              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/verify-otp" element={<OtpVerifyPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

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
                <Route path="/profile/edit" element={<EditProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/notifications" element={<NotificationPrefsPage />} />
                <Route path="/support" element={<SupportChatPage />} />
                <Route path="/bot" element={<MovrBotPage />} />
                <Route path="/channels/bot" element={<MovrBotPage />} />
              </Route>

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

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
