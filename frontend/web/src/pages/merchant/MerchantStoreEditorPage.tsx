import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Store profile editor — banner upload + 2x2 fields (keeps merchant/stores APIs). */
export default function MerchantStoreEditorPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    name: 'Boutique 22',
    category: 'Fashion',
    description: '',
    hours: '9:00 AM – 9:00 PM',
    deliveryMode: 'Movr courier',
    bannerUrl: '',
  });

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    const rows = res.data.data || [];
    setStores(rows);
    if (rows[0]) {
      setSelectedId(rows[0].id);
      setForm({
        name: rows[0].name || '',
        category: rows[0].category || 'Fashion',
        description: rows[0].description || '',
        hours: rows[0].hours_json?.mon_sun || rows[0].hours || '9:00 AM – 9:00 PM',
        deliveryMode: rows[0].default_delivery_mode || 'Movr courier',
        bannerUrl: rows[0].banner_url || '',
      });
    }
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedId) {
        await axios.patch(
          `${API}/merchant/stores/${selectedId}`,
          {
            name: form.name,
            category: form.category,
            description: form.description,
            hoursJson: { mon_sun: form.hours },
            defaultDeliveryMode: form.deliveryMode,
            bannerUrl: form.bannerUrl || undefined,
          },
          { headers: headers() }
        );
      } else {
        await axios.post(
          `${API}/merchant/stores`,
          {
            name: form.name,
            category: form.category,
            description: form.description,
            hoursJson: { mon_sun: form.hours },
            lat: 5.6037,
            lng: -0.187,
            bannerUrl: form.bannerUrl || undefined,
          },
          { headers: headers() }
        );
      }
      toast.success('Store saved');
      await load();
    } catch (err: any) {
      // Fallback create if patch not available
      try {
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
        toast.success('Store created');
        await load();
      } catch (e2: any) {
        toast.error(e2?.response?.data?.message || err?.message || 'Save failed');
      }
    }
  };

  return (
    <MerchantShell activePath="/merchant/store">
      <h1 className="text-3xl font-bold mb-6">Store profile</h1>

      <button
        type="button"
        className="w-full h-36 rounded-2xl border border-dashed border-[#555] bg-[#121212] flex items-center justify-center text-[#A0A0A0] mb-6"
        onClick={() => {
          const url = window.prompt('Banner image URL (or leave blank)');
          if (url != null) setForm({ ...form, bannerUrl: url });
        }}
      >
        {form.bannerUrl ? (
          <img src={form.bannerUrl} alt="Banner" className="h-full w-full object-cover rounded-2xl" />
        ) : (
          <span>🖼  Upload store banner</span>
        )}
      </button>

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-[#A0A0A0]">Store name</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#A0A0A0]">Category</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#A0A0A0]">Opening hours</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#A0A0A0]">Delivery mode</span>
            <select
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
              value={form.deliveryMode}
              onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}
            >
              <option>Movr courier</option>
              <option>Merchant own</option>
              <option>Customer pickup</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-sm text-[#A0A0A0]">Description</span>
          <textarea
            className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 min-h-[88px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <button
          type="submit"
          className="rounded-xl px-6 py-3 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
        >
          Save changes
        </button>
      </form>

      {stores.length > 1 ? (
        <div className="mt-8 space-y-2">
          <p className="text-sm text-[#A0A0A0]">Your stores</p>
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSelectedId(s.id);
                setForm({
                  name: s.name || '',
                  category: s.category || 'Fashion',
                  description: s.description || '',
                  hours: s.hours_json?.mon_sun || '9:00 AM – 9:00 PM',
                  deliveryMode: s.default_delivery_mode || 'Movr courier',
                  bannerUrl: s.banner_url || '',
                });
              }}
              className={`block w-full text-left rounded-xl border px-4 py-3 ${
                selectedId === s.id ? 'border-[#6A00FF]' : 'border-[#2A2A2A]'
              }`}
            >
              {s.name} · {s.category}
            </button>
          ))}
        </div>
      ) : null}
    </MerchantShell>
  );
}
