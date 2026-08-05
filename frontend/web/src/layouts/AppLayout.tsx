import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Menu, X, LogOut, User, Settings, Wallet, Home, ShoppingCart, Clock, HelpCircle } from 'lucide-react';

const AppLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Rides', path: '/ride/active/new', icon: ShoppingCart },
    { label: 'Marketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'Wallet', path: '/wallet', icon: Wallet },
    { label: 'Token', path: '/token', icon: Wallet },
    { label: 'Staking', path: '/staking', icon: Wallet },
    { label: 'History', path: '/history', icon: Clock },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-[#0A0A0A] border-b border-[#2A2A2A] sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#6A00FF] to-[#0055FF]">
              <span className="text-white font-black">M</span>
            </div>
            <span className="text-xl font-black text-white">MOVR</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isActive(item.path)
                    ? 'text-white bg-[#1A1A1A] border border-[#6A00FF]/50'
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-[#1A1A1A] rounded-lg border border-[#2A2A2A]">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br from-[#6A00FF] to-[#0055FF]">
                {user?.firstName?.[0] || 'U'}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{user?.firstName}</p>
                <p className="text-xs text-[#A0A0A0]">{user?.userType}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-[#FF3B5C] hover:bg-[#1A1A1A] rounded-lg font-medium transition-colors"
            >
              <LogOut size={20} />
              Logout
            </button>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-[#2A2A2A] bg-[#0A0A0A]">
            <div className="px-4 py-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isActive(item.path)
                      ? 'text-white bg-[#1A1A1A]'
                      : 'text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-[#A0A0A0] hover:text-white rounded-lg font-medium"
              >
                <Settings size={20} />
                Settings
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-[#FF3B5C] rounded-lg font-medium"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-16">
        <div className="container max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">About MOVR</h4>
              <p className="text-sm">Africa's leading super-app for mobility, commerce, and delivery.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><button className="hover:text-white transition">About</button></li>
                <li><button className="hover:text-white transition">Support</button></li>
                <li><button className="hover:text-white transition">Blog</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Policies</h4>
              <ul className="space-y-2 text-sm">
                <li><button className="hover:text-white transition">Privacy</button></li>
                <li><button className="hover:text-white transition">Terms</button></li>
                <li><button className="hover:text-white transition">Safety</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <p className="text-sm">support@movr.io</p>
              <p className="text-sm">+1 234 567 8900</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2024 MOVR. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
