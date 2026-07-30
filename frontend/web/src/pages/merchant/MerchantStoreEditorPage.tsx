import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

export default function MerchantStoreEditorPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', category: 'Food', description: '', hours: '09:00-21:00' });

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    setStores(res.data.data || []);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await axios.post(
      `${API}/merchant/stores`,
      {
        name: form.name,
        category: form.category,
        description: form.description,
        hoursJson: { mon_sun: form.hours },
        lat: 5.6037,
        lng: -0.187,
      },
      { headers: headers() }
    );
    toast.success('Store saved');
    setForm({ name: '', category: 'Food', description: '', hours: '09:00-21:00' });
    await load();
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white ml-0 p-6 max-w-3xl">
      <Link to="/merchant/dashboard" className="text-motion-blue text-sm">← Dashboard</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-4">Store profile</h1>
      <form onSubmit={create} className="space-y-3 bg-surface border border-border rounded-lg p-6 mb-6">
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Store name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Hours" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
        <button className="rounded-pill bg-movr-gradient px-6 py-3 font-semibold">Save store</button>
      </form>
      <div className="space-y-3">
        {stores.map((s) => (
          <div key={s.id} className="border border-border rounded-md p-4">
            <div className="font-semibold">{s.name}</div>
            <div className="text-sm text-text-secondary">{s.category} · {s.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
