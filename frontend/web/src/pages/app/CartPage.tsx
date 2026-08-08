import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
};

/** Your Cart checkout. */
const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const storeId = params.get('storeId') || '';
  const [items, setItems] = useState<any[]>([]);
  const [storeName, setStoreName] = useState('');
  const [eta, setEta] = useState('');
  const [coupon, setCoupon] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [dvtDiscount, setDvtDiscount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const quote = async () => {
    if (!storeId) {
      setError('No store selected');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/cart/quote`,
        { storeId, couponCode: coupon },
        { headers: authHeaders() }
      );
      const d = res.data?.data;
      if (!d) throw new Error('Cart is unavailable');
      setDeliveryFee(Number(d.deliveryFee ?? 0));
      setDvtDiscount(Number(d.dvtDiscount ?? 0));
      setDiscount(Number(d.discount ?? 0));
      setCurrency(d.currency || 'NGN');
      if (d.storeName) setStoreName(d.storeName);
      if (d.eta) setEta(d.eta);
      if (Array.isArray(d.items)) {
        setItems(
          d.items.map((r: any) => ({
            id: String(r.id || r.product_id),
            name: r.name || r.product_name || 'Item',
            price: Number(r.unit_price || r.unitPrice || r.price || 0),
            qty: Number(r.quantity || 1),
            emoji: r.emoji || '🍽️',
          }))
        );
      }
    } catch {
      setItems([]);
      setError('Could not load cart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    quote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const setQty = async (id: string, delta: number) => {
    const row = items.find((i) => i.id === id);
    if (!row) return;
    const next = Math.max(0, row.qty + delta);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qty: next } : i)).filter((i) => i.qty > 0)
    );
    try {
      if (next === 0) await axios.delete(`${API}/cart/items/${id}`, { headers: authHeaders() });
      else
        await axios.patch(
          `${API}/cart/items/${id}`,
          { quantity: next },
          { headers: authHeaders() }
        );
      quote();
    } catch {
      setError('Could not update cart');
      quote();
    }
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.qty, 0), [items]);
  const total = Math.max(0, subtotal + deliveryFee - discount - dvtDiscount);

  const placeOrder = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/cart/checkout`,
        { storeId, fulfillmentType: 'delivery', couponCode: coupon || undefined },
        { headers: authHeaders() }
      );
      const orderId = res.data?.data?.order?.id || res.data?.data?.id;
      if (!orderId) throw new Error('Order ID missing');
      toast.success('Order placed');
      navigate(`/orders/${orderId}/confirmed`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Could not place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <button type="button" onClick={() => navigate(-1)} className="mb-2">
        ←
      </button>
      <h1 className="text-3xl font-extrabold">Your Cart</h1>
      {storeName || eta ? <p className="text-zinc-400 mt-2 mb-5">{[storeName, eta].filter(Boolean).join(' · ')}</p> : null}
      {loading ? <p className="text-zinc-400 mb-5">Loading cart…</p> : null}
      {error ? <p className="text-red-400 mb-5">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="text-zinc-500 mb-5">Your cart is empty.</p> : null}

      <div className="space-y-3 mb-5">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl">
              {i.emoji}
            </div>
            <div className="flex-1">
              <p className="font-bold">{i.name}</p>
              <p className="text-zinc-400 text-sm">{formatCurrency(i.price, currency)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty(i.id, -1)} className="w-7 h-7 rounded-lg bg-zinc-700">
                −
              </button>
              <span className="w-5 text-center font-bold">{i.qty}</span>
              <button type="button" onClick={() => setQty(i.id, 1)} className="w-7 h-7 rounded-lg bg-purple-500">
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-600 px-3 py-2.5 mb-5">
        <span>🎟</span>
        <input
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Add coupon code"
          className="flex-1 bg-transparent outline-none"
        />
        <button type="button" onClick={quote} className="text-purple-400 font-bold">
          Apply
        </button>
      </div>

      <div className="space-y-2 mb-6 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-400">Subtotal</span>
          <span className="font-semibold">{formatCurrency(subtotal, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Delivery fee</span>
          <span className="font-semibold">{formatCurrency(deliveryFee, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">DVT discount</span>
          <span className="font-semibold text-green-500">-{formatCurrency(dvtDiscount, currency)}</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="font-extrabold">Total</span>
          <span className="font-extrabold">{formatCurrency(total, currency)}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={loading || items.length === 0}
        onClick={placeOrder}
        className="w-full rounded-2xl py-3.5 font-bold bg-gradient-to-r from-blue-500 to-purple-500 disabled:opacity-50"
      >
        {loading ? 'Placing…' : `Place Order • ${formatCurrency(total, currency)}`}
      </button>
    </div>
  );
};

export default CartPage;
