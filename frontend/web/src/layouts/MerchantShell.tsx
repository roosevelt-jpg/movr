import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutList,
  Package,
  CreditCard,
  Settings,
  LogOut,
  Moon,
  Sun,
  BarChart3,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

const NAV = [
  { to: '/merchant/dashboard', label: 'Orders', icon: LayoutList, match: ['/merchant/dashboard', '/merchant/orders'] },
  { to: '/merchant/products', label: 'Products', icon: Package, match: ['/merchant/products', '/merchant/store'] },
  { to: '/merchant/payouts', label: 'Earnings', icon: CreditCard, match: ['/merchant/payouts'] },
  { to: '/merchant/analytics', label: 'Analytics', icon: BarChart3, match: ['/merchant/analytics'] },
  { to: '/merchant/settings', label: 'Settings', icon: Settings, match: ['/merchant/settings'] },
];

/** Shared merchant portal shell matching mockup sidebar. */
export default function MerchantShell({
  children,
  activePath,
}: {
  children: React.ReactNode;
  activePath?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, setPreference } = useTheme();
  const path = activePath || location.pathname;

  const signOut = () => {
    localStorage.removeItem('movr_merchant_token');
    localStorage.removeItem('movr_merchant');
    navigate('/merchant/login');
  };

  return (
    <div className="min-h-screen bg-black text-white flex font-[Poppins,Montserrat,sans-serif]">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-black text-white p-4 flex flex-col">
        <div className="font-bold text-xl mb-8 px-2 tracking-tight">Movr</div>
        <div className="space-y-2 flex-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match.some((m) => path.startsWith(m));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-movr-gradient text-white'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
          <Link
            to="/merchant/store"
            className="block text-white/45 text-sm px-3 pt-6 hover:text-white"
          >
            Store profile
          </Link>
          <Link
            to="/merchant/staking"
            className="block text-white/45 text-sm px-3 hover:text-white"
          >
            Staking
          </Link>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-white/55 hover:text-white hover:bg-white/5 w-full"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        <header className="shrink-0 h-14 border-b border-white/10 px-6 md:px-8 flex items-center justify-end">
          <button
            type="button"
            aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={mode === 'light' ? 'Dark mode' : 'Light mode'}
            onClick={() => setPreference(mode === 'light' ? 'dark' : 'light')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/60 hover:text-white hover:bg-white/5"
          >
            {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
