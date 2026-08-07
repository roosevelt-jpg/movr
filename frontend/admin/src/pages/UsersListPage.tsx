import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter } from 'lucide-react';
import AdminShell from '../layouts/AdminShell';
import DetailPanel from '../components/DetailPanel';
import OpsNotesPanel from '../components/OpsNotesPanel';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
});

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

/** Admin users list — search, role tabs, status badges (mockup). */
export default function UsersListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, customer: 0, driver: 0, merchant: 0 });
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [error, setError] = useState('');

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
      }
    } catch {
      /* keep previous */
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const tabCount = (key: TabKey) => counts[key] ?? 0;

  return (
    <AdminShell activeLabel="Users">
      <div className="flex gap-6 items-start min-h-[70vh] bg-black text-white -m-2 p-2 md:p-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold m-0 tracking-tight">Users</h1>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                  placeholder="Search users..."
                  className="w-56 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] pl-10 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-[#3B5CFF]"
                />
              </div>
              <button
                type="button"
                onClick={() => setTab('all')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 text-sm text-zinc-300"
              >
                <Filter size={14} /> All roles
              </button>
            </div>
          </div>

          <div className="flex gap-6 border-b border-[#2A2A2A] mb-4">
            {TAB_DEFS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    active
                      ? 'text-white border-[#3B5CFF]'
                      : 'text-zinc-500 border-transparent hover:text-zinc-300'
                  }`}
                >
                  {t.label} ({tabCount(t.key).toLocaleString()})
                </button>
              );
            })}
          </div>

          {error ? <p className="text-red-400 mb-3 text-sm">{error}</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-zinc-500 text-sm">
                  <th className="font-medium py-3 pr-4">Name</th>
                  <th className="font-medium py-3 pr-4">Role</th>
                  <th className="font-medium py-3 pr-4">Status</th>
                  <th className="font-medium py-3 pr-4">Joined</th>
                  <th className="font-medium py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-zinc-500 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[#2A2A2A] hover:bg-[#111] cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="py-4 pr-4">
                        <span className="inline-flex items-center gap-3 font-semibold">
                          <span className="inline-block w-9 h-9 rounded-full bg-[#2A2A2A]" />
                          {r.name}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-zinc-300">{r.role}</td>
                      <td className="py-4 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            r.status === 'Active'
                              ? 'bg-emerald-900/50 text-emerald-400'
                              : 'bg-red-900/40 text-red-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-zinc-500">{r.joined}</td>
                      <td className="py-4 text-right">
                        <button
                          type="button"
                          className="text-[#5B8AFF] font-semibold text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(r);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
