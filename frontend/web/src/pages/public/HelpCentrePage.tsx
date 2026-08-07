import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Package, CreditCard, Search } from 'lucide-react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

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

/** Help centre — prefer CMS `help`, else help_categories API. */
export default function HelpCentrePage() {
  const navigate = useNavigate();
  const { page, loading: cmsLoading } = useCmsPage('help');
  const [q, setQ] = useState('');
  const [categories, setCategories] = useState<Category[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = q.trim()
      ? `${API}/public/help/categories?q=${encodeURIComponent(q.trim())}`
      : `${API}/public/help/categories`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body?.data) && body.data.length) {
          setCategories(body.data);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [q]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return categories;
    return categories.filter(
      (c) =>
        c.title.toLowerCase().includes(s) ||
        (c.description || '').toLowerCase().includes(s) ||
        c.slug.includes(s)
    );
  }, [categories, q]);

  if (cmsLoading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary">
        <CmsSections sections={page.sections} pageSlug="help" />
      </div>
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <main className="max-w-5xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">How can we help?</h1>
        <div className="max-w-md mx-auto mb-10 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search help articles"
            className="w-full rounded-full bg-[#1A1A1A] border border-white/10 pl-11 pr-4 py-3 text-sm"
          />
        </div>
        {loading ? (
          <p className="text-center text-white/50">Loading…</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const Icon = ICONS[c.icon_key] || Package;
              return (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => navigate(`/help/${c.slug}`)}
                  className="rounded-2xl bg-[#1A1A1A] border border-white/10 p-6 text-left hover:border-white/25"
                >
                  <Icon size={22} className="mb-4" />
                  <h3 className="font-bold text-lg">{c.title}</h3>
                  <p className="text-sm text-white/50 mt-2">{c.description}</p>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
