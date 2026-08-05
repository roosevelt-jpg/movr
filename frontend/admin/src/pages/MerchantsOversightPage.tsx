import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import DataTable, { DataTableColumn } from '../components/DataTable';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type MerchantRow = {
  id: string;
  business: string;
  email: string;
  phone: string;
  kyc: string;
  country: string;
  userId: string;
  joined: string;
};

/** Read-only merchant oversight — GET /merchant/admin/list. */
export default function MerchantsOversightPage() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/merchant/admin/list`, { headers: headers() })
      .then((res) => {
        const data = res.data.data || [];
        setRows(
          data.map((m: any) => ({
            id: m.id,
            business: m.business_name || m.name || '—',
            email: m.email || '—',
            phone: m.phone || '—',
            kyc: String(m.kyc_status || 'pending'),
            country: m.country || '—',
            userId: m.user_id,
            joined: m.created_at
              ? new Date(m.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—',
          }))
        );
        setError('');
      })
      .catch((e) => {
        setRows([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load merchants');
      });
  }, []);

  const filtered = q
    ? rows.filter(
        (r) =>
          r.business.toLowerCase().includes(q.toLowerCase()) ||
          r.email.toLowerCase().includes(q.toLowerCase())
      )
    : rows;

  const columns: DataTableColumn<MerchantRow>[] = [
    { key: 'business', header: 'Business' },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'kyc',
      header: 'KYC',
      render: (r) => (
        <span style={{ textTransform: 'capitalize' }}>{r.kyc}</span>
      ),
    },
    { key: 'country', header: 'Country' },
    { key: 'joined', header: 'Joined' },
    {
      key: 'id',
      header: '',
      render: (r) =>
        r.userId ? (
          <Link to={`/identity?userId=${r.userId}`} style={{ color: 'var(--motion-blue)' }}>
            Identity
          </Link>
        ) : null,
    },
  ];

  return (
    <AdminShell activeLabel="Merchants">
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Merchants</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
        Read-only oversight · {filtered.length} merchant{filtered.length === 1 ? '' : 's'}
      </p>
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search business or email"
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--pure-white)',
          width: '100%',
          maxWidth: 360,
        }}
      />
      <DataTable columns={columns} rows={filtered} />
    </AdminShell>
  );
}
