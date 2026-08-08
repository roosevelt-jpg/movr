import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/** Payment Methods vault (mockup). */
export default function PaymentMethodsPage() {
  const [items, setItems] = useState<any[]>([]);

  const load = () => {
    fetch(`${API}/me/payment-instruments`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(j.data || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const defaultCard =
    items.find((i) => i.isDefault && i.type === 'card') ||
    items.find((i) => i.brand === 'visa');
  const others = items.filter((i) => i.id !== defaultCard?.id);

  const remove = async (id: string) => {
    if (!confirm('Remove this payment method?')) return;
    await fetch(`${API}/me/payment-instruments/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(() => undefined);
    setItems((list) => list.filter((x) => x.id !== id));
    toast.success('Removed');
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-5">
        <Link to="/wallet" className="text-xl">
          ←
        </Link>
        <h1 className="text-xl font-extrabold">Payment Methods</h1>
      </div>

      {defaultCard ? (
        <div className="rounded-2xl p-5 mb-4 bg-gradient-to-br from-indigo-950 to-purple-900">
          <div className="flex justify-between items-center">
            <span className="font-black tracking-widest">VISA</span>
            <span className="rounded-full bg-purple-500 px-2.5 py-0.5 text-[10px] font-extrabold">
              DEFAULT
            </span>
          </div>
          <p className="text-xl tracking-widest my-6 font-semibold">
            **** **** **** {defaultCard.lastFour}
          </p>
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-[10px] text-zinc-400 font-bold">CARD HOLDER</p>
              <p className="font-bold mt-1">{defaultCard.cardholderName || 'Kwame Asante'}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-bold">EXPIRES</p>
              <p className="font-bold mt-1">{defaultCard.expires || '08/27'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2.5 mb-5">
        {others.map((m) => {
          if (m.type === 'card' || m.brand === 'mastercard') {
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-orange-500 text-xs font-black">
                  MC
                </div>
                <div className="flex-1">
                  <p className="font-bold">•••• {m.lastFour}</p>
                  <p className="text-xs text-zinc-500">
                    Mastercard · Expires {m.expires || '03/26'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  className="text-red-400 font-bold text-sm"
                >
                  Remove
                </button>
              </div>
            );
          }
          if (m.type === 'momo' || m.brand === 'momo') {
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                  📱
                </div>
                <div className="flex-1">
                  <p className="font-bold">MTN MoMo</p>
                  <p className="text-xs text-zinc-500">{m.phone || '+234 801 234 5678'}</p>
                </div>
                <span className="rounded-full bg-green-950 text-green-400 text-xs font-bold px-2.5 py-1">
                  Active
                </span>
              </div>
            );
          }
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                🦊
              </div>
              <div className="flex-1">
                <p className="font-bold">MetaMask</p>
                <p className="text-xs text-zinc-500">
                  {m.walletAddress || '0x3a4F...9d2c'} · {m.network || 'Polygon'}
                </p>
              </div>
              <span className="rounded-full bg-green-950 text-green-400 text-xs font-bold px-2.5 py-1">
                Active
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => toast('Add card, MoMo, or crypto wallet')}
        className="w-full rounded-xl border-2 border-dashed border-purple-500 bg-white py-4 font-extrabold text-purple-600"
      >
        ＋ Add Payment Method
      </button>
    </div>
  );
}
