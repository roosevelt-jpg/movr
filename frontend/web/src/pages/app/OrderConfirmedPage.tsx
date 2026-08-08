import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Order Confirmed. */
export default function OrderConfirmedPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [arrival, setArrival] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Order not found');
      setLoading(false);
      return;
    }
    fetch(`${API}/orders/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const o = j?.data;
        if (!o) return;
        if (o.store_name) setMerchant(o.store_name);
        if (o.order_ref || o.public_ref) setOrderRef(o.order_ref || o.public_ref);
        if (o.estimated_arrival) setArrival(o.estimated_arrival);
        if (o.time_left) setTimeLeft(o.time_left);
      })
      .catch(() => setError('Could not load order'))
      .finally(() => setLoading(false));
  }, [id]);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(orderRef);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-6 text-center" data-force-dark>
      {loading ? <p className="text-zinc-400">Loading order…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
      {!loading && !error ? (
      <>
      <div className="relative w-24 h-24 mx-auto mb-5">
        <div className="absolute inset-0 rounded-full bg-green-500/20" />
        <div className="absolute inset-2 rounded-full bg-green-500/30" />
        <div className="absolute inset-4 rounded-full bg-green-500 flex items-center justify-center text-3xl font-black text-black">
          ✓
        </div>
      </div>
      <h1 className="text-2xl font-extrabold">Order Confirmed!</h1>
      <p className="text-zinc-400 mt-2 mb-5">{merchant} is preparing your order</p>

      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 mb-8"
      >
        <span className="text-zinc-400">
          Order # <strong className="text-white">{orderRef}</strong>
        </span>
        <span>📋</span>
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-1 mb-6">
        {[
          { label: 'Confirmed', icon: '✓', on: true },
          { label: 'Preparing', icon: '🍳', on: true },
          { label: 'On the way', icon: '🛵', on: false },
          { label: 'Delivered', icon: '🏠', on: false },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                s.on ? 'bg-purple-500' : 'bg-zinc-800'
              }`}
            >
              {s.icon}
            </div>
            <p className={`text-[11px] mt-2 ${s.on ? 'text-white' : 'text-zinc-600'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex rounded-2xl bg-[#1E1033] p-4 mb-8 text-left">
        <div className="flex-1">
          <p className="text-xs text-zinc-400">Estimated arrival</p>
          <p className="text-xl font-extrabold mt-1">{arrival}</p>
        </div>
        <div className="flex-1 text-right">
          <p className="text-xs text-zinc-400">Time left</p>
          <p className="text-xl font-extrabold text-purple-400 mt-1">{timeLeft}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/orders/${id}`)}
        className="w-full rounded-2xl py-3.5 font-bold bg-gradient-to-r from-purple-500 to-blue-500 mb-3"
      >
        Track Order
      </button>
      <button
        type="button"
        onClick={() => navigate('/marketplace')}
        className="w-full rounded-2xl py-3.5 font-bold border border-zinc-700 mb-3"
      >
        Rate products
      </button>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="w-full rounded-2xl py-3.5 font-bold border border-zinc-700"
      >
        Back to Home
      </button>
      </>
      ) : null}
    </div>
  );
}
