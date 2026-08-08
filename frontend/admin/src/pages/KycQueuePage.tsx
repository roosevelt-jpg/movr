import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'pending' | 'approved' | 'rejected';

type KycRow = {
  id: string;
  type: string;
  name: string;
  city: string;
  submitted: string;
  docs: string;
  status: string;
};

type Stats = {
  pending: number;
  approvedToday: number;
  rejected: number;
  avgReviewHours: number;
};

type PreviewDoc = {
  id?: string;
  label: string;
  status: string;
  url?: string;
  verified?: boolean;
};

type Preview = {
  id: string;
  type: string;
  userId?: string | null;
  name: string;
  owner?: string;
  category?: string;
  status?: string;
  documents: PreviewDoc[];
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function statusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'approved') return { background: 'rgba(34,197,94,0.2)', color: '#4ade80' };
  if (s === 'rejected') return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
  if (s === 'incomplete') return { background: 'rgba(148,163,184,0.2)', color: '#94a3b8' };
  return { background: 'rgba(234,179,8,0.2)', color: '#facc15' };
}

function rowKey(r: KycRow) {
  return `${r.type}:${r.id}`;
}

/** KYC board — queue, preview panel, bulk approve. */
export default function KycQueuePage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [rows, setRows] = useState<KycRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    approvedToday: 0,
    rejected: 0,
    avgReviewHours: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/kyc/board`, {
        headers: headers(),
        params: { filter },
      });
      const d = res.data?.data || {};
      if (d.stats) setStats(d.stats);
      setRows(d.rows || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load KYC board');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setSelected({});
  }, [filter]);

  const openPreview = async (r: KycRow) => {
    setPreviewKey(rowKey(r));
    setNote('');
    try {
      const res = await axios.get(`${API}/admin/kyc/${r.type}/${r.id}`, { headers: headers() });
      setPreview(res.data?.data || null);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load KYC preview');
      setPreview(null);
    }
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!preview) return;
    setBusy(true);
    try {
      await axios.post(
        `${API}/admin/kyc/${preview.type}/${preview.id}/decide`,
        { status, note: note.trim() },
        { headers: headers() }
      );
      setPreview(null);
      setPreviewKey(null);
      setNote('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Decision failed');
    } finally {
      setBusy(false);
    }
  };

  const bulkApprove = async () => {
    const items = rows
      .filter((r) => selected[rowKey(r)] && ['In Review', 'Incomplete'].includes(r.status))
      .map((r) => ({ type: r.type, id: r.id }));
    if (!items.length) {
      setError('Select pending applications to bulk approve');
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/kyc/bulk-approve`, { items }, { headers: headers() });
      setSelected({});
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Bulk approve failed');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/admin/kyc/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kyc-queue.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const toggleAllPending = (on: boolean) => {
    const next: Record<string, boolean> = { ...selected };
    rows.forEach((r) => {
      if (['In Review', 'Incomplete'].includes(r.status)) next[rowKey(r)] = on;
    });
    setSelected(next);
  };

  const pendingSelected = rows.filter(
    (r) => selected[rowKey(r)] && ['In Review', 'Incomplete'].includes(r.status)
  ).length;

  const cards = [
    { label: 'Pending Review', value: String(stats.pending) },
    { label: 'Approved Today', value: String(stats.approvedToday) },
    { label: 'Rejected', value: String(stats.rejected) },
    { label: 'Avg Review Time', value: `${Number(stats.avgReviewHours || 0).toFixed(1)}h` },
  ];

  return (
    <AdminShell activeLabel="KYC" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>KYC Queue</h1>
          <p style={styles.sub}>Review driver and merchant identity documents</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" className="admin-btn" style={styles.secondaryBtn} onClick={exportCsv}>
            Export
          </button>
          <button type="button" className="admin-btn" style={styles.primaryBtn} onClick={bulkApprove} disabled={busy || !pendingSelected}>
            Bulk Approve ({pendingSelected})
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.cards}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              style={{ ...styles.tab, ...(filter === t.key ? styles.tabOn : {}) }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.split}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    aria-label="Select all pending"
                    onChange={(e) => toggleAllPending(e.target.checked)}
                  />
                </th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>City</th>
                <th style={styles.th}>Submitted</th>
                <th style={styles.th}>Docs</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={styles.tdMuted}>
                    Loading KYC queue…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={styles.tdMuted}>
                    No applications found
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const key = rowKey(r);
                  const isPending = ['In Review', 'Incomplete'].includes(r.status);
                  return (
                    <tr
                      key={key}
                      style={previewKey === key ? styles.rowActive : undefined}
                    >
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          disabled={!isPending}
                          checked={Boolean(selected[key])}
                          onChange={(e) =>
                            setSelected((s) => ({ ...s, [key]: e.target.checked }))
                          }
                        />
                      </td>
                      <td style={styles.td}>{r.name}</td>
                      <td style={{ ...styles.td, textTransform: 'capitalize' }}>{r.type}</td>
                      <td style={styles.td}>{r.city}</td>
                      <td style={styles.td}>{r.submitted}</td>
                      <td style={styles.td}>{r.docs}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...statusStyle(r.status) }}>{r.status}</span>
                      </td>
                      <td style={styles.td}>
                        <button type="button" style={styles.linkBtn} onClick={() => openPreview(r)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <aside style={styles.panel}>
          {!preview ? (
            <p style={styles.panelEmpty}>Select Review to open KYC Preview</p>
          ) : (
            <>
              <h2 style={styles.panelTitle}>KYC Preview</h2>
              <p style={styles.panelName}>{preview.name}</p>
              <p style={styles.panelMeta}>
                {preview.category || `${preview.type} · ${preview.owner || ''}`}
              </p>

              <h3 style={styles.sectionTitle}>Documents</h3>
              <ul style={styles.docList}>
                {(preview.documents || []).map((doc, i) => (
                  <li key={doc.id || `${doc.label}-${i}`} style={styles.docItem}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{doc.label}</div>
                      <div style={styles.metricLabel}>{doc.status || 'pending'}</div>
                    </div>
                    <span
                      style={{
                        ...styles.badge,
                        ...(doc.verified ? statusStyle('approved') : statusStyle('pending')),
                      }}
                    >
                      {doc.verified ? 'OK' : 'Check'}
                    </span>
                  </li>
                ))}
              </ul>

              <label style={styles.field}>
                <span style={styles.fieldLabel}>Review note</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  style={styles.textarea}
                  placeholder="Optional note for audit log…"
                />
              </label>

              <div style={styles.panelActions}>
                {preview.userId ? (
                  <Link
                    to={`/identity?userId=${encodeURIComponent(preview.userId)}`}
                    style={{ ...styles.approveBtn, textDecoration: 'none', textAlign: 'center' as const }}
                  >
                    Identity review
                  </Link>
                ) : null}
                <button
                  type="button"
                  style={styles.approveBtn}
                  disabled={busy}
                  onClick={() => decide('approved')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={styles.rejectBtn}
                  disabled={busy}
                  onClick={() => decide('rejected')}
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 },
  error: { color: 'var(--error)', marginBottom: 12 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  label: { color: 'var(--text-secondary)', fontSize: 13 },
  value: { fontSize: 26, fontWeight: 700, marginTop: 8 },
  toolbar: { marginBottom: 12 },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 14px',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  tabOn: {
    background: 'linear-gradient(90deg, rgba(142,45,226,0.35), rgba(74,0,224,0.35))',
    border: '1px solid #8E2DE2',
    color: 'var(--brand-white)',
  },
  split: {
    display: 'grid',
    gridTemplateColumns: '1fr minmax(280px, 340px)',
    gap: 16,
    alignItems: 'start',
  },
  tableWrap: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  tdMuted: {
    padding: '24px 14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  rowActive: { background: 'rgba(142,45,226,0.12)' },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--motion-blue)',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    padding: 16,
    position: 'sticky',
    top: 88,
  },
  panelEmpty: { color: 'var(--text-secondary)', margin: 0, fontSize: 13 },
  panelTitle: { margin: '0 0 8px', fontSize: 16, fontWeight: 700 },
  panelName: { margin: 0, fontWeight: 700, fontSize: 15 },
  panelMeta: { margin: '4px 0 16px', color: 'var(--text-secondary)', fontSize: 13 },
  sectionTitle: { margin: '0 0 10px', fontSize: 13, fontWeight: 700 },
  docList: { listStyle: 'none', margin: '0 0 16px', padding: 0 },
  docItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  metricLabel: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 },
  textarea: {
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    fontSize: 14,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  panelActions: { display: 'flex', gap: 10 },
  approveBtn: { ...adminBtn.successSoft, flex: 1 },
  rejectBtn: { ...adminBtn.dangerSoft, flex: 1 },
};
