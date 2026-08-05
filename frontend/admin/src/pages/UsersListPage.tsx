import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type TabKey = 'all' | 'customer' | 'driver' | 'merchant';

const TAB_DEFS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'customer', label: 'Riders' },
  { key: 'driver', label: 'Drivers' },
  { key: 'merchant', label: 'Merchants' },
];

type UserRow = {
  id: string;
  name: string;
  role: string;
  status: string;
  joined: string;
  user_type?: string;
};

/** Admin users list — search, role tabs, status badges. */
export default function UsersListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, customer: 0, driver: 0, merchant: 0 });
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [error, setError] = useState('');

  const computeCountsFromRows = (list: UserRow[]) => {
    const next = { all: list.length, customer: 0, driver: 0, merchant: 0 };
    for (const r of list) {
      const t = String(r.user_type || '').toLowerCase();
      if (t === 'driver') next.driver += 1;
      else if (t === 'merchant') next.merchant += 1;
      else next.customer += 1;
    }
    return next;
  };

  const load = async () => {
    let mapped: UserRow[] = [];
    try {
      const res = await axios.get(`${API}/admin/users`, {
        headers: headers(),
        params: { role: tab === 'all' ? undefined : tab, q: q || undefined },
      });
      const data = res.data.data || [];
      mapped = data.map((u: any) => ({
        id: u.id,
        name:
          u.business_name ||
          `${u.first_name || ''} ${u.last_name || ''}`.trim() ||
          u.email ||
          '—',
        role:
          u.user_type === 'driver'
            ? 'Driver'
            : u.user_type === 'merchant'
              ? 'Merchant'
              : 'Rider',
        user_type: u.user_type,
        status: String(u.status || 'active').toLowerCase() === 'suspended' ? 'Suspended' : 'Active',
        joined: u.created_at
          ? new Date(u.created_at).toLocaleString(undefined, { month: 'short', year: 'numeric' })
          : '—',
      }));
      setRows(mapped);
      setError('');
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.data?.message || e.message || 'Failed to load users');
    }

    try {
      const cRes = await axios.get(`${API}/admin/users/counts`, { headers: headers() });
      if (cRes.data?.data) {
        setCounts({
          all: Number(cRes.data.data.all || 0),
          customer: Number(cRes.data.data.customer || 0),
          driver: Number(cRes.data.data.driver || 0),
          merchant: Number(cRes.data.data.merchant || 0),
        });
      } else {
        setCounts(computeCountsFromRows(mapped));
      }
    } catch {
      setCounts(computeCountsFromRows(mapped));
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const openIdentity = (r: UserRow) => {
    setSelected(r);
    navigate(`/identity?userId=${encodeURIComponent(r.id)}`);
  };

  const tabCount = (key: TabKey) => counts[key] ?? 0;

  return (
    <AdminShell activeLabel="Users">
      <div style={styles.header}>
        <h1 style={styles.h1}>Users</h1>
        <div style={styles.tools}>
          <input
            style={styles.search}
            placeholder="Search users..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button style={styles.filter} type="button" onClick={() => load()}>
            Search
          </button>
        </div>
      </div>

      <div style={styles.tabs}>
        {TAB_DEFS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tab,
              ...(tab === t.key ? styles.tabActive : {}),
            }}
          >
            {t.label} ({tabCount(t.key).toLocaleString()})
          </button>
        ))}
      </div>

      {error ? <p style={{ color: '#FF8FA0', marginBottom: 12 }}>{error}</p> : null}

      <div style={styles.table}>
        <div style={styles.thead}>
          <span>Name</span>
          <span>Role</span>
          <span>Status</span>
          <span>Joined</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No users found</div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              style={{ ...styles.row, cursor: 'pointer' }}
              onClick={() => openIdentity(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openIdentity(r)}
            >
              <span style={styles.nameCell}>
                <span style={styles.avatar} />
                {r.name}
              </span>
              <span>{r.role}</span>
              <span>
                <span
                  style={{
                    ...styles.badge,
                    ...(r.status === 'Active' ? styles.active : styles.suspended),
                  }}
                >
                  {r.status}
                </span>
              </span>
              <span style={{ color: '#A0A0A0' }}>{r.joined}</span>
              <button
                style={styles.view}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openIdentity(r);
                }}
              >
                Review
              </button>
            </div>
          ))
        )}
      </div>

      {selected ? (
        <div style={styles.panel}>
          <strong>{selected.name}</strong>
          <div>
            {selected.role} · {selected.status}
          </div>
          <button style={styles.view} type="button" onClick={() => setSelected(null)}>
            Close
          </button>
        </div>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  tools: { display: 'flex', gap: 10 },
  search: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 14px',
    minWidth: 200,
  },
  filter: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 14px',
    cursor: 'pointer',
  },
  tabs: { display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' },
  tab: {
    background: 'transparent',
    border: 'none',
    color: '#A0A0A0',
    paddingBottom: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  tabActive: { color: '#fff', borderBottom: '3px solid #0055FF' },
  table: { borderTop: '1px solid #1A1A1A' },
  thead: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '12px 4px',
    color: '#888',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '16px 4px',
    borderTop: '1px solid #1A1A1A',
    alignItems: 'center',
  },
  empty: { padding: '24px 4px', color: '#888' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#2A2A2A',
    display: 'inline-block',
  },
  badge: { borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 700 },
  active: { background: 'rgba(63,112,72,0.35)', color: '#9BE0A8' },
  suspended: { background: 'rgba(255,59,92,0.2)', color: '#FF8FA0' },
  view: {
    background: 'transparent',
    border: 'none',
    color: '#4A86E8',
    cursor: 'pointer',
    fontWeight: 600,
    justifySelf: 'end',
  },
  panel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    background: '#121212',
    border: '1px solid #2A2A2A',
  },
};
