import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` };
}

export default function MerchantDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
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

  return (
    <div className="min-h-screen bg-jet-black text-pure-white">
      <aside className="fixed left-0 top-0 bottom-0 w-56 border-r border-border p-4 space-y-3">
        <div className="font-semibold text-lg mb-6">Merchant</div>
        <Link to="/merchant/dashboard">Orders</Link>
        <Link to="/merchant/store" className="block">Store</Link>
        <Link to="/merchant/products" className="block">Products</Link>
        <Link to="/merchant/analytics" className="block">Analytics</Link>
        <Link to="/merchant/payouts" className="block">Payouts</Link>
      </aside>

      <main className="ml-56 p-6">
        <h1 className="text-2xl font-semibold mb-2">Orders inbox</h1>
        <p className="text-text-secondary mb-6">Accept, reject, choose delivery mode.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {earnings.slice(0, 3).map((e) => (
            <div key={String(e.bucket)} className="bg-surface border border-border rounded-md p-4">
              <div className="text-text-secondary text-sm">{new Date(e.bucket).toLocaleDateString()}</div>
              <div className="text-xl font-semibold mt-1">GHS {Number(e.gmv).toFixed(2)}</div>
              <div className="text-sm text-text-secondary">{e.orders} orders</div>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          {orders.map((o) => (
            <div key={o.id} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 border-b border-border items-center">
              <div className="md:col-span-2">
                <div className="font-medium">{o.id.slice(0, 8)}</div>
                <div className="text-sm text-text-secondary">{o.status} · {o.fulfillment_type}</div>
              </div>
              <div>GHS {Number(o.total).toFixed(2)}</div>
              <div className="flex gap-2 flex-wrap">
                <button className="rounded-pill px-3 py-1 bg-movr-gradient text-sm" onClick={() => act(o.id, 'accept')}>Accept</button>
                <button className="rounded-pill px-3 py-1 border border-border text-sm" onClick={() => act(o.id, 'reject')}>Reject</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className="rounded-pill px-3 py-1 border border-electric-violet text-sm" onClick={() => setDeliveryMode(o.id, 'movr_courier')}>MOVR courier</button>
                <button className="rounded-pill px-3 py-1 border border-border text-sm" onClick={() => setDeliveryMode(o.id, 'merchant_own')}>Own delivery</button>
              </div>
              <button className="text-motion-blue text-sm text-left" onClick={() => openTracking(o)}>Track</button>
            </div>
          ))}
          {!orders.length ? <div className="p-6 text-text-secondary">No orders yet.</div> : null}
        </div>

        {selected && tracking ? (
          <div className="mt-6 bg-surface border border-border rounded-lg p-4">
            <h2 className="font-semibold mb-2">Tracking · {tracking.room}</h2>
            <p className="text-text-secondary text-sm mb-3">
              Mode: {tracking.deliveryMode || 'unset'} · Courier: {tracking.courierId || 'none'}
            </p>
            <div className="h-48 rounded-md bg-surface-elevated border border-border flex items-center justify-center text-text-secondary">
              Live map widget (socket {tracking.room})
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
