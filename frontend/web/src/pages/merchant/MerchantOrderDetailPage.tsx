import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant order detail — items, delivery, mark ready / print. */
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
      const name = o.customer_name || 'Customer';
      const when = o.created_at
        ? `Placed ${new Date(o.created_at).toLocaleString()} · ${name}`
        : '';
      setOrder({
        id: String(o.id).slice(0, 4).toUpperCase() || id,
        rawId: o.id,
        status: o.status || 'Preparing',
        placedLabel: when,
        total: Number(o.total || 0),
        items: Array.isArray(o.items) ? o.items : [],
        delivery: {
          line1: o.delivery_mode === 'merchant_own' ? 'Merchant own delivery' : 'Movr courier · assigned',
          line2: o.delivery_address || '',
          line3: o.fulfillment_type === 'pickup' ? 'Pickup' : 'Standard delivery',
        },
      });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
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
      await axios.patch(`${API}/merchant/orders/${order.rawId || id}/ready`, {}, { headers: headers() });
      toast.success('Marked ready for pickup');
      setOrder((o: any) => ({ ...o, status: 'ready_for_pickup' }));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Failed to mark ready');
    }
  };

  const printReceipt = () => {
    window.print();
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
          className="text-sm text-text-secondary mb-4 hover:text-pure-white"
        >
          ← Orders
        </button>
        <h1 className="text-3xl font-bold">Order not found</h1>
        <p className="text-text-secondary mt-2">This order does not exist or is no longer available.</p>
        <Link to="/merchant/dashboard" className="inline-block mt-6 text-motion-blue text-sm">
          Back to list
        </Link>
      </MerchantShell>
    );
  }

  const statusClass =
    String(order.status).toLowerCase().includes('prepar')
      ? 'bg-motion-blue/25 text-motion-blue'
      : String(order.status).toLowerCase().includes('ready')
        ? 'bg-movr-green/30 text-success'
        : 'bg-border text-text-secondary';

  return (
    <MerchantShell activePath="/merchant/dashboard">
      <button
        type="button"
        onClick={() => navigate('/merchant/dashboard')}
        className="text-sm text-text-secondary mb-4 hover:text-pure-white"
      >
        ← Orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Order #{order.id}</h1>
          {order.placedLabel ? <p className="text-text-secondary mt-1">{order.placedLabel}</p> : null}
        </div>
        <span className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${statusClass}`}>
          {String(order.status).replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        <div>
          <p className="text-sm text-text-secondary mb-3">Items</p>
          {order.items.length === 0 ? (
            <p className="text-text-secondary">No items on this order.</p>
          ) : (
            <ul className="space-y-3">
              {order.items.map((item: any, i: number) => (
                <li key={i} className="flex justify-between gap-4 text-pure-white">
                  <span>
                    {item.product_name}
                    {item.quantity ? ` ×${item.quantity}` : ''}
                  </span>
                  <span className="font-medium shrink-0">
                    {formatMoney(Number(item.unit_price ?? item.line_total ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border mt-4 pt-4 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatMoney(Number(order.total))}</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-text-secondary mb-3">Delivery</p>
          <div className="rounded-2xl bg-surface-elevated border border-border p-5 space-y-1 text-text-secondary">
            <p>{order.delivery.line1}</p>
            {order.delivery.line2 ? <p>{order.delivery.line2}</p> : null}
            <p>{order.delivery.line3}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={markReady}
          className="rounded-full px-6 py-3 font-semibold bg-movr-gradient"
        >
          Mark ready for pickup
        </button>
        <button
          type="button"
          onClick={printReceipt}
          className="rounded-full px-6 py-3 font-semibold border border-border bg-surface-elevated"
        >
          Print receipt
        </button>
        <Link to="/merchant/dashboard" className="rounded-full px-6 py-3 text-text-secondary text-sm self-center">
          Back to list
        </Link>
      </div>
    </MerchantShell>
  );
}
