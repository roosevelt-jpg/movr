import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant analytics — KPI cards, weekly bars, top products. */
export default function MerchantAnalyticsPage() {
  const { formatMoney } = useLocalCurrency();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios
      .get(`${API}/merchant/analytics`, { headers: headers() })
      .then((res) => setData(res.data.data))
      .catch((e) => toast.error(e.message));
  }, []);

  const sales7 = useMemo(() => {
    const rows = data?.salesOverTime || [];
    if (!rows.length) return [];
    return rows.slice(-7).map((d: any) => ({
      label: new Date(d.day).toLocaleDateString(undefined, { weekday: 'short' }),
      value: Number(d.sales || 0),
    }));
  }, [data]);

  const maxBar = Math.max(...sales7.map((s: any) => s.value), 1);
  const salesTotal = sales7.reduce((s: number, r: any) => s + r.value, 0);
  const aov = Number(data?.averageOrderValue ?? 0);
  const repeat = Number(data?.repeatCustomerRate ?? 0) * 100;
  const top = Array.isArray(data?.topProducts) ? data.topProducts : [];

  return (
    <MerchantShell activePath="/merchant/analytics">
      <h1 className="text-3xl font-bold mb-6">Analytics</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Sales (7 days)',
            value: formatMoney(salesTotal),
          },
          { label: 'Avg order value', value: formatMoney(aov) },
          { label: 'Repeat customers', value: `${repeat.toFixed(0)}%` },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-[#121212] border border-[#2A2A2A] p-5">
            <p className="text-sm text-[#A0A0A0]">{c.label}</p>
            <p className="text-3xl font-bold mt-3">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-[#121212] border border-[#2A2A2A] p-5 mb-6">
        <p className="text-sm text-[#A0A0A0] mb-4">Sales this week</p>
        {sales7.length === 0 ? (
          <p className="text-[#A0A0A0] text-sm py-8 text-center">No sales data yet.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {sales7.map((b: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#0055FF] to-[#6A00FF]"
                  style={{ height: `${Math.max(8, (b.value / maxBar) * 100)}%` }}
                  title={`${b.value}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-sm text-[#A0A0A0] mb-3">Top products</p>
      {top.length === 0 ? (
        <p className="text-[#A0A0A0] text-sm">No product sales yet.</p>
      ) : (
        <div className="space-y-2">
          {top.slice(0, 5).map((p: any) => (
            <div
              key={p.product_name}
              className="flex justify-between rounded-xl bg-[#121212] border border-[#2A2A2A] px-4 py-3"
            >
              <span className="font-medium">{p.product_name}</span>
              <span className="text-[#A0A0A0]">{p.qty} sold</span>
            </div>
          ))}
        </div>
      )}
    </MerchantShell>
  );
}
