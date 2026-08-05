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
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

const NAV = [
  { to: '/merchant/dashboard', label: 'Orders', icon: LayoutList },
  { to: '/merchant/products', label: 'Products', icon: Package },
  { to: '/merchant/payouts', label: 'Earnings', icon: CreditCard },
  { to: '/merchant/settings', label: 'Settings', icon: Settings },
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
    <div className="min-h-screen bg-surface text-text-primary flex font-[Poppins,Montserrat,sans-serif]">
      <aside className="w-56 shrink-0 border-r border-border bg-jet-black text-pure-white p-4 flex flex-col">
        <div className="font-bold text-xl mb-6 px-2">Movr</div>
        <div className="space-y-2 flex-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium ${
                  active
                    ? 'bg-movr-gradient text-pure-white'
                    : 'text-text-secondary hover:text-pure-white'
                }`}
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
          <Link to="/merchant/analytics" className="block text-text-secondary text-sm px-3 pt-4 hover:text-pure-white">
            Analytics
          </Link>
          <Link to="/merchant/store" className="block text-text-secondary text-sm px-3 hover:text-pure-white">
            Store profile
          </Link>
          <Link to="/merchant/staking" className="block text-text-secondary text-sm px-3 hover:text-pure-white">
            Staking
          </Link>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-text-secondary hover:text-pure-white hover:bg-surface-elevated w-full"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 h-14 border-b border-border bg-surface-elevated px-6 md:px-8 flex items-center justify-end">
          <button
            type="button"
            aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={mode === 'light' ? 'Dark mode' : 'Light mode'}
            onClick={() => setPreference(mode === 'light' ? 'dark' : 'light')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary hover:bg-surface"
          >
            {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
