import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** Restaurant menu storefront. */
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

  const currency = store?.currency_code || 'NGN';

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
      <div className="flex justify-between items-start p-4">
        <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-zinc-900">
          ←
        </button>
        <span className="text-5xl">🍔</span>
      </div>
      {loading ? <p className="px-4 text-zinc-400">Loading store…</p> : null}
      {error ? <p className="px-4 text-red-400">{error}</p> : null}
      {store ? (
        <>
          <h1 className="text-3xl font-extrabold px-4">{store.name}</h1>
          <p className="text-zinc-400 px-4 mt-2">
            {[store.category, store.hours_text || store.hours_json?.label].filter(Boolean).join(' · ')}
          </p>
          <p className="px-4 mt-2 font-semibold">
            ★ {Number(store.rating || 0).toFixed(1)} · {store.eta_min_minutes || 0}-{store.eta_max_minutes || 0}{' '}
            min · Min {formatCurrency(Number(store.min_order_amount || 0), currency)}
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
              <p className="font-bold mt-2">{formatCurrency(Number(p.price || p.base_price || 0), currency)}</p>
            </button>
            <div className="relative w-20 h-20 rounded-xl bg-zinc-900 flex items-center justify-center text-3xl">
              {p.emoji || '🍽️'}
              <button
                type="button"
                onClick={() => navigate(`/store/${id}/product/${p.id}`)}
                className="absolute right-1.5 bottom-1.5 w-7 h-7 rounded-full bg-blue-500 font-black"
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
