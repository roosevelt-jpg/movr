import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` };
}

type BoardOrder = {
  id: string;
  ref: string;
  status: string;
  total: number;
  createdAt: string;
  itemsLabel: string;
  items?: { name: string; quantity: number }[];
  customerName?: string;
  fulfillment?: string;
  prepMinutes: number;
};

type BoardData = {
  store: { id: string; name: string; isOpen: boolean; rating: number } | null;
  kpis: {
    revenueToday: number;
    ordersToday: number;
    pending?: number;
    completed?: number;
    avgOrder: number;
    rating: number;
  };
  columns: {
    new: BoardOrder[];
    preparing: BoardOrder[];
    completed: BoardOrder[];
  };
};

function relativeReceived(iso?: string) {
  if (!iso) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Received just now';
  if (mins < 60) return `Received ${mins} min ago`;
  return `Received ${Math.round(mins / 60)}h ago`;
}

/** Merchant orders board — Open, KPIs, New/Preparing/Completed, Accept/Decline (mockup). */
export default function MerchantDashboardPage() {
  const { formatMoney } = useLocalCurrency();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [storeOpen, setStoreOpen] = useState(true);
  const [tab, setTab] = useState<'new' | 'preparing' | 'completed'>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await axios.get(`${API}/merchant/dashboard-board`, { headers: authHeaders() });
    const data = res.data.data as BoardData;
    setBoard(data);
    if (data?.store) setStoreOpen(Boolean(data.store.isOpen));
  }, []);

  useEffect(() => {
    load().catch((err) => toast.error(err?.response?.data?.message || err.message));
    const t = setInterval(() => load().catch(() => undefined), 20000);
    return () => clearInterval(t);
  }, [load]);

  const accept = async (id: string) => {
    setBusyId(id);
    try {
      await axios.patch(`${API}/merchant/orders/${id}/accept`, {}, { headers: authHeaders() });
      toast.success('Order accepted');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Accept failed');
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id: string) => {
    setBusyId(id);
    try {
      await axios.patch(`${API}/merchant/orders/${id}/reject`, {}, { headers: authHeaders() });
      toast.success('Order declined');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Decline failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleOpen = async () => {
    try {
      await axios.patch(
        `${API}/merchant/store/open`,
        { isOpen: !storeOpen },
        { headers: authHeaders() }
      );
      setStoreOpen(!storeOpen);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    }
  };

  const kpis = board?.kpis;
  const list =
    tab === 'new'
      ? board?.columns.new || []
      : tab === 'preparing'
        ? board?.columns.preparing || []
        : board?.columns.completed || [];

  return (
    <MerchantShell>
      <div className="max-w-2xl mx-auto text-white" data-force-dark>
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={toggleOpen} className="font-bold text-sm">
            <span className={storeOpen ? 'text-green-400' : 'text-zinc-400'}>
              • Store is {storeOpen ? 'Open' : 'Closed'}
            </span>
          </button>
          <p className="text-zinc-400 text-sm">Today&apos;s Revenue</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-2xl bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-extrabold">{kpis?.ordersToday ?? 24}</p>
            <p className="text-xs text-zinc-500 mt-1">Orders</p>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-extrabold text-orange-400">{kpis?.pending ?? 3}</p>
            <p className="text-xs text-zinc-500 mt-1">Pending</p>
          </div>
          <div className="rounded-2xl bg-zinc-900 p-4 text-center">
            <p className="text-2xl font-extrabold text-green-400">{kpis?.completed ?? 21}</p>
            <p className="text-xs text-zinc-500 mt-1">Completed</p>
          </div>
        </div>

        {kpis?.revenueToday != null ? (
          <p className="text-zinc-400 text-sm mb-4 -mt-2">
            Revenue {formatMoney(Number(kpis.revenueToday || 0))}
          </p>
        ) : null}

        <div className="flex gap-2 mb-5">
          {(
            [
              ['new', `New (${board?.columns.new?.length ?? 0})`],
              ['preparing', 'Preparing'],
              ['completed', 'Completed'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                tab === key ? 'bg-orange-400 text-black' : 'bg-zinc-900 text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {list.map((o, idx) => {
            const expanded = tab === 'new' && idx === 0;
            if (expanded) {
              return (
                <div key={o.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-lg">
                      😀
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold">{o.customerName || 'Customer'}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {o.ref} · {o.fulfillment || 'Movr Courier'}
                      </p>
                    </div>
                    <span className="rounded-md border border-amber-500 text-amber-400 text-[10px] font-extrabold px-2 py-0.5">
                      NEW
                    </span>
                  </div>
                  <ul className="text-sm text-zinc-300 space-y-1 mb-3">
                    {(o.items?.length
                      ? o.items
                      : o.itemsLabel.split(',').map((s) => ({ name: s.trim(), quantity: 1 }))
                    ).map((it: any, i: number) => (
                      <li key={i}>
                        {it.name}
                        {it.quantity ? ` × ${it.quantity}` : ''}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-2xl font-extrabold">{formatMoney(o.total)}</p>
                    <p className="text-xs text-zinc-500">{relativeReceived(o.createdAt)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => accept(o.id)}
                      className="rounded-xl py-3 font-extrabold bg-gradient-to-r from-blue-500 to-purple-600"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => decline(o.id)}
                      className="rounded-xl py-3 font-extrabold border border-zinc-600 bg-zinc-900"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={o.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {o.customerName || 'Customer'} · {o.ref}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {o.itemsLabel} · {formatMoney(o.total)}
                  </p>
                </div>
                {tab === 'new' ? (
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => accept(o.id)}
                      className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => decline(o.id)}
                      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-bold"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 capitalize">{o.status}</span>
                )}
              </div>
            );
          })}
          {!list.length ? (
            <p className="text-center text-zinc-500 py-10">No orders in this tab</p>
          ) : null}
        </div>
      </div>
    </MerchantShell>
  );
}
