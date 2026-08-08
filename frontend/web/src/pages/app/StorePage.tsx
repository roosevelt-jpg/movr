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

/** Restaurant menu storefront (mockup). */
const StorePage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([
    { name: 'All' },
    { name: 'Burgers' },
    { name: 'Chicken' },
    { name: 'Sides' },
  ]);
  const [cat, setCat] = useState('All');
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const currency = store?.currency_code || 'NGN';

  const load = async () => {
    if (!id) return;
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
      setStore({
        name: 'Chicken Republic',
        category: 'Fast Food',
        hours_text: 'Open until 10 PM',
        rating: 4.8,
        eta_min_minutes: 20,
        eta_max_minutes: 35,
        min_order_amount: 500,
        currency_code: 'NGN',
      });
      setProducts([
        {
          id: '1',
          name: 'Zinger Burger Meal',
          description: 'Crispy chicken burger, fries & drink',
          price: 3200,
          emoji: '🍔',
          is_popular: true,
        },
        {
          id: '2',
          name: 'Grilled Chicken Combo',
          description: '2pc chicken, coleslaw & plantain',
          price: 4500,
          emoji: '🍗',
          is_popular: true,
        },
      ]);
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
      /* ignore */
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
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto relative pb-24" data-force-dark>
      <div className="flex justify-between items-start p-4">
        <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-zinc-900">
          ←
        </button>
        <span className="text-5xl">🍔</span>
      </div>
      <h1 className="text-3xl font-extrabold px-4">{store?.name || 'Chicken Republic'}</h1>
      <p className="text-zinc-400 px-4 mt-2">
        {store?.category || 'Fast Food'} · {store?.hours_text || store?.hours_json?.label || 'Open until 10 PM'}
      </p>
      <p className="px-4 mt-2 font-semibold">
        ★ {Number(store?.rating || 4.8).toFixed(1)} · {store?.eta_min_minutes || 20}-{store?.eta_max_minutes || 35}{' '}
        min · Min {formatCurrency(Number(store?.min_order_amount || 500), currency)}
      </p>

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
          className="fixed bottom-6 left-4 right-4 max-w-xl mx-auto rounded-2xl bg-blue-600 min-h-[54px] px-5 flex items-center justify-between font-bold"
        >
          <span>🛒 View Cart ({cartCount})</span>
          <span>{formatCurrency(cartTotal, currency)} →</span>
        </Link>
      ) : null}
    </div>
  );
};

export default StorePage;
