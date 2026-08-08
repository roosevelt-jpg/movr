import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type DayKey = (typeof DAYS)[number];
type HoursDay = { open: boolean; from: string; to: string };
type HoursMap = Record<DayKey, HoursDay>;

const DEFAULT_HOURS: HoursMap = {
  monday: { open: true, from: '08:00', to: '22:00' },
  tuesday: { open: true, from: '08:00', to: '22:00' },
  wednesday: { open: true, from: '08:00', to: '22:00' },
  thursday: { open: true, from: '08:00', to: '22:00' },
  friday: { open: true, from: '08:00', to: '22:00' },
  saturday: { open: true, from: '09:00', to: '22:00' },
  sunday: { open: false, from: '09:00', to: '18:00' },
};

function normalizeHours(raw: any): HoursMap {
  const out = { ...DEFAULT_HOURS };
  if (!raw || typeof raw !== 'object') return out;
  for (const d of DAYS) {
    const v = raw[d];
    if (v && typeof v === 'object') {
      out[d] = {
        open: v.open !== false && v.closed !== true,
        from: v.from || v.open_time || '08:00',
        to: v.to || v.close_time || '22:00',
      };
    }
  }
  return out;
}

/** Store Settings — info, hours, delivery, open status. */
export default function MerchantSettingsPage() {
  const [store, setStore] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Fast Food',
    description: '',
    phone: '',
    email: '',
    address: '',
    minOrderAmount: '500',
    deliveryRadiusKm: '5',
    avgPrepTimeMinutes: '20',
    useMovrCourier: true,
    useSelfDelivery: false,
    isOpen: true,
    acceptPreorders: false,
  });
  const [hours, setHours] = useState<HoursMap>(DEFAULT_HOURS);

  const load = async () => {
    const res = await axios.get(`${API}/merchant/stores`, { headers: headers() });
    const s = res.data?.data?.[0];
    if (!s) {
      toast.error('No store found — create one under My Store first');
      return;
    }
    setStore(s);
    setForm({
      name: s.name || '',
      category: s.category || 'Fast Food',
      description: s.description || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      minOrderAmount: String(s.min_order_amount ?? 500),
      deliveryRadiusKm: String(s.delivery_radius_km ?? 5),
      avgPrepTimeMinutes: String(s.avg_prep_time_minutes ?? s.prep_time_minutes ?? 20),
      useMovrCourier: s.use_movr_courier !== false,
      useSelfDelivery: Boolean(s.use_self_delivery),
      isOpen: s.is_open !== false,
      acceptPreorders: Boolean(s.accept_preorders),
    });
    setHours(normalizeHours(s.hours_json));
  };

  useEffect(() => {
    load().catch((e) => toast.error(e?.response?.data?.message || e.message));
  }, []);

  const save = async () => {
    if (!store?.id) return;
    setSaving(true);
    try {
      await axios.patch(
        `${API}/merchant/stores/${store.id}`,
        {
          name: form.name,
          category: form.category,
          description: form.description,
          phone: form.phone,
          email: form.email,
          address: form.address,
          minOrderAmount: Number(form.minOrderAmount),
          deliveryRadiusKm: Number(form.deliveryRadiusKm),
          avgPrepTimeMinutes: Number(form.avgPrepTimeMinutes),
          useMovrCourier: form.useMovrCourier,
          useSelfDelivery: form.useSelfDelivery,
          isOpen: form.isOpen,
          acceptPreorders: form.acceptPreorders,
          hoursJson: hours,
        },
        { headers: headers() }
      );
      toast.success('Store settings saved');
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: DayKey, patch: Partial<HoursDay>) => {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }));
  };

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition ${
        checked ? 'bg-[#8E2DE2]' : 'bg-[#333]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${
          checked ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );

  return (
    <MerchantShell activePath="/merchant/settings">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Store Settings</h1>
          <p className="text-[#888888] mt-1">
            {store?.name || 'Store'}
            {store?.store_code ? ` · ${store.store_code}` : store?.id ? ` · ${String(store.id).slice(0, 8)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !store}
          className="rounded-xl px-4 py-2.5 font-semibold bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#1A1A1A] p-5">
          <h2 className="text-white font-semibold mb-4">Store Information</h2>
          <label className="text-xs text-[#888888]">Store Name</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="text-xs text-[#888888]">Category</label>
          <select
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {['Fast Food', 'Restaurant', 'Grocery', 'Pharmacy', 'Other'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="text-xs text-[#888888]">Description</label>
          <textarea
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white min-h-[80px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-[#888888]">Phone</label>
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[#888888]">Email</label>
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <label className="text-xs text-[#888888]">Address</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <label className="text-xs text-[#888888]">Min Order</label>
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.minOrderAmount}
            onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
          />
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] p-5">
          <h2 className="text-white font-semibold mb-4">Operating Hours</h2>
          <div className="space-y-3">
            {DAYS.map((day) => {
              const d = hours[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="w-24 capitalize text-white text-sm">{day}</span>
                  <Toggle checked={d.open} onChange={(v) => setDay(day, { open: v })} />
                  {d.open ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white text-sm"
                        value={d.from}
                        onChange={(e) => setDay(day, { from: e.target.value })}
                      />
                      <span className="text-[#666]">-</span>
                      <input
                        type="time"
                        className="rounded-lg bg-black/40 border border-white/10 px-2 py-1 text-white text-sm"
                        value={d.to}
                        onChange={(e) => setDay(day, { to: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="text-[#888888] text-sm">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] p-5">
          <h2 className="text-white font-semibold mb-4">Delivery Settings</h2>
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <div>
              <p className="text-white text-sm">App Courier (Movr)</p>
              <p className="text-xs text-[#888888]">Movr dispatches courier</p>
            </div>
            <Toggle
              checked={form.useMovrCourier}
              onChange={(v) => setForm({ ...form, useMovrCourier: v })}
            />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <div>
              <p className="text-white text-sm">Self Delivery</p>
              <p className="text-xs text-[#888888]">Your own riders</p>
            </div>
            <Toggle
              checked={form.useSelfDelivery}
              onChange={(v) => setForm({ ...form, useSelfDelivery: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-[#888888]">Delivery Radius (km)</label>
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.deliveryRadiusKm}
                onChange={(e) => setForm({ ...form, deliveryRadiusKm: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[#888888]">Avg Prep Time (min)</label>
              <input
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.avgPrepTimeMinutes}
                onChange={(e) => setForm({ ...form, avgPrepTimeMinutes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#1A1A1A] p-5">
          <h2 className="text-white font-semibold mb-4">Store Status</h2>
          <div className="flex items-center justify-between py-3 border-b border-white/10">
            <div>
              <p className="text-white text-sm">Store Is Open</p>
              <p className="text-xs text-[#888888]">Toggle to close temporarily</p>
            </div>
            <Toggle checked={form.isOpen} onChange={(v) => setForm({ ...form, isOpen: v })} />
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white text-sm">Accept Pre-orders</p>
              <p className="text-xs text-[#888888]">Allow orders when closed</p>
            </div>
            <Toggle
              checked={form.acceptPreorders}
              onChange={(v) => setForm({ ...form, acceptPreorders: v })}
            />
          </div>
        </div>
      </div>
    </MerchantShell>
  );
}
