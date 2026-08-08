import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';
import { mediaUrl } from '../../lib/media';
import { isMediaVideo } from '../../components/ResponsiveMedia';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** Restaurant menu storefront — CMS/merchant banners + details. */
const StorePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cat, setCat] = useState('All');
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);

  const currency = store?.currency_code || 'NGN';

  const slides = useMemo(() => {
    const fromCarousel = Array.isArray(store?.banners)
      ? store.banners.filter((b: any) => b.is_active !== false && b.image_url)
      : [];
    if (fromCarousel.length) return fromCarousel.map((b: any) => b.image_url);
    if (store?.banner_url) return [store.banner_url];
    return [];
  }, [store]);

  useEffect(() => {
    setSlide(0);
  }, [id, slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => window.clearInterval(t);
  }, [slides.length]);

  const load = async () => {
    if (!id) {
      setError('Store not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [s, p] = await Promise.all([
        axios.get(`${API}/stores/${id}`),
        axios.get(`${API}/stores/${id}/products`, {
          params: cat !== 'All' ? { category: cat } : undefined,
        }),
      ]);
      setStore(s.data.data);
      setProducts(p.data.data || []);
      if (Array.isArray(p.data.categories) && p.data.categories.length) {
        setCategories(p.data.categories);
      }
    } catch {
      setStore(null);
      setProducts([]);
      setCategories([]);
      setError('Could not load store');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      const res = await axios.get(`${API}/cart`, {
        params: { storeId: id },
        headers: authHeaders(),
      });
      const items = res.data?.data?.items || [];
      setCartCount(items.reduce((n: number, i: any) => n + Number(i.quantity || 0), 0));
      setCartTotal(
        items.reduce(
          (n: number, i: any) =>
            n + Number(i.unit_price || i.unitPrice || i.price || 0) * Number(i.quantity || 0),
          0
        )
      );
    } catch {
      setCartCount(0);
      setCartTotal(0);
    }
  };

  useEffect(() => {
    load();
    loadCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cat]);

  const list = useMemo(() => {
    const popular = products.filter((p) => p.is_popular || p.is_featured);
    return popular.length ? popular : products;
  }, [products]);

  const add = async (productId: string, price: number) => {
    try {
      await axios.post(
        `${API}/cart/items`,
        { storeId: id, productId, quantity: 1 },
        { headers: authHeaders() }
      );
      setCartCount((c) => c + 1);
      setCartTotal((t) => t + price);
      toast.success('Added');
      loadCart();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Sign in to add to cart');
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto relative pb-8" data-force-dark>
      <div className="relative">
        {slides.length ? (
          <div className="relative w-full aspect-[21/9] max-h-52 overflow-hidden bg-zinc-900">
            {isMediaVideo(slides[slide]) ? (
              <video
                key={slides[slide]}
                src={mediaUrl(slides[slide])}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                key={slides[slide]}
                src={mediaUrl(slides[slide])}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
            {slides.length > 1 ? (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {slides.map((_: string, i: number) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-end p-4">
            <span className="text-5xl">🍔</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur z-10"
        >
          ←
        </button>
      </div>

      {loading ? <p className="px-4 text-zinc-400 mt-4">Loading store…</p> : null}
      {error ? <p className="px-4 text-red-400 mt-4">{error}</p> : null}
      {store ? (
        <>
          <h1 className="text-3xl font-extrabold px-4 mt-4">{store.name}</h1>
          <p className="text-zinc-400 px-4 mt-2">
            {[store.category, store.hours_text || store.hours_json?.label, store.address]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {store.description ? (
            <p className="px-4 mt-3 text-sm text-zinc-300 leading-relaxed">{store.description}</p>
          ) : null}
          <p className="px-4 mt-2 font-semibold">
            ★ {Number(store.rating || 0).toFixed(1)} · {store.eta_min_minutes || 0}-
            {store.eta_max_minutes || 0} min · Min{' '}
            {formatCurrency(Number(store.min_order_amount || 0), currency)}
          </p>
        </>
      ) : null}

      <div className="flex gap-2 px-4 mt-5 overflow-x-auto">
        {categories.map((c: any) => {
          const name = c.name || c;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCat(name)}
              className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                cat === name ? 'bg-purple-500' : 'bg-zinc-900'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>

      <p className="text-xs tracking-wider text-zinc-500 font-bold px-4 mt-6 mb-2">POPULAR</p>
      <ul className="divide-y divide-zinc-900">
        {list.map((p) => (
          <li key={p.id} className="flex gap-3 px-4 py-4">
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => navigate(`/store/${id}/product/${p.id}`)}
            >
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-zinc-400 mt-1">{p.description}</p>
              <p className="font-bold mt-2">
                {formatCurrency(Number(p.price || p.base_price || 0), currency)}
              </p>
            </button>
            <div className="relative w-20 h-20 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center text-3xl shrink-0">
              {p.images?.[0]?.url || p.image_url ? (
                <img
                  src={mediaUrl(p.images?.[0]?.url || p.image_url)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                p.emoji || '🍽️'
              )}
              <button
                type="button"
                onClick={() => add(p.id, Number(p.price || p.base_price || 0))}
                className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-blue-500 font-black z-10"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      {cartCount > 0 ? (
        <Link
          to={`/cart?storeId=${id}`}
          className="mt-6 mx-4 rounded-2xl bg-blue-600 min-h-[54px] px-5 flex items-center justify-between font-bold"
        >
          <span>🛒 View Cart ({cartCount})</span>
          <span>{formatCurrency(cartTotal, currency)} →</span>
        </Link>
      ) : null}
    </div>
  );
};

export default StorePage;
