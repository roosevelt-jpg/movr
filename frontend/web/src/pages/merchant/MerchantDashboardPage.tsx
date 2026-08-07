import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import OrderTrackingWidget from '../../components/OrderTrackingWidget';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` };
}

const PENDING = ['pending_payment', 'paid', 'pending', 'placed', 'awaiting_acceptance'];

function statusLabel(status: string) {
  const s = String(status).toLowerCase();
  if (s === 'preparing' || s === 'accepted') return 'Preparing.';
  if (s === 'out_for_delivery') return 'Out for delivery.';
  if (s === 'ready_for_pickup') return 'Ready for pickup';
  if (s === 'completed') return 'Completed';
  if (s === 'rejected' || s === 'cancelled') return s.charAt(0).toUpperCase() + s.slice(1);
  return status;
}

/** Merchant orders dashboard — Accept/Reject, Preparing, Out for delivery, live stats. */
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

  const pendingCount = orders.filter((o) => PENDING.includes(String(o.status))).length;

  const visible = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => PENDING.includes(String(o.status)));
  }, [orders, filter]);

  const stats = useMemo(() => {
    const today = earnings[0];
    const sales = Number(today?.gmv || 0);
    const count = Number(today?.orders || 0);
    return {
      sales,
      orders: count,
      avg: count ? sales / count : 0,
    };
  }, [earnings]);

  const act = async (id: string, action: 'accept' | 'reject' | 'out-for-delivery' | 'preparing') => {
    await axios.patch(`${API}/merchant/orders/${id}/${action}`, {}, { headers: authHeaders() });
    toast.success(
      action === 'accept'
        ? 'Order accepted'
        : action === 'reject'
          ? 'Order rejected'
          : action === 'out-for-delivery'
            ? 'Out for delivery'
            : 'Marked preparing'
    );
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
    if (s.includes('prepar') || s === 'accepted')
      return 'bg-motion-blue/25 text-motion-blue border-motion-blue/40';
    if (s.includes('delivery') || s.includes('courier'))
      return 'bg-warning/15 text-warning border-warning/40';
    return 'bg-border text-text-secondary border-border';
  };

  const orderRef = (id: string) => {
    const n = String(id).replace(/-/g, '').slice(-4).toUpperCase();
    return n || String(id).slice(0, 4).toUpperCase();
  };

  return (
    <MerchantShell activePath="/merchant/dashboard">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-4 py-1.5 text-sm border ${
              filter === 'all' ? 'border-pure-white text-pure-white' : 'border-border text-text-secondary'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-full px-4 py-1.5 text-sm border ${
              filter === 'pending'
                ? 'bg-surface-elevated border-border text-pure-white'
                : 'border-border text-text-secondary'
            }`}
          >
            Pending ({pendingCount})
          </button>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {visible.map((o) => {
          const pending = PENDING.includes(String(o.status));
          const preparing = ['accepted', 'preparing'].includes(String(o.status));
          return (
            <div
              key={o.id}
              className="rounded-2xl bg-surface-elevated border border-border p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-semibold">
                  Order #{orderRef(o.id)}
                  {o.customer_name ? ` · ${o.customer_name}` : ''}
                </p>
                <p className="text-sm text-text-secondary mt-1">
                  {o.item_count ?? '—'} items · {formatMoney(Number(o.total || 0))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {pending ? (
                  <>
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold bg-success text-jet-black"
                      onClick={() => act(o.id, 'accept')}
                    >
                      Accept
                    </button>
                    <button
                      className="rounded-lg px-4 py-2 text-sm font-semibold bg-error/80 text-pure-white"
                      onClick={() => act(o.id, 'reject')}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <span className={`rounded-lg px-3 py-1.5 text-sm border ${statusBadge(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                    {preparing ? (
                      <button
                        className="rounded-lg px-3 py-1.5 text-sm border border-warning/40 text-warning"
                        onClick={() => act(o.id, 'out-for-delivery')}
                      >
                        Out for delivery
                      </button>
                    ) : null}
                  </>
                )}
                <button
                  className="text-sm text-motion-blue"
                  onClick={() => navigate(`/merchant/orders/${o.id}`)}
                >
                  View
                </button>
                <button
                  className="text-sm text-text-secondary"
                  onClick={() => openTracking(o).catch((e) => toast.error(e.message))}
                >
                  Track
                </button>
                <button
                  className="text-xs text-text-secondary"
                  onClick={() => setDeliveryMode(o.id, 'movr_courier')}
                >
                  MOVR courier
                </button>
              </div>
            </div>
          );
        })}
        {!visible.length ? <p className="text-text-secondary">No orders in this filter.</p> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Today's sales", value: formatMoney(stats.sales) },
          { label: 'Orders', value: String(stats.orders) },
          { label: 'Avg order', value: formatMoney(stats.avg) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-elevated border border-border p-5">
            <p className="text-sm text-text-secondary">{s.label}</p>
            <p className="text-3xl font-bold mt-3">{s.value}</p>
          </div>
        ))}
      </div>

      {selected && tracking ? (
        <div className="mt-6">
          <OrderTrackingWidget
            orderId={String(selected.id)}
            room={tracking.room}
            deliveryMode={tracking.deliveryMode}
            courierId={tracking.courierId}
          />
        </div>
      ) : null}
    </MerchantShell>
  );
}
