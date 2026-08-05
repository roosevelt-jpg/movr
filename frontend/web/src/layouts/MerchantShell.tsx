import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutList,
  Package,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';

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
  const path = activePath || location.pathname;

  const signOut = () => {
    localStorage.removeItem('movr_merchant_token');
    localStorage.removeItem('movr_merchant');
    navigate('/merchant/login');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex font-[Poppins,Montserrat,sans-serif]">
      <aside className="w-56 shrink-0 border-r border-[#2A2A2A] bg-black p-4 flex flex-col">
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
                    ? 'bg-gradient-to-r from-[#6A00FF] to-[#0055FF] text-white'
                    : 'text-[#A0A0A0] hover:text-white'
                }`}
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
          <Link to="/merchant/analytics" className="block text-[#A0A0A0] text-sm px-3 pt-4 hover:text-white">
            Analytics
          </Link>
          <Link to="/merchant/store" className="block text-[#A0A0A0] text-sm px-3 hover:text-white">
            Store profile
          </Link>
          <Link to="/merchant/staking" className="block text-[#A0A0A0] text-sm px-3 hover:text-white">
            Staking
          </Link>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-6 flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] w-full"
        >
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}
