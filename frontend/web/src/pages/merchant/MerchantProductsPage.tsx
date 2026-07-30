import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

export default function MerchantProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [form, setForm] = useState({ storeId: '', name: '', price: '', variant: '' });

  const load = async () => {
    const [p, s] = await Promise.all([
      axios.get(`${API}/merchant/products`, { headers: headers() }),
      axios.get(`${API}/merchant/stores`, { headers: headers() }),
    ]);
    setProducts(p.data.data || []);
    setStores(s.data.data || []);
    if (s.data.data?.[0] && !form.storeId) setForm((f) => ({ ...f, storeId: s.data.data[0].id }));
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await axios.post(
      `${API}/merchant/products`,
      { storeId: form.storeId, name: form.name, price: Number(form.price) },
      { headers: headers() }
    );
    if (form.variant) {
      await axios.post(
        `${API}/merchant/products/${res.data.data.id}/variants`,
        { name: form.variant, priceDelta: 0 },
        { headers: headers() }
      );
    }
    toast.success('Product added');
    setForm((f) => ({ ...f, name: '', price: '', variant: '' }));
    await load();
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white p-6">
      <Link to="/merchant/dashboard" className="text-motion-blue text-sm">← Dashboard</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-4">Products</h1>

      <form onSubmit={create} className="grid md:grid-cols-4 gap-3 bg-surface border border-border rounded-lg p-4 mb-6">
        <select className="rounded-md bg-surface-elevated border border-border px-3 py-2" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="rounded-md bg-surface-elevated border border-border px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded-md bg-surface-elevated border border-border px-3 py-2" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <button className="rounded-pill bg-movr-gradient font-semibold">Add</button>
      </form>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 gap-2 p-3 bg-surface-elevated text-text-secondary text-sm">
          <span>Name</span><span>Price</span><span>Stock</span><span>Store</span>
        </div>
        {products.map((p) => (
          <div key={p.id} className="grid grid-cols-4 gap-2 p-3 border-t border-border text-sm">
            <span>{p.name}</span>
            <span>GHS {Number(p.price).toFixed(2)}</span>
            <span>{p.in_stock ? 'Yes' : 'No'}</span>
            <span className="text-text-secondary">{p.store_id?.slice?.(0, 8)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
