import React from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const LINKS = [
  { to: '/driver', label: 'Home', exact: true },
  { to: '/driver/destination', label: 'Destination' },
  { to: '/driver/guarantee', label: 'Guarantee' },
];

/** Minimal driver web shell — earnings / destination / income floor. */
const DriverShell: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-[70vh] max-w-lg mx-auto w-full px-4 py-6 text-[var(--text,#0a0a0a)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest opacity-60">Driver</p>
          <h1 className="text-2xl font-bold tracking-tight">Movr Drive</h1>
        </div>
        <Link to="/drivers" className="text-sm opacity-70 hover:opacity-100">
          About
        </Link>
      </div>
      <nav className="flex gap-2 mb-6 border-b border-black/10 pb-3">
        {LINKS.map((l) => {
          const active = l.exact
            ? location.pathname === l.to
            : location.pathname.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                active ? 'bg-black text-white' : 'bg-black/5 hover:bg-black/10'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
};

export default DriverShell;
