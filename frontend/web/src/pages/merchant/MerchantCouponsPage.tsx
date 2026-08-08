import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

/** Merchant coupons — stats, table, create form. */
export default function MerchantCouponsPage() {
  const { formatMoney } = useLocalCurrency();
  const [stats, setStats] = useState({
    active: 0,
    total: 0,
    redemptions: 0,
    avgDiscount: 0,
    newUsersAcquired: 0,
  });
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    code: '',
    discountType: 'percent',
    discountValue: '',
    minOrderAmount: '',
    maxUses: '',
    startsAt: '',
    endsAt: '',
    newCustomersOnly: false,
  });

  const load = async () => {
    const [s, c] = await Promise.all([
      axios.get(`${API}/merchant/coupons/stats`, { headers: headers() }),
      axios.get(`${API}/merchant/coupons`, { headers: headers() }),
    ]);
    setStats(s.data.data || stats);
    setRows(c.data.data || []);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e?.response?.data?.message || e.message));
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      code: '',
      discountType: 'percent',
      discountValue: '',
      minOrderAmount: '',
      maxUses: '',
      startsAt: '',
      endsAt: '',
      newCustomersOnly: false,
    });
  };

  const startEdit = (c: any) => {
    setEditing(c);
    setForm({
      code: c.code || '',
      discountType: c.discount_type || 'percent',
      discountValue: String(c.discount_value ?? ''),
      minOrderAmount: String(c.min_order_value ?? ''),
      maxUses: String(c.max_redemptions ?? ''),
      startsAt: c.starts_at ? String(c.starts_at).slice(0, 10) : '',
      endsAt: (c.ends_at || c.expires_at) ? String(c.ends_at || c.expires_at).slice(0, 10) : '',
      newCustomersOnly: Boolean(c.new_users_only),
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        newCustomersOnly: form.newCustomersOnly,
      };
      if (editing) {
        await axios.patch(`${API}/merchant/coupons/${editing.id}`, payload, { headers: headers() });
        toast.success('Coupon updated');
      } else {
        await axios.post(`${API}/merchant/coupons`, payload, { headers: headers() });
        toast.success('Coupon created');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message);
    }
  };

  const statusPill = (status: string, startsAt?: string) => {
    const s = String(status || 'active').toLowerCase();
    if (s === 'scheduled') {
      return {
        text: startsAt
          ? `Starts ${new Date(startsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
          : 'Scheduled',
        cls: 'bg-orange-950 text-orange-400',
      };
    }
    if (s === 'expired' || s === 'inactive') {
      return { text: 'Inactive', cls: 'bg-red-950 text-red-400' };
    }
    return { text: 'Active', cls: 'bg-emerald-950 text-emerald-400' };
  };

  return (
    <MerchantShell activePath="/merchant/coupons">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Coupons</h1>
          <p className="text-[#888888] mt-1">
            {stats.total || rows.length} coupons · {stats.active} active
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-xl px-4 py-2.5 font-semibold bg-gradient-to-r from-[#8E2DE2] to-[#4A00E0] text-white"
        >
          + Create Coupon
        </button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Coupons', value: String(stats.active) },
          { label: 'Total Redemptions', value: String(stats.redemptions) },
          { label: 'Avg Discount', value: formatMoney(stats.avgDiscount) },
          { label: 'New Users Acquired', value: String(stats.newUsersAcquired) },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-[#1A1A1A] p-5">
            <p className="text-sm text-[#888888]">{c.label}</p>
            <p className="text-3xl font-bold text-white mt-3">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.5fr_360px] gap-4">
        <div className="rounded-2xl bg-[#1A1A1A] p-5">
          <h2 className="text-white font-semibold mb-4">Your Coupons</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#888888] text-left border-b border-white/10">
                  {['Code', 'Type', 'Discount', 'Usage', 'Expires', 'Status', ''].map((h) => (
                    <th key={h} className="py-3 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#888888]">
                      No coupons yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => {
                    const pill = statusPill(c.status, c.starts_at);
                    return (
                      <tr key={c.id} className="border-b border-white/5">
                        <td className="py-3 pr-3 font-mono font-semibold text-white">{c.code}</td>
                        <td className="py-3 pr-3 text-[#AAAAAA]">
                          {String(c.promo_type || 'Order Discount').replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 pr-3 text-white">{c.discountLabel}</td>
                        <td className="py-3 pr-3 text-[#AAAAAA]">{c.usageTerms}</td>
                        <td className="py-3 pr-3 text-[#AAAAAA]">{c.used} used</td>
                        <td className="py-3 pr-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pill.cls}`}>
                            {pill.text}
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            className="text-[#c4b5fd] font-medium"
                            onClick={() => startEdit(c)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#666] mt-4">
            Coupons are shared on the Movr Promotions page. Movr may feature your coupons to nearby
            customers automatically.
          </p>
        </div>

        <form onSubmit={save} className="rounded-2xl bg-[#1A1A1A] p-5 h-fit">
          <h2 className="text-white font-semibold mb-4">
            {editing ? `Edit ${editing.code}` : 'Create New Coupon'}
          </h2>
          <label className="text-xs text-[#888888]">Coupon Code</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white uppercase"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="CRSAVE25"
            required
          />
          <label className="text-xs text-[#888888]">Discount Type</label>
          <select
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}
          >
            <option value="percent">Percentage Off</option>
            <option value="fixed">Fixed Amount</option>
          </select>
          <label className="text-xs text-[#888888]">Discount Value</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            placeholder={form.discountType === 'percent' ? '25%' : '500'}
            required
          />
          <label className="text-xs text-[#888888]">Min Order</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.minOrderAmount}
            onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
            placeholder="2000"
          />
          <label className="text-xs text-[#888888]">Max Uses</label>
          <input
            className="w-full mb-3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            placeholder="100"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 min-w-0">
            <div className="min-w-0">
              <label className="text-xs text-[#888888]">Start Date</label>
              <input
                type="date"
                className="w-full min-w-0 max-w-full box-border rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-[#888888]">End Date</label>
              <input
                type="date"
                className="w-full min-w-0 max-w-full box-border rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-white"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center justify-between py-3 text-white text-sm mb-3">
            New Customers Only
            <input
              type="checkbox"
              checked={form.newCustomersOnly}
              onChange={(e) => setForm({ ...form, newCustomersOnly: e.target.checked })}
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl py-3 font-semibold bg-gradient-to-r from-[#3b82f6] to-[#8E2DE2] text-white"
          >
            {editing ? 'Save Coupon' : 'Create Coupon'}
          </button>
        </form>
      </div>
    </MerchantShell>
  );
}
