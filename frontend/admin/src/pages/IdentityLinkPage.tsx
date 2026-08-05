import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin identity review — link graph + documents + on-chain attest. */
export default function IdentityLinkPage() {
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('userId') || searchParams.get('user') || '';
  const [userId, setUserId] = useState(queryUserId);
  const [data, setData] = useState<any>(null);
  const [profile, setProfile] = useState<{ name: string; role: string; applied: string } | null>(
    null
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async (id = userId) => {
    if (!id) {
      setData(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`${API}/identity/${id}`, { headers: headers() });
      setData(res.data.data);
      try {
        const u = await axios.get(`${API}/admin/users`, {
          headers: headers(),
          params: { q: id },
        });
        const match = (u.data.data || []).find((row: any) => String(row.id) === String(id));
        if (match) {
          setProfile({
            name:
              match.business_name ||
              `${match.first_name || ''} ${match.last_name || ''}`.trim() ||
              match.email ||
              id,
            role:
              match.user_type === 'driver'
                ? 'Driver'
                : match.user_type === 'merchant'
                  ? 'Merchant'
                  : 'Rider',
            applied: match.created_at
              ? `Joined ${new Date(match.created_at).toLocaleDateString()}`
              : '',
          });
        } else {
          setProfile({ name: id, role: 'User', applied: '' });
        }
      } catch {
        setProfile({ name: id, role: 'User', applied: '' });
      }
    } catch (e: any) {
      setData(null);
      setProfile(null);
      setError(e?.response?.data?.message || e.message || 'Failed to load identity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryUserId) {
      setUserId(queryUserId);
      load(queryUserId);
    } else {
      setData(null);
      setProfile(null);
    }
  }, [queryUserId]);

  const latestByType = (type: string) =>
    data?.checks?.find((c: any) => c.check_type === type);

  const statusBadge = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    const style =
      s === 'match' || s === 'verified'
        ? { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' }
        : s === 'mismatch'
          ? { background: 'rgba(255,59,92,0.25)', color: 'var(--error)' }
          : { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };
    const label = s === 'match' ? 'Match' : s.charAt(0).toUpperCase() + s.slice(1);
    return <span style={{ ...styles.badge, ...style }}>{label}</span>;
  };

  const runLink = async () => {
    await axios.post(`${API}/identity/link/${userId}`, {}, { headers: headers() });
    await load();
  };

  const approve = async () => {
    await axios
      .post(
        `${API}/kyc/attestation/publish`,
        { userId, status: 'Verified', documentType: 'identity_review', verificationMethod: 'manual' },
        { headers: headers() }
      )
      .catch(() => undefined);
    await load();
  };

  const applyOverride = async () => {
    await axios.post(
      `${API}/identity/${userId}/override`,
      { checkType: 'id_to_phone', status: 'match', reason: 'manual review' },
      { headers: headers() }
    );
    await load();
  };

  const links = [
    { label: 'National ID ↔ Driving license', type: 'id_to_license' },
    { label: 'National ID ↔ Vehicle license', type: 'id_to_vehicle' },
    { label: 'National ID ↔ Phone number', type: 'id_to_phone' },
  ];

  const docs = data?.documents || [];

  return (
    <AdminShell activeLabel="Identity review">
      <div style={styles.profile}>
        {profile ? <div style={styles.avatar} /> : null}
        <div>
          <h1 style={styles.name}>{profile?.name || 'Identity review'}</h1>
          <p style={styles.meta}>
            {profile ? (
              <>
                {profile.role}
                {profile.applied ? ` · ${profile.applied}` : ''}
              </>
            ) : (
              'Provide a user id to load identity checks'
            )}
          </p>
        </div>
        <div style={styles.lookup}>
          <input
            style={styles.input}
            placeholder="Load user id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <button style={styles.secondaryBtn} onClick={() => load().catch(() => undefined)}>
            Load
          </button>
        </div>
      </div>

      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}
      {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p> : null}

      {!userId && !loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>No user selected. Open from Users/KYC or enter a user id.</p>
      ) : !loading && data ? (
        <>
          <div style={styles.grid}>
            <div style={styles.panel}>
              <p style={styles.panelLabel}>Identity link status</p>
              <ul style={styles.list}>
                {links.map((l) => (
                  <li key={l.type} style={styles.listRow}>
                    <span>{l.label}</span>
                    {statusBadge(latestByType(l.type)?.status)}
                  </li>
                ))}
              </ul>
            </div>

            <div style={styles.docs}>
              <p style={styles.panelLabel}>Submitted documents</p>
              {docs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No documents submitted</p>
              ) : (
                docs.map((d: any, i: number) => (
                  <div key={d.id || d.type || i} style={styles.docCard}>
                    <span style={{ marginRight: 8 }}>
                      {d.status === 'verified' ? '📄✅' : '📄⏳'}
                    </span>
                    <span>
                      {d.type || d.document_type || 'Document'} · {d.status || 'pending'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={styles.actions}>
            <button
              style={styles.primaryBtn}
              onClick={() => {
                runLink().catch(() => undefined);
                approve().catch(() => undefined);
              }}
            >
              Approve & attest on-chain
            </button>
            <button
              style={styles.secondaryBtnWide}
              onClick={() => applyOverride().catch(() => undefined)}
            >
              Manual override
            </button>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  profile: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
  },
  name: { margin: 0, fontSize: 24, fontWeight: 700 },
  meta: { margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  lookup: { marginLeft: 'auto', display: 'flex', gap: 8 },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  grid: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 24 },
  panel: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
  },
  docs: { display: 'flex', flexDirection: 'column', gap: 10 },
  panelLabel: { color: 'var(--text-secondary)', marginBottom: 16, fontSize: 13 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--surface-elevated)',
  },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  docCard: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  primaryBtn: {
    background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: 999,
    padding: '14px 20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'var(--surface-elevated)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  secondaryBtnWide: {
    background: 'var(--surface)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '14px 20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
