import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

/** Public corporate mobility pitch — pilot form posts into verified orgs after login. */
export default function BusinessMobilityPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  return (
    <div className="bg-surface text-text-primary">
      <div className="max-w-4xl mx-auto px-4 py-16 space-y-10">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-black/50">Movr for business</p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Corporate mobility, under control.
        </h1>
        <p className="text-lg text-black/60 max-w-2xl">
          Verified vehicles, escrow until the booked car arrives, and one desk for every executive,
          guest, and site movement. Ride, shop, and parcels stay available on the same Movr
          account.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['Verified', 'See the car and chauffeur before anyone moves.'],
            ['Protected', 'Fare sits in escrow until the rider confirms the match.'],
            ['Documented', 'Who booked, who drove, which plate, where, when, what it cost.'],
          ].map(([t, b]) => (
            <div key={t} className="rounded-2xl border border-black/10 p-5">
              <p className="font-bold">{t}</p>
              <p className="text-sm text-black/60 mt-2">{b}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/verified"
            className="rounded-full bg-black text-white px-5 py-2.5 text-sm font-semibold"
          >
            Browse verified vehicles
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) navigate('/login?next=/corporate');
              else navigate('/corporate');
            }}
            className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold"
          >
            Start a 30-day pilot
          </button>
        </div>
        <form
          className="max-w-md space-y-3 rounded-2xl border border-black/10 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isAuthenticated) navigate('/login?next=/corporate');
            else navigate('/corporate');
          }}
        >
          <p className="font-bold">Register your company</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Company name"
            className="w-full rounded-xl border border-black/10 px-3 py-2"
          />
          <button type="submit" className="w-full rounded-xl bg-black text-white py-3 font-semibold">
            Continue to desk
          </button>
        </form>
      </div>
    </div>
  );
}
