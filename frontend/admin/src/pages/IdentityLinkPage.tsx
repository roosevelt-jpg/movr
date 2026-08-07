import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin identity review — applicant, documents, link status, approve / override. */
export default function IdentityLinkPage() {
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('userId') || searchParams.get('user') || '';
  const [userId, setUserId] = useState(queryUserId);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [overrideReason, setOverrideReason] = useState('Fleet vehicle / manual review');

  const load = async (id = userId) => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`${API}/identity/${id}`, { headers: headers() });
      setData(res.data.data);
    } catch (e: any) {
      setData(null);
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
    }
  }, [queryUserId]);

  const statusBadge = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    const style =
      s === 'match' || s === 'verified'
        ? { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' }
        : s === 'mismatch'
          ? { background: 'rgba(255,59,92,0.25)', color: 'var(--error)' }
          : { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };
    const label =
      s === 'match' ? 'Match' : s === 'verified' ? 'verified' : s.charAt(0).toUpperCase() + s.slice(1);
    return <span style={{ ...styles.badge, ...style }}>{label}</span>;
  };

  const docIcon = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'verified' || s === 'match') return '✓';
    return '⏱';
  };

  const docIconStyle = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'verified' || s === 'match') {
      return { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' };
    }
    return { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };
  };

  const runLink = async () => {
    await axios.post(`${API}/identity/link/${userId}`, {}, { headers: headers() });
    await load();
  };

  const approve = async () => {
    setMsg('');
    await runLink().catch(() => undefined);
    await axios.post(
      `${API}/kyc/attestation/publish`,
      {
        userId,
        status: 'Verified',
        documentType: 'identity_review',
        verificationMethod: data?.identityLinked
          ? 'full_identity_link_verified'
          : 'manual',
        identityLinked: Boolean(data?.identityLinked),
      },
      { headers: headers() }
    );
    setMsg('Approved & attested on-chain');
    await load();
  };

  const applyOverride = async () => {
    setMsg('');
    await axios.post(
      `${API}/identity/${userId}/override`,
      {
        checkType: 'id_to_phone',
        status: 'match',
        reason: overrideReason || 'manual review',
      },
      { headers: headers() }
    );
    setMsg('Manual override applied');
    await load();
  };

  const profile = data?.profile;
  const docs =
    data?.documentsSummary ||
    [
      { label: 'Ghana Card', status: 'pending' },
      { label: 'Driving license', status: 'pending' },
      { label: 'Vehicle registration', status: 'pending' },
    ];
  const links =
    data?.linkStatus ||
    [
      { label: 'National ID ↔ Driving license', status: 'pending' },
      { label: 'National ID ↔ Vehicle license', status: 'pending' },
      { label: 'National ID ↔ Phone number', status: 'pending' },
    ];

  return (
    <AdminShell activeLabel="Identity review" hidePageTitle>
      <AdminOpsNav />
      <div style={styles.profile}>
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" style={styles.avatarImg} />
        ) : (
          <div style={styles.avatar} />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={styles.name}>{profile?.name || 'Identity review'}</h1>
          <p style={styles.meta}>
            {profile ? (
              <>
                {profile.role}
                {profile.appliedAgo ? ` · ${profile.appliedAgo}` : ''}
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
      {msg ? <p style={{ color: 'var(--success)' }}>{msg}</p> : null}
      {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading…</p> : null}

      {!userId && !loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          No user selected. Open from Users/KYC or enter a user id.
        </p>
      ) : !loading && data ? (
        <>
          <div style={styles.grid}>
            <div style={styles.panel}>
              <p style={styles.panelLabel}>Identity link status</p>
              <ul style={styles.list}>
                {links.map((l: any) => (
                  <li key={l.type || l.label} style={styles.listRow}>
                    <span>{l.label}</span>
                    {statusBadge(l.status)}
                  </li>
                ))}
              </ul>
            </div>

            <div style={styles.docs}>
              {docs.map((d: any) => (
                <div key={d.type || d.label} style={styles.docCard}>
                  <div style={{ ...styles.docIcon, ...docIconStyle(d.status) }}>
                    {docIcon(d.status)}
                  </div>
                  <div>
                    <p style={styles.docLabel}>{d.label}</p>
                    <p style={styles.docStatus}>{String(d.status || 'pending').toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.actions}>
            <button style={styles.primaryBtn} onClick={() => approve().catch((e) => setError(e.message))}>
              Approve & attest on-chain
            </button>
            <button
              style={styles.secondaryBtnWide}
              onClick={() => applyOverride().catch((e) => setError(e.message))}
              title={overrideReason}
            >
              Manual override
            </button>
          </div>
          <input
            style={{ ...styles.input, marginTop: 12, width: '100%', maxWidth: 480 }}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Override reason (audit)"
          />
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
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    objectFit: 'cover',
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
  grid: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 24 },
  panel: {
    background: 'var(--surface-elevated)',
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
    padding: '14px 0',
    borderBottom: '1px solid var(--border)',
  },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  docCard: {
    background: 'var(--surface-elevated)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
  },
  docLabel: { margin: 0, fontWeight: 600 },
  docStatus: { margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13 },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  primaryBtn: {
    background: 'linear-gradient(90deg, #2dd4bf, #0055FF)',
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
