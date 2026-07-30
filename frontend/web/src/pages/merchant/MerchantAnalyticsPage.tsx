import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

export default function MerchantAnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    axios
      .get(`${API}/merchant/analytics`, { headers: headers() })
      .then((res) => setData(res.data.data))
      .catch((e) => toast.error(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-jet-black text-pure-white p-6">
      <Link to="/merchant/dashboard" className="text-motion-blue text-sm">← Dashboard</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-2">Analytics</h1>
      <p className="text-text-secondary mb-6">Your storefront only — not platform GMV.</p>

      {!data ? (
        <p className="text-text-secondary">Loading…</p>
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-border rounded-md p-4">
              <div className="text-text-secondary text-sm">Avg order value</div>
              <div className="text-2xl font-semibold">GHS {Number(data.averageOrderValue).toFixed(2)}</div>
            </div>
            <div className="bg-surface border border-border rounded-md p-4">
              <div className="text-text-secondary text-sm">Repeat customer rate</div>
              <div className="text-2xl font-semibold">{(Number(data.repeatCustomerRate) * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-surface border border-border rounded-md p-4">
              <div className="text-text-secondary text-sm">Top products</div>
              <div className="text-2xl font-semibold">{data.topProducts?.length || 0}</div>
            </div>
          </div>

          <h2 className="font-semibold mb-3">Sales (30 days)</h2>
          <div className="space-y-2 mb-8">
            {(data.salesOverTime || []).map((d: any) => (
              <div key={String(d.day)} className="flex justify-between border border-border rounded-md px-4 py-2 text-sm">
                <span>{new Date(d.day).toLocaleDateString()}</span>
                <span>GHS {Number(d.sales).toFixed(2)} · {d.orders} orders</span>
              </div>
            ))}
          </div>

          <h2 className="font-semibold mb-3">Top sellers</h2>
          <div className="space-y-2">
            {(data.topProducts || []).map((p: any) => (
              <div key={p.product_name} className="flex justify-between border border-border rounded-md px-4 py-2 text-sm">
                <span>{p.product_name}</span>
                <span>{p.qty} sold · GHS {Number(p.revenue).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
