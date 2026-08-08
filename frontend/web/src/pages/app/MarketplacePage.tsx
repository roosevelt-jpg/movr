import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, Star, Heart } from 'lucide-react';
import { mediaUrl } from '../../lib/media';
import { formatCurrency } from '../../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';

/** Live marketplace — stores + product search grid. */
const MarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'stores' | 'products'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ slug: string; name?: string }>({
    slug: 'all',
  });
  const [sort, setSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forYou, setForYou] = useState<{ stores: any[]; reason?: string }>({ stores: [] });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('movr_token') || '';
        const res = await axios.get(`${API}/ai/recommendations`, {
          params: { limit: 6 },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) {
          setForYou({
            stores: res.data?.data?.stores || [],
            reason: res.data?.data?.reason,
          });
        }
      } catch {
        if (!cancelled) setForYou({ stores: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const catRes = await axios.get(`${API}/categories`);
        if (cancelled) return;
        setCategories(catRes.data.data || []);

        if (tab === 'stores') {
          const storeRes = await axios.get(`${API}/stores`, {
            params: {
              search: searchQuery || undefined,
              category:
                selectedCategory.slug !== 'all'
                  ? selectedCategory.name || selectedCategory.slug
                  : undefined,
            },
          });
          if (cancelled) return;
          setStores(storeRes.data.data || []);
        } else {
          const productRes = await axios.get(`${API}/products`, {
            params: {
              q: searchQuery || undefined,
              category:
                selectedCategory.slug !== 'all'
                  ? selectedCategory.name || selectedCategory.slug
                  : undefined,
              sort,
              minPrice: minPrice !== '' ? Number(minPrice) : undefined,
              maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
            },
          });
          if (cancelled) return;
          setProducts(productRes.data.data || []);
        }
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
  }, [selectedCategory, searchQuery, tab, sort, minPrice, maxPrice]);

  const chips = useMemo(
    () => [{ id: 'all', name: 'All', slug: 'all' }, ...categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))],
    [categories]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-movr-gradient">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Marketplace</h1>
            <p className="text-pure-white/80">Search products or browse neighbourhood stores</p>
          </div>
          <Link
            to="/wishlist"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
          >
            <Heart size={16} /> Wishlist
          </Link>
        </div>
      </div>

      {forYou.stores.length ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">For you</h2>
            {forYou.reason ? (
              <p className="text-sm text-text-secondary mt-0.5">{forYou.reason}</p>
            ) : null}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {forYou.stores.slice(0, 6).map((s: any) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/store/${s.id}`)}
                className="min-w-[160px] max-w-[180px] text-left rounded-2xl border border-border bg-surface overflow-hidden hover:border-electric-violet transition-colors shrink-0"
              >
                <div className="aspect-[16/9] bg-surface-elevated overflow-hidden">
                  {s.banner_url ? (
                    <img
                      src={mediaUrl(s.banner_url)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl opacity-40">
                      🏪
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                    {s.reason || s.category || 'Recommended'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex gap-2 mb-4">
          {(['products', 'stores'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold capitalize ${
                tab === t ? 'bg-motion-blue text-pure-white' : 'bg-surface-elevated text-text-secondary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative mb-4">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            size={20}
            aria-hidden
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tab === 'products' ? 'Search products…' : 'Search stores…'}
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

        {tab === 'products' ? (
          <div className="flex flex-wrap gap-3 mt-4">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl bg-surface-elevated border border-border px-3 py-2 text-sm"
            >
              <option value="newest">Newest</option>
              <option value="rating">Top rated</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
            <input
              type="number"
              placeholder="Min price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-28 rounded-xl bg-surface-elevated border border-border px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Max price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-28 rounded-xl bg-surface-elevated border border-border px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </div>

      {error ? <p className="text-error">{error}</p> : null}
      {loading ? <p className="text-text-secondary">Loading…</p> : null}

      {!loading && tab === 'stores' ? (
        stores.length === 0 ? (
          <p className="text-text-secondary">No stores found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <button
                key={store.id}
                type="button"
                className="text-left rounded-2xl border border-border bg-surface overflow-hidden hover:border-electric-violet transition-colors"
                onClick={() => navigate(`/store/${store.id}`)}
              >
                <div className="aspect-[16/9] bg-surface-elevated flex items-center justify-center overflow-hidden">
                  {store.banner_url ? (
                    <img
                      src={mediaUrl(store.banner_url)}
                      alt={store.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
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
        )
      ) : null}

      {!loading && tab === 'products' ? (
        products.length === 0 ? (
          <p className="text-text-secondary">No products match your filters.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => {
              const img = p.images?.[0]?.url || p.image_url;
              const currency = p.currency || 'NGN';
              const price = Number(p.price ?? p.effective_price ?? 0);
              const compare = p.compareAtPrice != null ? Number(p.compareAtPrice) : null;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="text-left rounded-2xl border border-border bg-surface overflow-hidden hover:border-electric-violet transition-colors"
                  onClick={() => navigate(`/store/${p.store_id}/product/${p.id}`)}
                >
                  <div className="aspect-square bg-surface-elevated overflow-hidden">
                    {img ? (
                      <img src={mediaUrl(img)} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-4xl opacity-40">
                        {p.emoji || '🛍️'}
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-text-secondary truncate">{p.storeName || p.store_name}</p>
                    <h3 className="font-semibold text-sm line-clamp-2">{p.name}</h3>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold">{formatCurrency(price, currency)}</span>
                      {compare != null && compare > price ? (
                        <span className="text-xs text-text-secondary line-through">
                          {formatCurrency(compare, currency)}
                        </span>
                      ) : null}
                      {p.onSale ? (
                        <span className="text-[10px] font-bold uppercase text-error">Sale</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-text-secondary inline-flex items-center gap-1">
                      <Star size={12} className="text-warning" />
                      {Number(p.rating || 0).toFixed(1)} ({p.reviewCount || 0})
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
};

export default MarketplacePage;
