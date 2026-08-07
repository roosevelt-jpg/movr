import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ridesApi } from '../../services/api';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

type Item = {
  id: string;
  title: string;
  when: string;
  amount: number;
  kind: 'ride' | 'order';
};

const API = import.meta.env.VITE_API_URL || '/api/v1';

/** Trip history — empty state + rides/orders list. */
const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceEmpty = searchParams.get('empty') === '1';
  const { formatMoney } = useLocalCurrency();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyCopy, setEmptyCopy] = useState({
    title: 'No trips yet',
    body: 'Your ride and order history will show up here once you take your first trip.',
    cta_label: 'Book a ride',
  });

  useEffect(() => {
    fetch(`${API}/public/status-copy/trip_history_empty`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) setEmptyCopy(body.data);
      })
      .catch(() => undefined);

    if (forceEmpty) {
      setItems([]);
      setLoading(false);
      return;
    }

    Promise.all([
      ridesApi.getRideHistory(20, 0).catch(() => null),
      fetch(`${API}/orders?limit=20`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('movr_token') || ''}`,
        },
      })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([rides, orders]) => {
        const rideRows = (rides?.data?.data?.rides || rides?.data?.rides || []).map((r: any) => ({
          id: r.id,
          title: `${r.pickupAddress || r.pickup_address || 'Pickup'} → ${
            r.dropoffAddress || r.dropoff_address || 'Dropoff'
          }`,
          when: r.createdAt || r.created_at
            ? new Date(r.createdAt || r.created_at).toLocaleString()
            : 'Recently',
          amount: Number(r.actualFare || r.actual_fare || r.estimatedFare || 0),
          kind: 'ride' as const,
        }));
        const orderRows = (orders?.data || []).map((o: any) => ({
          id: o.id,
          title: `${o.store_name || o.storeName || 'Store'} order`,
          when: o.created_at ? new Date(o.created_at).toLocaleString() : 'Recently',
          amount: Number(o.total || 0),
          kind: 'order' as const,
        }));
        setItems([...rideRows, ...orderRows]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [forceEmpty]);

  return (
    <div className="min-h-screen bg-black text-pure-white font-[Poppins,Montserrat,sans-serif] p-6 md:p-8" data-force-dark>
      <h1 className="text-3xl font-bold mb-6">Trip history</h1>

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#1A1A1A] flex items-center justify-center text-3xl mb-5">
            🚐
          </div>
          <h2 className="text-xl font-bold">{emptyCopy.title}</h2>
          <p className="text-white/55 mt-3 mb-8 leading-relaxed">{emptyCopy.body}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-full px-8 py-3.5 font-semibold text-white"
            style={{
              background: 'linear-gradient(90deg, #6B21A8 0%, #3B5CFF 100%)',
            }}
          >
            {emptyCopy.cta_label}
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {loading ? <p className="text-white/50">Loading…</p> : null}
          {items.map((item) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() =>
                navigate(item.kind === 'order' ? `/orders/${item.id}` : `/ride/${item.id}`)
              }
              className="w-full flex items-center gap-3 rounded-2xl bg-[#1A1A1A] p-4 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-[#2A2A2A] flex items-center justify-center text-lg">
                {item.kind === 'order' ? '📦' : '🚗'}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-white/50 mt-1">{item.when}</span>
              </span>
              <span className="font-semibold">{formatMoney(Number(item.amount))}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
