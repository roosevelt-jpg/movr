import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type KycRow = {
  id: string;
  name: string;
  role: string;
  submitted: string;
  docs: string;
  status: string;
};

/** KYC approval queue — drivers + merchants pending review. */
export default function KycQueuePage() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/admin/kyc-queue`, { headers: headers() })
      .then((res) => {
        const data = res.data.data || [];
        setRows(
          data.map((r: any) => ({
            id: r.id || r.user_id,
            name: r.name || r.business_name || 'Applicant',
            role: r.role || (r.user_type === 'merchant' ? 'Merchant' : 'Driver'),
            submitted: r.submitted_at
              ? new Date(r.submitted_at).toLocaleString()
              : r.submitted || '—',
            docs: r.docs_label || `${r.docs_uploaded || 0}/${r.docs_required || 3} docs`,
            status: r.status || 'Pending',
          }))
        );
        setError('');
      })
      .catch((e) => {
        setRows([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load KYC queue');
      });
  }, []);

  return (
    <AdminShell activeLabel="KYC queue">
      <h1 style={styles.h1}>KYC approval queue</h1>
      <p style={styles.sub}>
        {rows.length} application{rows.length === 1 ? '' : 's'} waiting for review
      </p>
      {error ? <p style={{ color: '#FF8FA0' }}>{error}</p> : null}

      <div style={styles.table}>
        <div style={styles.header}>
          <span>Applicant</span>
          <span>Role</span>
          <span>Submitted</span>
          <span>Documents</span>
          <span>Status</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No pending KYC applications</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={styles.row}>
              <span style={styles.name}>
                <span style={styles.avatar} />
                {r.name}
              </span>
              <span>{r.role}</span>
              <span style={{ color: '#A0A0A0' }}>{r.submitted}</span>
              <span style={{ color: '#A0A0A0' }}>{r.docs}</span>
              <span>
                <span style={styles.badge}>{r.status}</span>
              </span>
              <Link to={`/identity?userId=${encodeURIComponent(r.id)}`} style={styles.review}>
                Review
              </Link>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: '#A0A0A0', marginTop: 8, marginBottom: 20 },
  table: { borderTop: '1px solid #1A1A1A' },
  header: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 0.8fr 1fr 0.9fr 0.8fr 0.6fr',
    gap: 8,
    padding: '12px 4px',
    color: '#888',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 0.8fr 1fr 0.9fr 0.8fr 0.6fr',
    gap: 8,
    padding: '16px 4px',
    borderTop: '1px solid #1A1A1A',
    alignItems: 'center',
  },
  empty: { padding: '24px 4px', color: '#888' },
  name: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#2A2A2A',
    display: 'inline-block',
  },
  badge: {
    background: 'rgba(255,184,0,0.2)',
    color: '#FFB800',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  review: {
    color: '#4A86E8',
    fontWeight: 600,
    textDecoration: 'none',
    justifySelf: 'end',
  },
};
