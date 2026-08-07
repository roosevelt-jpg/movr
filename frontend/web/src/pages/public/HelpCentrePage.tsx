import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Package, CreditCard, Search } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  package: Package,
  card: CreditCard,
};

type Category = {
  slug: string;
  title: string;
  description: string;
  icon_key: string;
};

const FALLBACK: Category[] = [
  {
    slug: 'ride',
    title: 'Ride issues',
    description: 'Fare disputes, lost items, safety concerns.',
    icon_key: 'car',
  },
  {
    slug: 'order',
    title: 'Order & delivery',
    description: 'Track orders, report a delivery issue.',
    icon_key: 'package',
  },
  {
    slug: 'pay',
    title: 'Payments & wallet',
    description: 'Refunds, payout issues, top-ups.',
    icon_key: 'card',
  },
];

/** Help centre — matches “How can we help?” mockup; live from help_categories. */
export default function HelpCentrePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = q.trim()
      ? `${API}/public/help/categories?q=${encodeURIComponent(q.trim())}`
      : `${API}/public/help/categories`;
    const t = setTimeout(() => {
      fetch(url)
        .then((r) => r.json())
        .then((body) => {
          if (Array.isArray(body?.data) && body.data.length) {
            setCategories(body.data);
          } else if (!q.trim()) {
            setCategories(FALLBACK);
          } else {
            setCategories([]);
          }
        })
        .catch(() => {
          if (!q.trim()) setCategories(FALLBACK);
        })
        .finally(() => setLoading(false));
    }, q.trim() ? 200 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const cards = useMemo(() => categories, [categories]);

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="flex items-center justify-between gap-4 px-6 pt-6 pb-5">
        <button type="button" onClick={() => navigate('/')} className="text-xl font-bold tracking-tight">
          Movr
        </button>
        <label className="relative w-full max-w-xs">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search help articles"
            className="w-full rounded-full bg-transparent border border-white/20 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/45 outline-none focus:border-white/40"
          />
        </label>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <h1 className="text-4xl md:text-5xl font-bold text-center tracking-tight">How can we help?</h1>

        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {loading && !cards.length ? (
            <p className="text-white/50 col-span-3 text-center">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="text-white/50 col-span-3 text-center">No matching articles</p>
          ) : (
            cards.map((c) => {
              const Icon = ICONS[c.icon_key] || Car;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => navigate(`/help/${c.slug}`)}
                  className="text-left rounded-2xl bg-[#1a1a1a] p-6 hover:bg-[#222] transition-colors"
                >
                  <Icon size={22} className="mb-4 text-white" strokeWidth={1.75} />
                  <h2 className="font-bold text-lg text-white">{c.title}</h2>
                  <p className="text-white/55 text-sm mt-2 leading-relaxed">{c.description}</p>
                </button>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
