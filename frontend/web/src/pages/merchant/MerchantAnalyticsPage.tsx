import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

type Period = 'week' | 'month' | 'year';

/** Merchant Analytics — period toggle, revenue hero, KPI row, daily bars, top items. */
export default function MerchantAnalyticsPage() {
  const { formatMoney } = useLocalCurrency();
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/merchant/analytics`, { headers: headers(), params: { period } })
      .then((res) => setData(res.data.data))
      .catch((e) => toast.error(e?.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const kpis = data?.kpis || {};
  const sales = data?.salesOverTime || [];
  const maxBar = Math.max(...sales.map((s: any) => Number(s.sales || 0)), 1);
  const top = Array.isArray(data?.topProducts) ? data.topProducts : [];
  const delta = Number(kpis.revenueDelta || 0);
  const todayLabel = new Date().toLocaleString('en', { weekday: 'short' });

  return (
    <MerchantShell activePath="/merchant/analytics">
      <div className="mx-auto max-w-lg text-white">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Analytics</h1>
          <div className="flex rounded-full bg-zinc-900 p-1">
            {(['week', 'month', 'year'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-1.5 text-sm capitalize ${
                  period === p
                    ? 'bg-gradient-to-r from-violet-600 to-blue-500 font-semibold text-white'
                    : 'text-zinc-400'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <p className="text-zinc-500">Loading…</p>
        ) : (
          <>
            <div className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-blue-500 p-5">
              <p className="text-xs font-bold tracking-widest text-violet-100/90">
                {kpis.revenueLabel || 'WEEKLY REVENUE'}
              </p>
              <p className="mt-2 text-4xl font-extrabold">{formatMoney(Number(kpis.revenue || 0))}</p>
              <p className={`mt-2 text-sm font-semibold ${delta >= 0 ? 'text-emerald-300' : 'text-red-200'}`}>
                {kpis.vsLabel || 'vs last week'} {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {[
                {
                  value: String(kpis.orders || 0),
                  label: 'Orders',
                  hint: `↑ ${Math.abs(Number(kpis.ordersDelta || 0))}%`,
                  hintCls: 'text-emerald-400',
                },
                {
                  value: formatMoney(Number(kpis.avgOrder || 0)),
                  label: 'Avg order',
                  hint: `↑ ${Math.abs(Number(kpis.avgOrderDelta || 0))}%`,
                  hintCls: 'text-emerald-400',
                },
                {
                  value: `★ ${Number(kpis.rating || 4.8).toFixed(1)}`,
                  label: 'Rating',
                  hint: kpis.ratingStatus || 'Stable',
                  hintCls: 'text-emerald-400',
                },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-lg font-extrabold leading-tight">{c.value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{c.label}</p>
                  <p className={`mt-1 text-xs font-semibold ${c.hintCls}`}>{c.hint}</p>
                </div>
              ))}
            </div>

            <p className="mb-3 text-xs font-bold tracking-widest text-zinc-500">DAILY REVENUE</p>
            {sales.length === 0 ? (
              <p className="mb-6 text-sm text-zinc-500">No sales data yet.</p>
            ) : (
              <div className="mb-6 flex h-40 items-end gap-2">
                {sales.map((b: any, i: number) => {
                  const v = Number(b.sales || 0);
                  const hot = Boolean(b.highlight) || b.label === todayLabel;
                  return (
                    <div key={b.day || i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                      <div
                        className={`w-full rounded-t-md ${
                          hot
                            ? 'bg-gradient-to-b from-blue-400 to-violet-600'
                            : 'bg-violet-950'
                        }`}
                        style={{ height: `${Math.max(8, (v / maxBar) * 100)}%` }}
                        title={`${b.label}: ${formatMoney(v)}`}
                      />
                      <span className={`text-[11px] ${hot ? 'font-bold text-blue-400' : 'text-zinc-500'}`}>
                        {b.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mb-3 text-xs font-bold tracking-widest text-zinc-500">TOP ITEMS</p>
            <div className="space-y-3">
              {top.length === 0 ? (
                <p className="text-sm text-zinc-500">No product sales yet.</p>
              ) : (
                top.slice(0, 5).map((p: any) => (
                  <div key={p.product_name} className="flex items-center gap-3 rounded-2xl bg-zinc-900 px-3 py-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-xl">
                      {p.emoji || '🍽'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.product_name}</p>
                      <p className="text-xs text-zinc-500">{p.qty} orders</p>
                    </div>
                    <p className="font-bold">{formatMoney(Number(p.revenue || 0))}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </MerchantShell>
  );
}
