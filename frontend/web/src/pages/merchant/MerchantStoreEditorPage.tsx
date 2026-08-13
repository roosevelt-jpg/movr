import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ImageIcon, Plus, Trash2 } from 'lucide-react';
import MerchantShell from '../../layouts/MerchantShell';
import { mediaUrl, uploadCatalogImage } from '../../lib/media';
import ResponsiveMedia, { isMediaVideo } from '../../components/ResponsiveMedia';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

type BannerRow = {
  id: string;
  title?: string;
  image_url?: string;
  link_url?: string;
  sort_order?: number;
  is_active?: boolean;
};

/** Store profile editor — details + primary banner + carousel (CMS-style uploads → /assets). */
export default function MerchantStoreEditorPage() {
  const [selectedId, setSelectedId] = useState('');
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [busyBanner, setBusyBanner] = useState(false);
  const [storeCode, setStoreCode] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'Fashion',
    hours: '9:00 AM – 9:00 PM',
    deliveryMode: 'Movr courier',
    bannerUrl: '',
    logoUrl: '',
    seoTitle: '',
    seoDescription: '',
    address: '',
  });

  const applyStore = (row: any) => {
    setSelectedId(row.id);
    setStoreCode(row.store_code || row.storeCode || '');
    setForm({
      name: row.name || '',
      description: row.description || '',
      category: row.category || 'Fashion',
      hours:
        row.hours_json?.mon_sun ||
        row.hours_json?.label ||
        row.hours ||
        '9:00 AM – 9:00 PM',
      deliveryMode: row.default_delivery_mode || 'Movr courier',
      bannerUrl: row.banner_url || '',
      logoUrl: row.logo_url || '',
      seoTitle: row.seo_title || '',
      seoDescription: row.seo_description || '',
      address: row.address || '',
    });
  };

  const shareUrl =
    selectedId && typeof window !== 'undefined'
      ? `${window.location.origin}/store/${storeCode || selectedId}`
      : '';

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Store link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const loadBanners = async (storeId: string) => {
    try {
      const res = await axios.get(`${API}/merchant/stores/${storeId}/banners`, {
        headers: headers(),
      });
      setBanners(res.data.data || []);
    } catch {
      setBanners([]);
    }
  };

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    const rows = res.data.data || [];
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
        description: form.description || undefined,
        category: form.category,
        hoursJson: { mon_sun: form.hours, label: form.hours },
        defaultDeliveryMode: form.deliveryMode,
        bannerUrl: form.bannerUrl || undefined,
        logoUrl: form.logoUrl || undefined,
        seoTitle: form.seoTitle || undefined,
        seoDescription: form.seoDescription || undefined,
        address: form.address || undefined,
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
        if (created.data.data?.id) await loadBanners(created.data.data.id);
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
      const url = await uploadCatalogImage(file, token(), 'banner');
      setForm((f) => ({ ...f, bannerUrl: url }));
      if (selectedId) {
        await axios.patch(
          `${API}/merchant/stores/${selectedId}`,
          { bannerUrl: url },
          { headers: headers() }
        );
        toast.success('Primary banner saved');
      } else {
        toast.success('Banner uploaded — click Save to create the store');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addCarouselBanner = async (file?: File | null) => {
    if (!file || !selectedId) {
      toast.error('Save the store first, then add carousel banners');
      return;
    }
    setBusyBanner(true);
    try {
      const url = await uploadCatalogImage(file, token(), 'banner');
      await axios.post(
        `${API}/merchant/stores/${selectedId}/banners`,
        {
          imageUrl: url,
          title: form.name || 'Banner',
          sortOrder: banners.length,
          isActive: true,
        },
        { headers: headers() }
      );
      toast.success('Carousel banner added');
      await loadBanners(selectedId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message || 'Failed');
    } finally {
      setBusyBanner(false);
    }
  };

  const patchBanner = async (b: BannerRow, patch: Partial<BannerRow>) => {
    if (!selectedId) return;
    try {
      await axios.patch(
        `${API}/merchant/stores/${selectedId}/banners/${b.id}`,
        {
          title: patch.title ?? b.title,
          linkUrl: patch.link_url ?? b.link_url,
          sortOrder: patch.sort_order ?? b.sort_order,
          isActive: patch.is_active ?? b.is_active,
          ...(patch.image_url ? { imageUrl: patch.image_url } : {}),
        },
        { headers: headers() }
      );
      await loadBanners(selectedId);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  const onLogoUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      const url = await uploadCatalogImage(file, token(), 'avatar');
      setForm((f) => ({ ...f, logoUrl: url }));
      if (selectedId) {
        await axios.patch(
          `${API}/merchant/stores/${selectedId}`,
          { logoUrl: url },
          { headers: headers() }
        );
        toast.success('Store logo saved');
      } else {
        toast.success('Logo uploaded — click Save to create the store');
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeBanner = async (b: BannerRow) => {
    if (!selectedId || !window.confirm('Remove this banner?')) return;
    try {
      await axios.delete(`${API}/merchant/stores/${selectedId}/banners/${b.id}`, {
        headers: headers(),
      });
      await loadBanners(selectedId);
      toast.success('Banner removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  return (
    <MerchantShell activePath="/merchant/store">
      <h1 className="text-3xl font-bold text-white mb-2">Store profile</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Banners auto-resize and save under /assets. Edit anytime — changes show on the customer
        storefront.
      </p>

      {shareUrl ? (
        <div className="rounded-2xl border border-white/10 bg-[#111] p-4 mb-6">
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Share your storefront</p>
          <p className="text-sm text-zinc-300 break-all mb-3">{shareUrl}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyShareLink}
              className="rounded-full bg-white text-black text-sm font-bold px-4 py-2"
            >
              Copy link
            </button>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-zinc-800 text-white text-sm font-bold px-4 py-2"
            >
              Preview
            </a>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="w-24 h-24 rounded-2xl border border-dashed border-white/25 bg-[#111] flex flex-col items-center justify-center text-[#888888] cursor-pointer overflow-hidden relative shrink-0">
          {form.logoUrl ? (
            <img src={mediaUrl(form.logoUrl)} alt="Logo" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <ImageIcon size={22} className="mb-1 opacity-60" />
              <span className="text-[10px] text-center px-1">Store logo</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogoUpload(e.target.files?.[0])}
          />
        </label>
        <p className="text-sm text-zinc-500 max-w-sm">
          Square logo appears on your storefront and in WhatsApp / social share previews.
        </p>
      </div>

      <label className="block w-full aspect-[21/9] max-h-56 rounded-2xl border border-dashed border-white/25 bg-[#111] flex flex-col items-center justify-center text-[#888888] mb-6 cursor-pointer overflow-hidden relative">
        {form.bannerUrl ? (
          isMediaVideo(form.bannerUrl) ? (
            <video
              src={mediaUrl(form.bannerUrl)}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img
              src={mediaUrl(form.bannerUrl)}
              alt="Banner"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )
        ) : (
          <>
            <ImageIcon size={28} className="mb-2 opacity-60" />
            <span className="text-sm">Upload primary store banner (image or video)</span>
          </>
        )}
        <input
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => onHeroUpload(e.target.files?.[0])}
        />
      </label>

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="text-sm text-[#888888]">Store name</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-[#888888]">Description</span>
            <textarea
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white min-h-[96px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tell customers what makes your shop special"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-[#888888]">SEO / share title (optional)</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.seoTitle}
              onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
              placeholder={`${form.name || 'Store name'} · Movr`}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm text-[#888888]">SEO / share description (optional)</span>
            <textarea
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white min-h-[72px]"
              value={form.seoDescription}
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
              placeholder="Short text shown when customers share your store link"
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
          <label className="block">
            <span className="text-sm text-[#888888]">Address</span>
            <input
              className="mt-2 w-full rounded-xl bg-[#1A1A1A] border border-white/10 px-4 py-3 text-white"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street, city"
            />
          </label>
        </div>

        <button type="submit" className="rounded-xl px-6 py-3 font-semibold bg-movr-gradient text-white">
          Save changes
        </button>
      </form>

      <section className="mt-10 max-w-3xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Banner carousel</h2>
            <p className="text-xs text-zinc-500 mt-1">Extra slides on your storefront (image or video).</p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-sm font-semibold text-white cursor-pointer">
            <Plus size={16} />
            {busyBanner ? 'Uploading…' : 'Add banner'}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              className="hidden"
              disabled={busyBanner || !selectedId}
              onChange={(e) => addCarouselBanner(e.target.files?.[0])}
            />
          </label>
        </div>

        {banners.length === 0 ? (
          <p className="text-sm text-zinc-500">No carousel banners yet.</p>
        ) : (
          <ul className="space-y-4">
            {banners.map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-white/10 bg-[#111] overflow-hidden"
              >
                <ResponsiveMedia src={b.image_url} aspect="21/9" className="max-h-40" />
                <div className="p-4 space-y-3">
                  <input
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white text-sm"
                    defaultValue={b.title || ''}
                    placeholder="Title"
                    onBlur={(e) => patchBanner(b, { title: e.target.value })}
                  />
                  <input
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white text-sm"
                    defaultValue={b.link_url || ''}
                    placeholder="Optional link URL"
                    onBlur={(e) => patchBanner(b, { link_url: e.target.value } as any)}
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-400 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={b.is_active !== false}
                        onChange={(e) => patchBanner(b, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="text-red-400 text-sm inline-flex items-center gap-1"
                      onClick={() => removeBanner(b)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MerchantShell>
  );
}
