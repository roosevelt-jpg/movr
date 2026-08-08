import React, { useEffect, useMemo, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { hasPermission, setAdminAccess } from '../lib/rbac';

const API = process.env.REACT_APP_API_URL || '/api/v1';

type RoleInfo = { id: string; label: string; permissions: string[] };
type AdminRow = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  roles: string[];
};
type InviteRow = {
  id: string;
  email: string;
  roles: string[];
  expires_at: string;
  invited_by_email?: string;
};

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
}

/** Admin team — invite teammates and assign RBAC roles. */
export default function TeamPage() {
  const canManage = hasPermission('team.manage');
  const canView = hasPermission('team.view', 'team.manage');

  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRoles, setInviteRoles] = useState<string[]>(['ops']);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const load = async () => {
    try {
      const me = await fetch(`${API}/admin/team/me`, { headers: headers() }).then((r) => r.json());
      if (me?.data?.roles) {
        setAdminAccess(me.data.roles, me.data.permissions || []);
      }

      const [catalog, adminsRes, invitesRes] = await Promise.all([
        fetch(`${API}/admin/team/catalog`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/admin/team/admins`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/admin/team/invites`, { headers: headers() }).then((r) => r.json()),
      ]);
      if (catalog.status === 'error') throw new Error(catalog.message);
      setRoles(catalog.data?.roles || []);
      setAdmins(adminsRes.data || []);
      setInvites(invitesRes.data || []);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load team');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleInviteRole = (role: string) => {
    setInviteRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const sendInvite = async () => {
    if (!canManage) return;
    setBusy(true);
    setMessage('');
    setLastInviteUrl('');
    try {
      const res = await fetch(`${API}/admin/team/invites`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, roles: inviteRoles }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Invite failed');
      setMessage(json.message || 'Invite created');
      setLastInviteUrl(json.data?.acceptAbsoluteUrl || '');
      setEmail('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const revokeInvite = async (id: string) => {
    if (!canManage) return;
    await fetch(`${API}/admin/team/invites/${id}/revoke`, {
      method: 'POST',
      headers: headers(),
    });
    await load();
  };

  const startEdit = (admin: AdminRow) => {
    setEditingId(admin.id);
    setEditRoles([...(admin.roles || [])]);
  };

  const saveRoles = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/team/admins/${id}/roles`, {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: editRoles }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Update failed');
      setEditingId(null);
      setMessage('Roles updated');
      await load();
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (id: string, isActive: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/team/admins/${id}/status`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Status update failed');
      await load();
    } catch (e: any) {
      setError(e.message || 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const roleHelp = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of roles) {
      map[r.id] = (r.permissions || []).join(', ');
    }
    return map;
  }, [roles]);

  if (!canView) {
    return (
      <AdminShell activeLabel="Team">
        <h1 style={styles.h1}>Team access</h1>
        <p style={styles.muted}>You do not have permission to view the admin team.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell activeLabel="Team" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Team & access</h1>
          <p style={styles.sub}>Invite admins and assign roles with fine-grained permissions</p>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.ok}>{message}</p> : null}
      {lastInviteUrl ? (
        <div style={styles.inviteBox}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Share this invite link (shown once):</p>
          <code style={styles.code}>{lastInviteUrl}</code>
          <button
            type="button"
            style={{ ...adminBtn.secondary, marginTop: 8 }}
            onClick={() => navigator.clipboard?.writeText(lastInviteUrl)}
          >
            Copy link
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div style={styles.card}>
          <h2 style={styles.h2}>Invite admin</h2>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              style={adminBtn.primary}
              disabled={busy || !email || !inviteRoles.length}
              onClick={sendInvite}
            >
              {busy ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          <div style={styles.roleGrid}>
            {roles.map((r) => (
              <label key={r.id} style={styles.roleChip} title={roleHelp[r.id]}>
                <input
                  type="checkbox"
                  checked={inviteRoles.includes(r.id)}
                  onChange={() => toggleInviteRole(r.id)}
                />
                <span>{r.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div style={styles.grid} className="admin-split-grid" data-admin-grid="split">
        <div style={styles.card}>
          <h2 style={styles.h2}>Admins ({admins.length})</h2>
          <div style={styles.table}>
            {admins.map((a) => (
              <div key={a.id} style={styles.row}>
                <div>
                  <strong>
                    {a.first_name || ''} {a.last_name || ''}
                  </strong>
                  <div style={styles.muted}>{a.email}</div>
                  <div style={styles.badges}>
                    {(editingId === a.id ? editRoles : a.roles || []).map((r) => (
                      <span key={r} style={styles.badge}>
                        {r}
                      </span>
                    ))}
                    {!a.is_active ? <span style={styles.badgeOff}>inactive</span> : null}
                  </div>
                  {editingId === a.id ? (
                    <div style={{ ...styles.roleGrid, marginTop: 10 }}>
                      {roles.map((r) => (
                        <label key={r.id} style={styles.roleChip}>
                          <input
                            type="checkbox"
                            checked={editRoles.includes(r.id)}
                            onChange={() =>
                              setEditRoles((prev) =>
                                prev.includes(r.id)
                                  ? prev.filter((x) => x !== r.id)
                                  : [...prev, r.id]
                              )
                            }
                          />
                          <span>{r.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="admin-actions" style={{ justifyContent: 'flex-end' }}>
                    {editingId === a.id ? (
                      <>
                        <button type="button" style={adminBtn.primary} disabled={busy} onClick={() => saveRoles(a.id)}>
                          Save
                        </button>
                        <button type="button" style={adminBtn.secondary} onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" style={adminBtn.secondary} onClick={() => startEdit(a)}>
                          Roles
                        </button>
                        <button
                          type="button"
                          style={a.is_active ? adminBtn.dangerSoft : adminBtn.successSoft}
                          disabled={busy}
                          onClick={() => setActive(a.id, !a.is_active)}
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>Pending invites ({invites.length})</h2>
          {invites.length === 0 ? (
            <p style={styles.muted}>No pending invites</p>
          ) : (
            invites.map((i) => (
              <div key={i.id} style={styles.row}>
                <div>
                  <strong>{i.email}</strong>
                  <div style={styles.muted}>
                    {(i.roles || []).join(', ')} · expires {new Date(i.expires_at).toLocaleDateString()}
                  </div>
                </div>
                {canManage ? (
                  <button type="button" style={adminBtn.dangerSoft} onClick={() => revokeInvite(i.id)}>
                    Revoke
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>Role permissions</h2>
        <div className="admin-table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.label}</td>
                  <td style={styles.td}>{r.permissions.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { marginBottom: 20 },
  h1: { fontSize: 24, fontWeight: 700, margin: 0 },
  h2: { fontSize: 16, fontWeight: 700, margin: '0 0 12px' },
  sub: { color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 },
  muted: { color: 'var(--text-secondary)', fontSize: 13 },
  error: { color: 'var(--error)', marginBottom: 12 },
  ok: { color: 'var(--success)', marginBottom: 12 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
    gap: 16,
    marginBottom: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  formRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  input: {
    flex: 1,
    minWidth: 220,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
  },
  roleGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  roleChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid var(--border)',
    fontSize: 12,
    cursor: 'pointer',
  },
  table: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
  },
  badges: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(0,85,255,0.18)',
    color: '#93c5fd',
  },
  badgeOff: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(239,68,68,0.18)',
    color: '#fca5a5',
  },
  inviteBox: {
    background: 'rgba(106,0,255,0.12)',
    border: '1px solid rgba(106,0,255,0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  code: {
    display: 'block',
    wordBreak: 'break-all',
    fontSize: 12,
    color: 'var(--text-primary)',
  },
  th: {
    textAlign: 'left',
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  td: {
    padding: '10px 6px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
  },
};
