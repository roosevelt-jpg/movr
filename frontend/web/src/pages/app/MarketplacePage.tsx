import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, Star } from 'lucide-react';
import { mediaUrl } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';

/** Live marketplace — stores + shared category chips from API. */
const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ slug: string; name?: string }>({
    slug: 'all',
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [catRes, storeRes] = await Promise.all([
          axios.get(`${API}/categories`),
          axios.get(`${API}/stores`, {
            params: {
              search: searchQuery || undefined,
              category:
                selectedCategory.slug !== 'all'
                  ? selectedCategory.name || selectedCategory.slug
                  : undefined,
            },
          }),
        ]);
        if (cancelled) return;
        setCategories(catRes.data.data || []);
        setStores(storeRes.data.data || []);
        setError('');
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, searchQuery]);

  const chips = useMemo(
    () => [{ id: 'all', name: 'All', slug: 'all' }, ...categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))],
    [categories]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-movr-gradient">
        <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
        <p className="text-pure-white/80">Shop from neighbourhood stores on Movr</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="relative mb-6">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            size={20}
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stores..."
            className="w-full rounded-xl bg-surface-elevated border border-border pl-12 pr-4 py-3"
          />
        </div>

        <div className="flex overflow-x-auto gap-2 pb-2">
          {chips.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                setSelectedCategory(
                  cat.slug === 'all'
                    ? { slug: 'all' }
                    : { slug: cat.slug || cat.id, name: cat.name }
                )
              }
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                selectedCategory.slug === (cat.slug || cat.id)
                  ? 'bg-motion-blue text-pure-white'
                  : 'bg-surface-elevated text-text-primary hover:border-electric-violet border border-transparent'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-error">{error}</p> : null}
      {loading ? <p className="text-text-secondary">Loading stores…</p> : null}

      {!loading && stores.length === 0 ? (
        <p className="text-text-secondary">No stores found. Merchants can publish storefronts from the merchant portal.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <button
              key={store.id}
              type="button"
              className="text-left rounded-2xl border border-border bg-surface overflow-hidden hover:border-electric-violet transition-colors"
              onClick={() => navigate(`/store/${store.id}`)}
            >
              <div className="h-40 bg-surface-elevated flex items-center justify-center overflow-hidden">
                {store.banner_url ? (
                  <img
                    src={mediaUrl(store.banner_url)}
                    alt={store.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl opacity-40">🏪</span>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-lg truncate">{store.name}</h3>
                <p className="text-sm text-text-secondary truncate">{store.category || 'Store'}</p>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span className="inline-flex items-center gap-1">
                    <Star size={14} className="text-warning" />
                    {Number(store.rating || 0).toFixed(1)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} />
                    Nearby
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
