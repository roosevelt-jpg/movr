import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

/** Store Setup · Step 3 of 4 — Add products (mockup). */
export default function MerchantStoreSetupPage() {
  const navigate = useNavigate();
  const { formatMoney } = useLocalCurrency();
  const [step] = useState(3);
  const [products, setProducts] = useState<any[]>([]);
  const [storeId, setStoreId] = useState('');
  const [form, setForm] = useState({
    name: '',
    price: '',
    description: '',
    imageUrl: '',
    emoji: '🍔',
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const [p, s] = await Promise.all([
      axios.get(`${API}/merchant/products`, { headers: headers() }),
      axios.get(`${API}/merchant/stores`, { headers: headers() }),
    ]);
    setProducts(p.data.data || []);
    const sid = s.data.data?.[0]?.id || '';
    setStoreId(sid);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e?.response?.data?.message || e.message));
  }, []);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadCatalogImage(file, token(), 'banner');
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success('Photo uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const addProduct = async () => {
    if (!form.name.trim() || !form.price) {
      toast.error('Name and price required');
      return;
    }
    if (!storeId) {
      toast.error('Create a store first');
      return;
    }
    setBusy(true);
    try {
      await axios.post(
        `${API}/merchant/products`,
        {
          storeId,
          name: form.name,
          price: Number(form.price),
          description: form.description || undefined,
          imageUrl: form.imageUrl || undefined,
          currency: 'NGN',
          isAvailable: true,
          inStock: true,
        },
        { headers: headers() }
      );
      setForm({ name: '', price: '', description: '', imageUrl: '', emoji: '🍔' });
      toast.success('Product added');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add product');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await axios.delete(`${API}/merchant/products/${id}`, { headers: headers() });
      setProducts((list) => list.filter((p) => p.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Remove failed');
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-3">
          <Link to="/merchant/onboarding" className="text-xl text-white/70">
            ←
          </Link>
          <h1 className="text-lg font-bold">Store Setup</h1>
        </div>

        <div className="mb-4 flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-violet-500' : 'bg-zinc-800'}`}
            />
          ))}
        </div>

        <p className="text-xs font-bold tracking-widest text-zinc-500">STEP 3 OF 4 · ADD PRODUCTS</p>
        <h2 className="mt-2 text-3xl font-extrabold">Add your products</h2>
        <p className="mt-2 text-zinc-400">Customers see these in your store listing</p>

        <div className="mt-6 space-y-3">
          {products.slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
                {p.emoji || '🍽'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-zinc-400">
                  {formatMoney(Number(p.price || p.base_price || 0))} ·{' '}
                  <span className="text-emerald-400">In stock</span>
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-semibold text-violet-400"
                onClick={() => navigate('/merchant/products')}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-red-400"
                onClick={() => remove(p.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 p-4">
          <p className="mb-3 text-xs font-bold tracking-widest text-zinc-500">NEW PRODUCT</p>
          <div className="mb-3 flex gap-3">
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-zinc-600 text-xs text-zinc-400">
              <span className="text-lg">📷</span>
              {uploading ? '…' : 'Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
            <div className="flex-1 space-y-2">
              <input
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5"
                placeholder="Product name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5"
                placeholder="Price (₦)"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>
          <textarea
            className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5"
            rows={3}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <button
            type="button"
            disabled={busy}
            onClick={addProduct}
            className="w-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 py-3 font-bold disabled:opacity-40"
          >
            {busy ? 'Adding…' : '+ Add Product'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate('/merchant/store')}
          className="mt-8 w-full rounded-2xl bg-zinc-900 py-4 font-bold"
        >
          Continue → Operating Hours
        </button>
      </div>
    </div>
  );
}
