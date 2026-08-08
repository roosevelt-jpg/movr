import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import OpsNotesPanel from '../components/OpsNotesPanel';
import { formatCurrency } from '../lib/currency';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin order ops — force cancel + notes (Phase 17). */
export default function OrderOpsPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = params.id || searchParams.get('id') || searchParams.get('orderId') || '';
  const [lookup, setLookup] = useState(orderId);
  const [order, setOrder] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statusOverride, setStatusOverride] = useState('');

  const load = async (id: string) => {
    if (!id) {
      setOrder(null);
      return;
    }
    setError('');
    try {
      const res = await axios.get(`${API}/admin/orders/${id}`, { headers: headers() }).catch(async () => {
        // fallback: list markers / marketplace lookup via force-cancel path validation
        return axios.get(`${API}/merchant/orders/${id}`, { headers: headers() });
      });
      const o = res.data?.data || res.data;
      setOrder({
        id: o.id || id,
        status: o.status || '—',
        total: Number(o.total_amount || o.total || 0),
        currency: o.currency || 'GHS',
        customer: o.customer_name || o.user_id || '—',
      });
      setStatusOverride(o.status || '');
    } catch (e: any) {
      setOrder({ id, status: 'unknown', total: 0, currency: 'GHS', customer: '—' });
      setError(e?.response?.data?.message || 'Order detail limited — actions still available');
    }
  };

  useEffect(() => {
    setLookup(orderId);
    load(orderId);
  }, [orderId]);

  const forceCancel = async () => {
    if (!order?.id) return;
    await axios.post(
      `${API}/admin/orders/${order.id}/force-cancel`,
      { reason: 'Admin force cancel from ops console' },
      { headers: headers() }
    );
    setMessage('Order cancelled');
    await load(order.id);
  };

  const overrideStatus = async () => {
    if (!order?.id || !statusOverride) return;
    await axios.post(
      `${API}/admin/orders/${order.id}/status-override`,
      { status: statusOverride, reason: 'Admin status override' },
      { headers: headers() }
    );
    setMessage(`Status set to ${statusOverride}`);
    await load(order.id);
  };

  return (
    <AdminShell activeLabel="Orders">
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="Order ID"
          style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}
        />
        <button
          type="button"
          onClick={() => navigate(`/orders/${encodeURIComponent(lookup.trim())}`)}
          style={adminBtn.primary}
        >
          Load
        </button>
      </div>

      {error ? <p style={{ color: 'var(--warning)' }}>{error}</p> : null}
      {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

      {order ? (
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Order {String(order.id).slice(0, 8)}</h2>
          <p>Customer: {order.customer}</p>
          <p>Status: {order.status}</p>
          <p>Total: {formatCurrency(order.total, order.currency)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" onClick={forceCancel} style={adminBtn.danger}>
              Force cancel
            </button>
            <input
              value={statusOverride}
              onChange={(e) => setStatusOverride(e.target.value)}
              placeholder="status"
              style={{ padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}
            />
            <button type="button" onClick={overrideStatus} style={adminBtn.secondary}>
              Override status
            </button>
          </div>
          <OpsNotesPanel entityType="order" entityId={order.id} />
        </div>
      ) : (
        <p style={{ color: 'var(--text-secondary)' }}>Enter an order ID to manage</p>
      )}
    </AdminShell>
  );
}
