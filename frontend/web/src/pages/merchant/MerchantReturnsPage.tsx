import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const token = () => localStorage.getItem('movr_merchant_token') || '';
const headers = () => ({ Authorization: `Bearer ${token()}` });

/** Merchant returns queue — accept/deny + refund amount. */
export default function MerchantReturnsPage() {
  const { formatMoney } = useLocalCurrency();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/merchant/returns`, { headers: headers() });
      setRows(r.data?.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = async (id: string, status: string, refundAmount?: number) => {
    try {
      await axios.patch(
        `${API}/merchant/returns/${id}`,
        { status, refundAmount, merchantNote: status },
        { headers: headers() }
      );
      toast.success(`Marked ${status}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    }
  };

  return (
    <MerchantShell activePath="/merchant/returns">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Returns</h1>
        <p className="text-[#888888] mt-1">Review customer return requests</p>
      </div>

      {loading ? <p className="text-[#888888]">Loading…</p> : null}

      <div className="space-y-3">
        {rows.length === 0 && !loading ? (
          <p className="text-[#888888]">No returns yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl bg-[#1A1A1A] p-4 text-white">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    Order #{r.public_ref || String(r.order_id).slice(-4)} · {r.store_name}
                  </p>
                  <p className="text-sm text-[#AAAAAA] mt-1">{r.customer_name || 'Customer'}</p>
                  <p className="text-sm mt-2">{r.reason}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-zinc-800 capitalize">
                    {r.status}
                  </span>
                  <p className="mt-2 font-bold">
                    {formatMoney(Number(r.refund_amount ?? r.order_total ?? 0))}
                  </p>
                </div>
              </div>
              {r.status === 'requested' ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-700"
                    onClick={() => patch(r.id, 'approved', Number(r.refund_amount || r.order_total || 0))}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-sm font-semibold bg-blue-700"
                    onClick={() => patch(r.id, 'refunded', Number(r.refund_amount || r.order_total || 0))}
                  >
                    Mark refunded
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-sm font-semibold bg-red-900"
                    onClick={() => patch(r.id, 'denied')}
                  >
                    Deny
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </MerchantShell>
  );
}
