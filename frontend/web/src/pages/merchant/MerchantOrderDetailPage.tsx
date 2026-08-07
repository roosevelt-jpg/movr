import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

function relativePlaced(iso?: string, customerShort?: string) {
  if (!iso) return customerShort ? `· ${customerShort}` : '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const when = sameDay ? `Placed today, ${time}` : `Placed ${d.toLocaleDateString()} ${time}`;
  return customerShort ? `${when} · ${customerShort}` : when;
}

/** Merchant order detail — Order #4821 mockup wired. */
export default function MerchantOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney } = useLocalCurrency();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await axios.get(`${API}/merchant/orders/${id}`, { headers: headers() });
      const o = res.data.data;
      if (!o) {
        setOrder(null);
        setNotFound(true);
        return;
      }
      const short = o.customer_short || o.customer_name || 'Customer';
      setOrder({
        id: o.public_ref || o.display_ref || String(o.id).replace(/\D/g, '').slice(-4) || id,
        rawId: o.id,
        status: o.status || 'preparing',
        placedLabel: relativePlaced(o.created_at, short),
        total: Number(o.total || 0),
        items: Array.isArray(o.items) ? o.items : [],
        delivery: {
          line1:
            o.delivery_mode === 'merchant_own'
              ? 'Merchant own delivery'
              : 'Movr courier · assigned',
          line2: o.delivery_address || o.delivery_recipient || '',
          line3: o.fulfillment_type === 'pickup' ? 'Pickup' : 'Standard delivery',
        },
      });
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNotFound(true);
        setOrder(null);
      } else {
        toast.error(e?.message || 'Failed to load order');
        setOrder(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const markReady = async () => {
    try {
      await axios.patch(
        `${API}/merchant/orders/${order.rawId || id}/ready`,
        {},
        { headers: headers() }
      );
      toast.success('Marked ready for pickup');
      setOrder((o: any) => ({ ...o, status: 'ready_for_pickup' }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to mark ready');
    }
  };

  if (loading) {
    return (
      <MerchantShell activePath="/merchant/dashboard">
        <p className="text-text-secondary">Loading order…</p>
      </MerchantShell>
    );
  }

  if (notFound || !order) {
    return (
      <MerchantShell activePath="/merchant/dashboard">
        <button
          type="button"
          onClick={() => navigate('/merchant/dashboard')}
          className="text-sm text-text-secondary mb-4"
        >
          ← Orders
        </button>
        <h1 className="text-3xl font-bold">Order not found</h1>
        <Link to="/merchant/dashboard" className="inline-block mt-6 text-motion-blue text-sm">
          Back to list
        </Link>
      </MerchantShell>
    );
  }

  const preparing = String(order.status).toLowerCase().includes('prepar');
  const statusClass = preparing
    ? 'bg-[#1e3a5f] text-[#7eb6ff]'
    : String(order.status).toLowerCase().includes('ready')
      ? 'bg-movr-green/30 text-success'
      : 'bg-border text-text-secondary';

  return (
    <MerchantShell activePath="/merchant/dashboard">
      <button
        type="button"
        onClick={() => navigate('/merchant/dashboard')}
        className="text-sm text-text-secondary mb-4"
      >
        ← Orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Order #{order.id}</h1>
          {order.placedLabel ? (
            <p className="text-text-secondary mt-1">{order.placedLabel}</p>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm font-medium capitalize ${statusClass}`}>
          {preparing ? 'Preparing' : String(order.status).replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        <div>
          <p className="text-sm text-text-secondary mb-3">Items</p>
          {order.items.length === 0 ? (
            <p className="text-text-secondary">No items on this order.</p>
          ) : (
            <ul className="divide-y divide-border">
              {order.items.map((item: any, i: number) => (
                <li key={i} className="flex justify-between gap-4 py-3 text-pure-white">
                  <span>
                    {item.product_name}
                    {item.quantity ? ` ×${item.quantity}` : ''}
                  </span>
                  <span className="font-semibold shrink-0">
                    {formatMoney(Number(item.line_total ?? item.unit_price ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border mt-2 pt-4 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatMoney(Number(order.total))}</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-text-secondary mb-3">Delivery</p>
          <div className="rounded-2xl bg-surface-elevated p-5 space-y-1.5">
            <p className="text-text-secondary">{order.delivery.line1}</p>
            {order.delivery.line2 ? (
              <p className="text-pure-white font-medium">{order.delivery.line2}</p>
            ) : null}
            <p className="text-text-secondary">{order.delivery.line3}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={markReady}
          className="rounded-full px-6 py-3 font-semibold text-white"
          style={{
            background: 'linear-gradient(90deg, #6B21A8 0%, #3B5CFF 100%)',
          }}
        >
          Mark ready for pickup
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full px-6 py-3 font-semibold bg-[#1a1a1a] text-white"
        >
          Print receipt
        </button>
      </div>
    </MerchantShell>
  );
}
