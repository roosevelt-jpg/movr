import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const AuthLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-screen">
          {/* Left side - Branding */}
          <div className="hidden lg:flex flex-col justify-center space-y-8">
            <div>
              <h1 className="text-5xl font-black gradient-text mb-4">MOVR</h1>
              <p className="text-xl text-gray-600 mb-8">
                Africa's Super-App for mobility, commerce, and delivery
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                  <span className="text-gray-700">Fast & reliable ride-hailing</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                  <span className="text-gray-700">Shop from thousands of merchants</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                  <span className="text-gray-700">Secure digital wallet & payments</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">✓</span>
                  <span className="text-gray-700">Earn rewards on every transaction</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right side - Auth Forms */}
          <div className="flex justify-center">
            <div className="w-full max-w-md">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
