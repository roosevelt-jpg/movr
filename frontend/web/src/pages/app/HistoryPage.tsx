import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ridesApi } from '../../services/api';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

type Item = {
  id: string;
  title: string;
  when: string;
  amount: number;
  kind: 'ride' | 'order';
};

/** Trip history — empty state + rides list. */
const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { formatMoney } = useLocalCurrency();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ridesApi
      .getRideHistory(20, 0)
      .then((rides) => {
        const rows = rides?.data?.data?.rides || [];
        setItems(
          rows.map((r: any) => ({
            id: r.id,
            title: `${r.pickupAddress || 'Pickup'} → ${r.dropoffAddress || 'Dropoff'}`,
            when: r.createdAt ? new Date(r.createdAt).toLocaleString() : 'Recently',
            amount: Number(r.actualFare || r.estimatedFare || 0),
            kind: 'ride' as const,
          }))
        );
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif] p-6 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Trip history</h1>

      {!loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
          <div className="w-18 h-18 w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center text-3xl mb-5">
            🚐
          </div>
          <h2 className="text-xl font-bold">No trips yet</h2>
          <p className="text-text-secondary mt-3 mb-8 leading-relaxed">
            Your ride and order history will show up here once you take your first trip.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="rounded-full px-8 py-3.5 font-semibold bg-movr-gradient"
          >
            Book a ride
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/ride/${item.id}`)}
              className="w-full flex items-center gap-3 rounded-2xl bg-surface-elevated p-4 text-left"
            >
              <span className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center text-lg">
                {item.kind === 'order' ? '📦' : '🚗'}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-text-secondary mt-1">{item.when}</span>
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
