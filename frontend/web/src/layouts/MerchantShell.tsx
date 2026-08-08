import React, { useState } from 'react';
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
  Menu,
  X,
  Store,
  Ticket,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

const NAV = [
  { to: '/merchant/analytics', label: 'Analytics', icon: BarChart3, match: ['/merchant/analytics'] },
  { to: '/merchant/dashboard', label: 'Orders', icon: LayoutList, match: ['/merchant/dashboard', '/merchant/orders'] },
  { to: '/merchant/setup', label: 'Setup', icon: Store, match: ['/merchant/setup'] },
  { to: '/merchant/store', label: 'My Store', icon: Store, match: ['/merchant/store'] },
  { to: '/merchant/products', label: 'Products', icon: Package, match: ['/merchant/products'] },
  { to: '/merchant/returns', label: 'Returns', icon: RotateCcw, match: ['/merchant/returns'] },
  { to: '/merchant/coupons', label: 'Coupons', icon: Ticket, match: ['/merchant/coupons'] },
  { to: '/merchant/payouts', label: 'Payouts', icon: CreditCard, match: ['/merchant/payouts'] },
  { to: '/merchant/settings', label: 'Settings', icon: Settings, match: ['/merchant/settings'] },
];

/** Responsive merchant portal shell. */
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
  const [open, setOpen] = useState(false);
  const path = activePath || location.pathname;

  const signOut = () => {
    localStorage.removeItem('movr_merchant_token');
    localStorage.removeItem('movr_merchant');
    navigate('/merchant/login');
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="space-y-1.5 flex-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.match.some((m) => path.startsWith(m));
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                active ? 'bg-movr-gradient text-white' : 'text-white/55 hover:text-white'
              }`}
            >
              <Icon size={16} /> {item.label}
            </Link>
          );
        })}
        <Link
          to="/merchant/staking"
          onClick={onNavigate}
          className="block text-white/45 text-sm px-3 pt-6 hover:text-white"
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
    </>
  );

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-black text-white flex font-[Poppins,Montserrat,sans-serif]" data-force-dark>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-white/10 bg-black p-4 flex-col">
        <div className="font-bold text-xl mb-8 px-2 tracking-tight">Movr</div>
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[min(80vw,18rem)] bg-black border-r border-white/10 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-8 px-2">
              <span className="font-bold text-xl tracking-tight">Movr</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/15"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0 bg-black">
        <header className="shrink-0 h-14 border-b border-white/10 px-4 sm:px-6 md:px-8 flex items-center justify-between gap-3">
          <button
            type="button"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="md:hidden font-semibold tracking-tight">Movr</div>
          <div className="flex-1" />
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
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
