import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type AuditRow = {
  admin: string;
  action: string;
  entity: string;
  time: string;
};

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h} hrs ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/** Admin audit log table. */
export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get(`${API}/admin/audit-log`, { headers: headers() })
      .then((res) => {
        const data = res.data.data || [];
        setRows(
          data.map((a: any) => ({
            admin:
              [a.first_name, a.last_name].filter(Boolean).join(' ') ||
              a.email ||
              'Admin',
            action: a.action?.replace(/_/g, ' ') || a.reason || 'Action',
            entity: a.resource_type
              ? `${a.resource_type}${a.resource_id ? ` #${String(a.resource_id).slice(0, 8)}` : ''}`
              : '—',
            time: relativeTime(a.created_at),
          }))
        );
        setError('');
      })
      .catch((e) => {
        setRows([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load audit log');
      });
  }, []);

  return (
    <AdminShell activeLabel="Audit">
      <h1 style={styles.h1}>Audit log</h1>
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}
      <div style={styles.table}>
        <div style={styles.header}>
          <span>Admin</span>
          <span>Action</span>
          <span>Entity</span>
          <span>Time</span>
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No audit events</div>
        ) : (
          rows.map((r, i) => (
            <div key={i} style={styles.row}>
              <span>{r.admin}</span>
              <span>{r.action}</span>
              <span>{r.entity}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{r.time}</span>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 20 },
  table: { borderTop: '1px solid var(--surface-elevated)' },
  header: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1.2fr 0.8fr',
    gap: 8,
    padding: '12px 4px',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1.2fr 0.8fr',
    gap: 8,
    padding: '16px 4px',
    borderTop: '1px solid var(--surface-elevated)',
    alignItems: 'center',
  },
  empty: { padding: '24px 4px', color: 'var(--text-secondary)' },
};
