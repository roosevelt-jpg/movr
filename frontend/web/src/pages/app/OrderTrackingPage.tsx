import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Phone, MessageCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Live order tracking (mockup). */
export default function OrderTrackingPage() {
  const { id } = useParams();
  const [orderRef, setOrderRef] = useState('MVR-20480');
  const [statusLabel, setStatusLabel] = useState('Preparing');
  const [eta, setEta] = useState('Courier is 8 min away');
  const [courier, setCourier] = useState({
    name: 'Tunde Adeyemi',
    role: 'Movr Courier',
    rating: 4.7,
    phone: '',
  });
  const [timeline, setTimeline] = useState<any[]>([
    { key: 'confirmed', label: 'Order confirmed', done: true },
    { key: 'preparing', label: 'Restaurant preparing', icon: '🍳', active: true },
    { key: 'pickup', label: 'Courier picking up' },
    { key: 'delivered', label: 'Delivered' },
  ]);
  const [itemCount, setItemCount] = useState(2);
  const [total, setTotal] = useState(8100);
  const [currency, setCurrency] = useState('NGN');

  useEffect(() => {
    if (!id || String(id).startsWith('demo-')) return;
    fetch(`${API}/orders/${id}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const o = j?.data;
        if (!o) return;
        if (o.order_ref || o.public_ref) setOrderRef(o.order_ref || o.public_ref);
        if (o.status_label) setStatusLabel(o.status_label);
        if (o.eta_text) setEta(o.eta_text);
        if (o.courier) {
          setCourier({
            name: o.courier.name,
            role: o.courier.role || 'Movr Courier',
            rating: Number(o.courier.rating || 4.7),
            phone: o.courier.phone || '',
          });
        }
        if (Array.isArray(o.timeline)) setTimeline(o.timeline);
        setItemCount(Number(o.item_count || o.items?.length || 2));
        setTotal(Number(o.total || 8100));
        setCurrency(o.currency || 'NGN');
      })
      .catch(() => undefined);
  }, [id]);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto" data-force-dark>
      <div className="relative h-52 bg-[#0c0c12] border-b border-zinc-800">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(#2a2a35 1px, transparent 1px), linear-gradient(90deg, #2a2a35 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute left-[18%] top-[48%] w-[55%] h-0.5 bg-blue-500 -rotate-12" />
        <span className="absolute left-[16%] top-[36%] text-xl">🍔</span>
        <span className="absolute left-[46%] top-[42%] text-lg">🛵</span>
        <span className="absolute right-[18%] bottom-[28%] text-xl">📍</span>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black px-4 py-2 text-sm font-bold">
          {eta}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-zinc-400 font-semibold">Order #{orderRef}</p>
          <span className="rounded-lg border border-orange-500 text-orange-400 text-xs font-bold px-2.5 py-1">
            {statusLabel}
          </span>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-xl">🛵</div>
          <div className="flex-1">
            <p className="font-bold">{courier.name}</p>
            <p className="text-xs text-zinc-400">{courier.role}</p>
            <p className="text-xs text-amber-400 mt-1">★ {courier.rating.toFixed(1)}</p>
          </div>
          <a href={`tel:${courier.phone || ''}`} className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Phone size={16} />
          </a>
          <button type="button" className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
            <MessageCircle size={16} />
          </button>
        </div>

        <ol className="space-y-0 pl-1">
          {timeline.map((step: any, i: number) => (
            <li key={step.key} className="flex gap-3 min-h-[36px]">
              <div className="flex flex-col items-center w-5">
                <span
                  className={`mt-1 w-2.5 h-2.5 rounded-full ${
                    step.active ? 'bg-purple-500' : step.done ? 'bg-green-500' : 'bg-zinc-700'
                  }`}
                />
                {i < timeline.length - 1 ? <span className="flex-1 w-0.5 bg-zinc-800 my-1" /> : null}
              </div>
              <p
                className={`text-sm pt-0.5 ${
                  step.active ? 'text-white font-bold' : step.done ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                {step.label}
                {step.icon ? ` ${step.icon}` : ''}
              </p>
            </li>
          ))}
        </ol>

        <div className="rounded-xl bg-zinc-900 p-4 flex items-center gap-3">
          <span>🍔 🍗</span>
          <p className="flex-1 font-semibold">
            {itemCount} items · {formatCurrency(total, currency)}
          </p>
          <Link to={`/orders/${id}/confirmed`} className="text-purple-400 font-bold text-sm">
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
