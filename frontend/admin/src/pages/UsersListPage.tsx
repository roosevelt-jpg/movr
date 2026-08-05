import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import DataTable, { DataTableColumn } from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import DetailPanel from '../components/DetailPanel';
import OpsNotesPanel from '../components/OpsNotesPanel';

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
  };

  const tabCount = (key: TabKey) => counts[key] ?? 0;

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <span className="inline-flex items-center gap-admin-2 font-semibold">
          <span className="inline-block w-8 h-8 rounded-full bg-border" />
          {r.name}
        </span>
      ),
    },
    { key: 'role', header: 'Role' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`rounded-pill px-admin-2 py-admin-1 text-admin-xs font-bold ${
            r.status === 'Active'
              ? 'bg-movr-green/35 text-success'
              : 'bg-error/20 text-error'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (r) => <span className="text-text-secondary">{r.joined}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          type="button"
          className="text-motion-blue font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            openIdentity(r);
          }}
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <AdminShell activeLabel="Users">
      <div className="flex gap-admin-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-admin-4 flex-wrap mb-admin-4">
            <h1 className="text-2xl font-bold m-0">Users</h1>
          </div>

          <FilterBar
            search={q}
            onSearchChange={setQ}
            searchPlaceholder="Search users..."
            filters={[
              {
                key: 'role',
                label: 'Role',
                value: tab,
                options: TAB_DEFS.map((t) => ({
                  value: t.key,
                  label: `${t.label} (${tabCount(t.key).toLocaleString()})`,
                })),
                onChange: (v) => setTab(v as TabKey),
              },
            ]}
            actions={
              <button
                type="button"
                onClick={() => load()}
                className="rounded-md bg-surface-elevated border border-border px-admin-3 py-admin-2 text-admin-sm text-text-primary"
              >
                Search
              </button>
            }
          />

          {error ? <p className="text-error mb-admin-3">{error}</p> : null}

          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={openIdentity}
            emptyMessage="No users found"
          />
        </div>

        <DetailPanel
          title={selected?.name || 'User'}
          open={!!selected}
          onClose={() => setSelected(null)}
        >
          {selected ? (
            <>
              <p className="text-text-secondary m-0">
                {selected.role} · {selected.status}
              </p>
              <p className="text-text-secondary m-0">Joined {selected.joined}</p>
              <button
                type="button"
                className="rounded-md bg-motion-blue text-pure-white px-admin-3 py-admin-2 font-semibold"
                onClick={() =>
                  navigate(`/identity?userId=${encodeURIComponent(selected.id)}`)
                }
              >
                Open identity review
              </button>
              <OpsNotesPanel entityType="user" entityId={selected.id} />
            </>
          ) : null}
        </DetailPanel>
      </div>
    </AdminShell>
  );
}
