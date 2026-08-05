import React from 'react';
import { Phone, MessageCircle, Share2, MapPin } from 'lucide-react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

/** Active ride — ETA/SOS map, driver card, share/route actions. */
const ActiveRidePage: React.FC = () => {
  const { formatMoney } = useLocalCurrency();
  return (
    <div className="min-h-[70vh] rounded-2xl bg-jet-black text-pure-white overflow-hidden border border-border">
      <div className="relative h-64 md:h-80 bg-surface-elevated">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-4 left-4 rounded-full bg-jet-black/80 px-3 py-1.5 text-sm font-semibold">
          ETA 6 min
        </div>
        <button className="absolute top-4 right-4 rounded-full bg-error text-black font-bold px-4 py-1.5 text-sm">
          SOS
        </button>
        <div className="absolute left-[28%] top-[32%] w-3 h-3 rounded-full bg-white" />
        <div className="absolute right-[30%] bottom-[28%] w-4 h-4 rounded-full border-2 border-motion-blue" />
      </div>

      <div className="p-5 md:p-6 space-y-4">
        <div className="rounded-2xl bg-surface-elevated border border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-full bg-surface border border-border" />
              <div>
                <p className="font-bold text-lg">Kwesi Boateng</p>
                <p className="text-sm text-text-secondary">GR 4471-22 · Toyota</p>
                <p className="text-sm text-text-secondary">Corolla · ★ 4.9</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center">
                <Phone size={18} />
              </button>
              <button className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center">
                <MessageCircle size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button className="rounded-xl bg-surface border border-border py-3 font-semibold flex items-center justify-center gap-2">
              <Share2 size={16} /> Share trip
            </button>
            <button className="rounded-xl bg-surface border border-border py-3 font-semibold flex items-center justify-center gap-2">
              <MapPin size={16} /> Route
            </button>
          </div>
        </div>

        <p className="text-center text-text-secondary text-sm pb-2">
          Arriving at destination · {formatMoney(45)} fare
        </p>
      </div>
    </div>
  );
};

export default ActiveRidePage;
