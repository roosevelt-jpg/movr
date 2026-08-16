import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

const SERVICES = [
  {
    id: 'ride',
    to: '/rides',
    icon: '🚗',
    title: 'Ride',
    sub: 'Compare options and book a fair fare',
  },
  {
    id: 'shop',
    to: '/shops',
    icon: '🛍️',
    title: 'Shop',
    sub: 'Local stores delivered to your door',
  },
  {
    id: 'parcel',
    to: '/parcel',
    icon: '📦',
    title: 'Parcel',
    sub: 'Send a package across town today',
  },
  {
    id: 'rentals',
    to: '/rentals/start',
    icon: '🔑',
    title: 'Rentals',
    sub: 'Self-drive or chauffeur for the day',
  },
] as const;

/** Logged-in app home — pick Ride, Shop, Parcel, or Rentals to start. */
const AppHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const first = user?.firstName || 'there';

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="text-lg font-bold tracking-tight sm:text-xl">Movr</div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="h-10 w-10 rounded-full bg-[#1A1A1A] border border-[#2A2A2A]"
          title={user?.firstName || 'Profile'}
        />
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16">
        <p className="text-zinc-400 text-sm">Welcome back</p>
        <h1 className="text-3xl font-extrabold mt-1 mb-2">Hi, {first}</h1>
        <p className="text-zinc-400 mb-8">Choose how you want to move today.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SERVICES.map((s) => (
            <Link
              key={s.id}
              to={s.to}
              className="rounded-3xl bg-[#141414] border border-[#2A2A2A] p-5 hover:border-purple-500/60 transition-colors"
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <h2 className="text-xl font-bold">{s.title}</h2>
              <p className="text-sm text-zinc-400 mt-1">{s.sub}</p>
              <p className="text-purple-400 font-semibold text-sm mt-4">Get started →</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AppHomePage;
