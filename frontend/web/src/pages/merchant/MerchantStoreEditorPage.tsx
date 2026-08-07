import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ImageIcon } from 'lucide-react';
import MerchantShell from '../../layouts/MerchantShell';
import { mediaUrl, uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

/** Store profile editor — banner + 2×2 fields matching mockup. */
export default function MerchantStoreEditorPage() {
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    name: '',
    category: 'Fashion',
    hours: '9:00 AM – 9:00 PM',
    deliveryMode: 'Movr courier',
    bannerUrl: '',
  });

  const applyStore = (row: any) => {
    setSelectedId(row.id);
    setForm({
      name: row.name || '',
      category: row.category || 'Fashion',
      hours:
        row.hours_json?.mon_sun ||
        row.hours_json?.label ||
        row.hours ||
        '9:00 AM – 9:00 PM',
      deliveryMode: row.default_delivery_mode || 'Movr courier',
      bannerUrl: row.banner_url || '',
    });
  };

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    const rows = res.data.data || [];
    if (rows[0]) applyStore(rows[0]);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        category: form.category,
        hoursJson: { mon_sun: form.hours, label: form.hours },
        defaultDeliveryMode: form.deliveryMode,
        bannerUrl: form.bannerUrl || undefined,
      };
      if (selectedId) {
        await axios.patch(`${API}/merchant/stores/${selectedId}`, payload, { headers: headers() });
      } else {
        const created = await axios.post(
          `${API}/merchant/stores`,
          { ...payload, lat: 5.6037, lng: -0.187 },
          { headers: headers() }
        );
        applyStore(created.data.data);
      }
      toast.success('Store saved');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Save failed');
    }
  };

  const onHeroUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      const url = await uploadCatalogImage(file, token());
      setForm((f) => ({ ...f, bannerUrl: url }));
      toast.success('Banner uploaded');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <MerchantShell activePath="/merchant/store">
      <h1 className="text-3xl font-bold text-white mb-6">Store profile</h1>

      <label className="block w-full h-40 rounded-2xl border border-dashed border-white/25 bg-[#111] flex flex-col items-center justify-center text-[#888888] mb-6 cursor-pointer overflow-hidden">
        {form.bannerUrl ? (
          <img src={mediaUrl(form.bannerUrl)} alt="Banner" className="h-full w-full object-cover" />
        ) : (
          <>
            <ImageIcon size={28} className="mb-2 opacity-60" />
            <span className="text-sm">Upload store banner</span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onHeroUpload(e.target.files?.[0])}
        />
      </label>

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-[#888888]">Store name</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#888888]">Category</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#888888]">Opening hours</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[#888888]">Delivery mode</span>
            <select
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.deliveryMode}
              onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}
            >
              <option>Movr courier</option>
              <option>Merchant own</option>
              <option>Customer pickup</option>
            </select>
          </label>
        </div>

        <button type="submit" className="rounded-xl px-6 py-3 font-semibold bg-movr-gradient text-white">
          Save changes
        </button>
      </form>
    </MerchantShell>
  );
}
