import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Redeem Movr points for ride/order vouchers. */
export default function RedeemPointsPage() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [catalog, setCatalog] = useState<{ id: string; label: string; points: number }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/points/balance`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/redeem-catalog`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
    ]).then(([b, c]) => {
      if (b?.data?.balance != null) setBalance(Number(b.data.balance));
      if (Array.isArray(c?.data)) {
        setCatalog(c.data);
        if (c.data.length) setSelected(c.data[0].id);
      }
    });
  }, []);

  const choice = catalog.find((r) => r.id === selected) || null;

  const redeem = async () => {
    if (!choice) return;
    try {
      const res = await fetch(`${API}/points/redeem`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rewardId: choice.id,
          points: choice.points,
          label: choice.label,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Redeem failed');
      toast.success(`Redeemed · ${choice.points} pts`);
      if (json.data?.balance != null) setBalance(Number(json.data.balance));
      else setBalance((b) => Math.max(0, b - choice.points));
    } catch (e: any) {
      toast.error(e.message || 'Not enough points');
    }
  };

  return (
    <div className="min-h-[70vh] rounded-2xl bg-black text-white p-6 md:p-8 max-w-lg">
      <button type="button" onClick={() => navigate('/wallet')} className="text-[#A0A0A0] text-sm mb-4">
        ← Wallet
      </button>
      <h1 className="text-3xl font-bold">Redeem points</h1>
      <p className="text-[#A0A0A0] mt-2 mb-8">You have {balance.toLocaleString()} points</p>

      {catalog.length === 0 ? (
        <p className="text-[#A0A0A0] mb-8">No redeem options available right now.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {catalog.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              className={`w-full flex justify-between gap-4 rounded-xl px-4 py-4 text-left ${
                selected === r.id
                  ? 'border border-[#0055FF] bg-[#0A1224]'
                  : 'bg-[#1A1A1A] border border-[#2A2A2A]'
              }`}
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-[#8FB3FF] shrink-0">{r.points} pts</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={redeem}
        disabled={!choice}
        className="w-full rounded-full py-4 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF] disabled:opacity-40"
      >
        {choice ? `Redeem · ${choice.points} pts` : 'Redeem'}
      </button>
    </div>
  );
}
