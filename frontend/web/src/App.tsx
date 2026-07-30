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

// App Pages
import DashboardPage from './pages/app/DashboardPage';
import RideDetailPage from './pages/app/RideDetailPage';
import ActiveRidePage from './pages/app/ActiveRidePage';
import MarketplacePage from './pages/app/MarketplacePage';
import StorePage from './pages/app/StorePage';
import CartPage from './pages/app/CartPage';
import WalletPage from './pages/app/WalletPage';
import HistoryPage from './pages/app/HistoryPage';
import ProfilePage from './pages/app/ProfilePage';
import SettingsPage from './pages/app/SettingsPage';

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
          <Route path="/about" element={<LandingPage />} />
          <Route path="/features" element={<LandingPage />} />
          <Route path="/contact" element={<LandingPage />} />

          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Merchant portal */}
          <Route path="/merchant/login" element={<MerchantLoginPage />} />
          <Route path="/merchant/onboarding" element={<MerchantOnboardingPage />} />
          <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />
          <Route path="/merchant/store" element={<MerchantStoreEditorPage />} />
          <Route path="/merchant/products" element={<MerchantProductsPage />} />
          <Route path="/merchant/analytics" element={<MerchantAnalyticsPage />} />
          <Route path="/merchant/payouts" element={<MerchantPayoutsPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
};

export default App;
