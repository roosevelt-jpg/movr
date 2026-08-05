import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { mediaUrl, uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

type Banner = {
  id: string;
  title?: string;
  image_url: string;
  link_url?: string;
  sort_order: number;
  is_active: boolean;
};

/** Store profile editor — hero banner + promo banners list. */
export default function MerchantStoreEditorPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [form, setForm] = useState({
    name: '',
    category: 'Fashion',
    description: '',
    hours: '9:00 AM – 9:00 PM',
    deliveryMode: 'Movr courier',
    bannerUrl: '',
  });
  const [bannerForm, setBannerForm] = useState({ title: '', linkUrl: '' });

  const applyStore = (row: any) => {
    setSelectedId(row.id);
    setForm({
      name: row.name || '',
      category: row.category || 'Fashion',
      description: row.description || '',
      hours: row.hours_json?.mon_sun || row.hours || '9:00 AM – 9:00 PM',
      deliveryMode: row.default_delivery_mode || 'Movr courier',
      bannerUrl: row.banner_url || '',
    });
  };

  const loadBanners = async (storeId: string) => {
    const res = await axios.get(`${API}/merchant/stores/${storeId}/banners`, { headers: headers() });
    setBanners(res.data.data || []);
  };

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    const rows = res.data.data || [];
    setStores(rows);
    if (rows[0]) {
      applyStore(rows[0]);
      await loadBanners(rows[0].id);
    }
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
        description: form.description,
        hoursJson: { mon_sun: form.hours },
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

  const addPromoBanner = async (file?: File | null) => {
    if (!selectedId) {
      toast.error('Save the store first');
      return;
    }
    if (!file) return;
    try {
      const imageUrl = await uploadCatalogImage(file, token());
      await axios.post(
        `${API}/merchant/stores/${selectedId}/banners`,
        {
          title: bannerForm.title || undefined,
          linkUrl: bannerForm.linkUrl || undefined,
          imageUrl,
          sortOrder: banners.length,
        },
        { headers: headers() }
      );
      setBannerForm({ title: '', linkUrl: '' });
      toast.success('Promo banner added');
      await loadBanners(selectedId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  const toggleBanner = async (b: Banner) => {
    await axios.patch(
      `${API}/merchant/stores/${selectedId}/banners/${b.id}`,
      { isActive: !b.is_active },
      { headers: headers() }
    );
    await loadBanners(selectedId);
  };

  const removeBanner = async (b: Banner) => {
    await axios.delete(`${API}/merchant/stores/${selectedId}/banners/${b.id}`, {
      headers: headers(),
    });
    await loadBanners(selectedId);
  };

  return (
    <MerchantShell activePath="/merchant/store">
      <h1 className="text-3xl font-bold mb-6">Store profile</h1>

      <label className="block w-full h-36 rounded-2xl border border-dashed border-border bg-surface-elevated flex items-center justify-center text-text-secondary mb-6 cursor-pointer overflow-hidden">
        {form.bannerUrl ? (
          <img src={mediaUrl(form.bannerUrl)} alt="Banner" className="h-full w-full object-cover" />
        ) : (
          <span>Upload store hero banner</span>
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
            <span className="text-sm text-text-secondary">Store name</span>
            <input
              className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Store category</span>
            <input
              className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Opening hours</span>
            <input
              className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
              value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-sm text-text-secondary">Delivery mode</span>
            <select
              className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
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
          <span className="text-sm text-text-secondary">Description</span>
          <textarea
            className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3 min-h-[88px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>

        <button type="submit" className="rounded-xl px-6 py-3 font-semibold bg-movr-gradient">
          Save changes
        </button>
      </form>

      {selectedId ? (
        <section className="mt-10 max-w-3xl space-y-4">
          <h2 className="text-xl font-semibold">Promo banners</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              className="rounded-xl bg-surface-elevated border border-border px-3 py-2"
              placeholder="Title (optional)"
              value={bannerForm.title}
              onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
            />
            <input
              className="rounded-xl bg-surface-elevated border border-border px-3 py-2"
              placeholder="Link URL (optional)"
              value={bannerForm.linkUrl}
              onChange={(e) => setBannerForm({ ...bannerForm, linkUrl: e.target.value })}
            />
            <label className="rounded-xl bg-movr-gradient px-3 py-2 font-semibold text-center cursor-pointer">
              Upload banner
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => addPromoBanner(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="space-y-3">
            {banners.length === 0 ? (
              <p className="text-text-secondary text-sm">No promo banners yet.</p>
            ) : (
              banners.map((b) => (
                <div
                  key={b.id}
                  className="flex gap-3 items-center border border-border rounded-xl p-3 bg-surface"
                >
                  <img
                    src={mediaUrl(b.image_url)}
                    alt={b.title || 'Banner'}
                    className="w-28 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.title || 'Untitled'}</p>
                    <p className="text-xs text-text-secondary truncate">{b.link_url || '—'}</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-motion-blue"
                    onClick={() => toggleBanner(b)}
                  >
                    {b.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    type="button"
                    className="text-sm text-error"
                    onClick={() => removeBanner(b)}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {stores.length > 1 ? (
        <div className="mt-8 space-y-2">
          <p className="text-sm text-text-secondary">Your stores</p>
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={async () => {
                applyStore(s);
                await loadBanners(s.id);
              }}
              className={`block w-full text-left rounded-xl border px-4 py-3 ${
                selectedId === s.id ? 'border-electric-violet' : 'border-border'
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
