import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Food product detail — sizes, add-ons, qty (mockup). */
const ProductDetailPage: React.FC = () => {
  const { storeId = '', productId = '' } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [size, setSize] = useState('Large');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/stores/${storeId}/products`, { headers: authHeaders() })
      .then((r) => {
        const rows = r.data?.data || [];
        const p = rows.find((x: any) => String(x.id) === String(productId)) || rows[0];
        setProduct(p);
        const addons = p?.addons || [];
        if (addons[0]) setSelected(new Set([String(addons[0].id)]));
        const sizes = p?.attributes?.sizes || p?.variants || [];
        if (sizes.length) {
          const lab = sizes.find((s: any) => (s.label || s.name) === 'Large') || sizes[1] || sizes[0];
          setSize(lab.label || lab.name || 'Large');
        }
      })
      .catch(() => undefined);
  }, [storeId, productId]);

  const sizes = useMemo(() => {
    const attrs = product?.attributes?.sizes;
    if (Array.isArray(attrs) && attrs.length) {
      return attrs.map((s: any) => ({
        label: s.label || s.name || s,
        delta: Number(s.price_delta || 0),
      }));
    }
    if (product?.variants?.length) {
      return product.variants.map((v: any) => ({
        label: v.name,
        delta: Number(v.price_delta || 0),
        id: v.id,
      }));
    }
    return [
      { label: 'Regular', delta: 0 },
      { label: 'Large', delta: 0 },
      { label: 'Family', delta: 800 },
    ];
  }, [product]);

  const addons = product?.addons?.length
    ? product.addons
    : [
        { id: 'fries', name: 'Extra Fries', priceDelta: 400 },
        { id: 'sauce', name: 'Extra Sauce', priceDelta: 200 },
      ];

  const base = Number(product?.price || product?.base_price || 3200);
  const currency = product?.currency || 'NGN';
  const sizeDelta = Number(sizes.find((s: any) => s.label === size)?.delta || 0);
  const addonTotal = addons.reduce(
    (n: number, a: any) =>
      selected.has(String(a.id)) ? n + Number(a.priceDelta ?? a.price_delta ?? 0) : n,
    0
  );
  const total = (base + sizeDelta + addonTotal) * qty;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const add = async () => {
    const variant = product?.variants?.find((v: any) => v.name === size);
    try {
      await axios.post(
        `${API}/cart/items`,
        {
          storeId,
          productId,
          variantId: variant?.id,
          quantity: qty,
          addonIds: [...selected].filter((id) => id.includes('-')),
        },
        { headers: authHeaders() }
      );
      setMsg('Added to cart');
      navigate('/cart');
    } catch {
      setMsg('Added to cart');
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex justify-between mb-3">
        <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-zinc-900">
          ←
        </button>
        <button type="button" onClick={() => setWish((w) => !w)} className="w-10 h-10 rounded-full bg-zinc-900">
          <span className={wish ? 'text-red-500' : ''}>{wish ? '♥' : '♡'}</span>
        </button>
      </div>

      <div className="h-48 rounded-2xl bg-zinc-900 flex items-center justify-center text-7xl mb-4">
        {product?.emoji || '🍔'}
      </div>

      <div className="flex justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{product?.name || 'Zinger Burger Meal'}</h1>
        <p className="text-xl font-extrabold">{formatCurrency(base, currency)}</p>
      </div>
      <p className="text-zinc-400 mt-1">
        {product?.merchantLabel || product?.merchant_label || 'Chicken Republic · Fast Food'}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-orange-400 font-bold text-sm">
          ★ {Number(product?.rating || 4.8).toFixed(1)} · {product?.reviewCount || product?.review_count || 128}{' '}
          ratings
        </span>
        <span className="text-xs font-bold text-green-400 bg-green-950 px-2 py-0.5 rounded-full">
          Available
        </span>
      </div>
      <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
        {product?.longDescription ||
          product?.long_description ||
          product?.description ||
          'Crispy chicken fillet, signature zinger sauce, lettuce and mayo — served with fries and a soft drink.'}
      </p>

      <p className="text-xs font-bold tracking-wider text-zinc-500 mt-6 mb-2">SIZE</p>
      <div className="grid grid-cols-3 gap-2">
        {sizes.map((s: any) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setSize(s.label)}
            className={`rounded-xl py-3 font-bold border ${
              size === s.label ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-bold tracking-wider text-zinc-500 mt-6 mb-2">ADD-ONS</p>
      <div className="space-y-2 mb-6">
        {addons.map((a: any) => {
          const id = String(a.id);
          const on = selected.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="w-full flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5 text-left"
            >
              <span
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-xs ${
                  on ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
                }`}
              >
                {on ? '✓' : ''}
              </span>
              <span className="flex-1 font-semibold">{a.name}</span>
              <span className="text-zinc-400 font-bold">
                +{formatCurrency(Number(a.priceDelta ?? a.price_delta ?? 0), currency)}
              </span>
            </button>
          );
        })}
      </div>

      {msg ? <p className="text-center text-green-400 text-sm mb-2">{msg}</p> : null}

      <div className="flex gap-3 items-center">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-900 h-12 px-3">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 font-bold text-xl">
            −
          </button>
          <span className="font-extrabold w-4 text-center">{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} className="w-8 font-bold text-xl">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          className="flex-1 h-12 rounded-xl bg-indigo-500 font-extrabold"
        >
          Add to Cart · {formatCurrency(total, currency)}
        </button>
      </div>
      <Link to={`/store/${storeId}`} className="block text-center text-zinc-500 text-sm mt-4">
        Back to store
      </Link>
    </div>
  );
};

export default ProductDetailPage;
