import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` };
}

/** Merchant orders dashboard — uses shared shell. */
export default function MerchantDashboardPage() {
  const navigate = useNavigate();
  const { formatMoney } = useLocalCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');
  const [selected, setSelected] = useState<any>(null);
  const [tracking, setTracking] = useState<any>(null);

  const load = async () => {
    const [o, e] = await Promise.all([
      axios.get(`${API}/merchant/orders`, { headers: authHeaders() }),
      axios.get(`${API}/merchant/earnings?period=daily`, { headers: authHeaders() }),
    ]);
    setOrders(o.data.data || []);
    setEarnings(e.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  const pendingCount = orders.filter((o) =>
    ['pending', 'placed', 'awaiting_acceptance'].includes(String(o.status))
  ).length;

  const visible = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) =>
      ['pending', 'placed', 'awaiting_acceptance'].includes(String(o.status))
    );
  }, [orders, filter]);

  const stats = useMemo(() => {
    const today = earnings[0];
    const sales = Number(today?.gmv || 0);
    const count = Number(today?.orders || orders.length || 0);
    return {
      sales,
      orders: count,
      avg: count ? sales / count : 0,
    };
  }, [earnings, orders]);

  const act = async (id: string, action: 'accept' | 'reject') => {
    await axios.patch(`${API}/merchant/orders/${id}/${action}`, {}, { headers: authHeaders() });
    toast.success(action === 'accept' ? 'Order accepted' : 'Order rejected');
    await load();
  };

  const setDeliveryMode = async (id: string, deliveryMode: 'movr_courier' | 'merchant_own') => {
    await axios.patch(
      `${API}/merchant/orders/${id}/delivery-mode`,
      { deliveryMode },
      { headers: authHeaders() }
    );
    toast.success(`Delivery: ${deliveryMode}`);
    await load();
  };

  const openTracking = async (order: any) => {
    setSelected(order);
    const res = await axios.get(`${API}/merchant/orders/${order.id}/tracking`, {
      headers: authHeaders(),
    });
    setTracking(res.data.data);
  };

  const statusBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s.includes('prepar')) return 'bg-[#0055FF]/25 text-[#8FB3FF] border-[#0055FF]/40';
    if (s.includes('delivery') || s.includes('courier'))
      return 'bg-[#FFB800]/15 text-[#FFB800] border-[#FFB800]/40';
    return 'bg-[#2A2A2A] text-[#A0A0A0] border-[#2A2A2A]';
  };

  return (
    <MerchantShell activePath="/merchant/dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-1.5 text-sm border ${
              filter === 'all' ? 'border-white text-white' : 'border-[#2A2A2A] text-[#A0A0A0]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-full px-4 py-1.5 text-sm border ${
              filter === 'pending' ? 'border-[#0055FF] text-white' : 'border-[#2A2A2A] text-[#A0A0A0]'
            }`}
          >
            Pending ({pendingCount})
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {visible.map((o) => {
          const pending = ['pending', 'placed', 'awaiting_acceptance'].includes(String(o.status));
          return (
            <div
              key={o.id}
              className="rounded-2xl bg-[#141414] border border-[#2A2A2A] p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold">
                  Order #{String(o.id).slice(0, 4).toUpperCase()}
                  {o.customer_name ? ` · ${o.customer_name}` : ''}
                </p>
                <p className="text-sm text-[#A0A0A0] mt-1">
                  {o.item_count || o.items_count || '—'} items · {formatMoney(Number(o.total || 0))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {pending ? (
                  <>
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold bg-[#3F7048]"
                      onClick={() => act(o.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold border border-[#FF3B5C]/50 text-[#FF3B5C]"
                      onClick={() => act(o.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className={`rounded-lg px-3 py-1.5 text-sm border ${statusBadge(o.status)}`}>
                    {o.status}
                  </span>
                )}
                <button
                  className="text-sm text-[#0055FF]"
                  onClick={() => navigate(`/merchant/orders/${o.id}`)}
                >
                  View
                </button>
                <button
                  className="text-sm text-[#A0A0A0]"
                  onClick={() => openTracking(o).catch((e) => toast.error(e.message))}
                >
                  Track
                </button>
                <button
                  className="text-xs text-[#A0A0A0]"
                  onClick={() => setDeliveryMode(o.id, 'movr_courier')}
                >
                  MOVR courier
                </button>
              </div>
            </div>
          );
        })}
        {!visible.length ? <p className="text-[#A0A0A0]">No orders in this filter.</p> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Today's sales",
            value: formatMoney(stats.sales),
          },
          { label: 'Orders', value: String(stats.orders) },
          { label: 'Avg order', value: formatMoney(stats.avg) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#141414] border border-[#2A2A2A] p-5">
            <p className="text-sm text-[#A0A0A0]">{s.label}</p>
            <p className="text-3xl font-bold mt-3">{s.value}</p>
          </div>
        ))}
      </div>

      {selected && tracking ? (
        <div className="mt-6 rounded-2xl bg-[#141414] border border-[#2A2A2A] p-4">
          <h2 className="font-semibold mb-2">Tracking · {tracking.room}</h2>
          <p className="text-[#A0A0A0] text-sm">
            Mode: {tracking.deliveryMode || 'unset'} · Courier: {tracking.courierId || 'none'}
          </p>
        </div>
      ) : null}
    </MerchantShell>
  );
}
