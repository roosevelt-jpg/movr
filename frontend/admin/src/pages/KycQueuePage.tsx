import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
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

/** KYC approval queue — drivers + merchants; approve/reject publishes on-chain attestation. */
export default function KycQueuePage() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const res = await axios.get(`${API}/admin/kyc-queue`, { headers: headers() });
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
  };

  useEffect(() => {
    load()
      .then(() => setError(''))
      .catch((e) => {
        setRows([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load KYC queue');
      });
  }, []);

  const decide = async (r: KycRow, status: 'approved' | 'rejected') => {
    setBusy(r.id);
    try {
      await axios.patch(
        `${API}/admin/kyc-queue/${r.id}`,
        { status, role: r.role },
        { headers: headers() }
      );
      toast.success(`${r.role} ${status}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell activeLabel="KYC queue">
      <h1 style={styles.h1}>KYC approval queue</h1>
      <p style={styles.sub}>
        {rows.length} application{rows.length === 1 ? '' : 's'} waiting for review
      </p>
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

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
            <div key={`${r.role}-${r.id}`} style={styles.row}>
              <span style={styles.name}>
                <span style={styles.avatar} />
                {r.name}
              </span>
              <span>{r.role}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.submitted}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.docs}</span>
              <span>
                <span style={styles.badge}>{r.status}</span>
              </span>
              <span style={styles.actions}>
                <button
                  type="button"
                  style={styles.approve}
                  disabled={busy === r.id}
                  onClick={() => decide(r, 'approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={styles.reject}
                  disabled={busy === r.id}
                  onClick={() => decide(r, 'rejected')}
                >
                  Reject
                </button>
                <Link to={`/identity?userId=${encodeURIComponent(r.id)}`} style={styles.review}>
                  Review
                </Link>
              </span>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 8, marginBottom: 20 },
  table: { borderTop: '1px solid var(--surface-elevated)' },
  header: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr 0.7fr 1.4fr',
    gap: 8,
    padding: '12px 4px',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 0.7fr 1fr 0.8fr 0.7fr 1.4fr',
    gap: 8,
    padding: '16px 4px',
    borderTop: '1px solid var(--surface-elevated)',
    alignItems: 'center',
  },
  empty: { padding: '24px 4px', color: 'var(--text-secondary)' },
  name: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'var(--border)',
    display: 'inline-block',
  },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    background: 'color-mix(in srgb, var(--warning) 22%, transparent)',
    color: 'var(--warning)',
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  approve: {
    background: 'var(--success)',
    color: 'var(--jet-black)',
    border: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12,
  },
  reject: {
    background: 'transparent',
    color: 'var(--error)',
    border: '1px solid var(--error)',
    borderRadius: 8,
    padding: '6px 10px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 12,
  },
  review: { color: 'var(--motion-blue)', fontWeight: 600, fontSize: 12, alignSelf: 'center' },
};
