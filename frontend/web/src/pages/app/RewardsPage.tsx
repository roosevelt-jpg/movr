import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const EARN_ICONS: Record<string, string> = {
  car: '🚗',
  bag: '🛍',
  people: '👥',
  box: '📦',
};
const AVATAR_BG = ['#F97316', '#71717A', '#8E2DE2', '#3B82F6'];

/** Rewards + Leaderboard (mockup). */
export default function RewardsPage() {
  const [data, setData] = useState<any>({
    points: 850,
    tierLabel: 'Gold Tier',
    nextTier: 'Platinum',
    pointsAway: 150,
    currentTierMin: 500,
    nextTierMin: 1000,
    progress: 0.7,
    earnCards: [
      { id: 'ride', label: 'Ride', subtitle: '+10 pts per ride', icon: 'car' },
      { id: 'shop', label: 'Shop', subtitle: '+5 pts per order', icon: 'bag' },
      { id: 'refer', label: 'Refer Friends', subtitle: '+50 pts per referral', icon: 'people' },
      { id: 'deliver', label: 'Deliver', subtitle: '+8 pts per parcel', icon: 'box' },
    ],
    leaderboard: [
      { rank: 1, name: 'Olumide Adebayo', initials: 'OA', points: 2340 },
      { rank: 2, name: 'Chioma Ferreira', initials: 'CF', points: 1980 },
      { rank: 7, name: 'You', initials: 'KA', points: 850, isYou: true },
    ],
  });

  useEffect(() => {
    fetch(`${API}/points/rewards-hub`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData((d: any) => ({ ...d, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const progress = Math.min(1, Math.max(0.08, Number(data.progress || 0.7)));

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-3xl font-extrabold">Rewards</h1>
        <span className="rounded-full border border-amber-700 bg-stone-900 px-3 py-1 text-sm font-bold text-amber-400">
          🏆 {data.tierLabel || 'Gold Tier'}
        </span>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-4 mb-5">
        <div className="flex justify-between">
          <p className="text-3xl font-extrabold">{Number(data.points || 0).toLocaleString()} pts</p>
          <div className="text-right">
            <p className="text-sm text-zinc-400">Next: {data.nextTier || 'Platinum'}</p>
            <p className="text-purple-400 font-bold text-sm">
              {Number(data.pointsAway || 0).toLocaleString()} pts away
            </p>
          </div>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 mt-4 overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mt-2">
          <span>Gold ({Number(data.currentTierMin || 500)})</span>
          <span>Platinum ({Number(data.nextTierMin || 1000)})</span>
        </div>
      </div>

      <h2 className="text-lg font-extrabold mb-3">Earn Points</h2>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {(data.earnCards || []).map((c: any) => (
          <Link
            key={c.id}
            to={c.id === 'refer' ? '/refer' : '#'}
            className="rounded-2xl bg-zinc-900 p-3 block"
          >
            <p className="text-xl mb-2">{EARN_ICONS[c.icon] || '✨'}</p>
            <p className="font-bold">{c.label}</p>
            <p className="text-xs text-purple-400 mt-1">{c.subtitle}</p>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-extrabold mb-3">Leaderboard</h2>
      <ul className="space-y-2">
        {(data.leaderboard || []).map((r: any, i: number) => (
          <li
            key={`${r.rank}-${r.name}`}
            className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${
              r.isYou ? 'border border-purple-500 bg-purple-500/10' : ''
            }`}
          >
            <span
              className={`w-7 font-extrabold ${
                r.rank === 1 ? 'text-amber-400' : r.isYou ? 'text-purple-400' : 'text-zinc-400'
              }`}
            >
              {r.rank}
            </span>
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold"
              style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
            >
              {r.initials}
            </span>
            <span className="flex-1 font-semibold">{r.isYou ? 'You' : r.name}</span>
            <span
              className={`font-extrabold ${
                r.rank === 1 ? 'text-amber-400' : r.isYou ? 'text-purple-400' : ''
              }`}
            >
              {Number(r.points || 0).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
