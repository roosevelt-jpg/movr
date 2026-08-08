import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import AdminOpsNav from '../components/AdminOpsNav';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin identity review — applicant, documents, link status, approve / override. */
export default function IdentityLinkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get('userId') || searchParams.get('user') || '';
  const [userId, setUserId] = useState(queryUserId);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'override' | 'link' | null>(null);
  const [msg, setMsg] = useState('');
  const [overrideReason, setOverrideReason] = useState('Fleet vehicle / manual review');

  const load = async (id = userId, syncUrl = false) => {
    const trimmed = String(id || '').trim();
    if (!trimmed) {
      setData(null);
      setLoading(false);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await axios.get(`${API}/identity/${trimmed}`, { headers: headers() });
      setData(res.data.data);
      setUserId(trimmed);
      if (syncUrl) {
        navigate(`/identity?userId=${encodeURIComponent(trimmed)}`, { replace: true });
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryUserId]);

  const statusBadge = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    const style =
      s === 'match' || s === 'verified'
        ? { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' }
        : s === 'mismatch' || s === 'rejected'
          ? { background: 'rgba(255,59,92,0.25)', color: 'var(--error)' }
          : { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };
    const label =
      s === 'match'
        ? 'Match'
        : s === 'verified'
          ? 'verified'
          : s === 'unverifiable'
            ? 'Unverifiable'
            : s.charAt(0).toUpperCase() + s.slice(1);
    return <span style={{ ...styles.badge, ...style }}>{label}</span>;
  };

  const docIcon = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'verified' || s === 'match') return '✓';
    if (s === 'rejected' || s === 'mismatch') return '✗';
    return '⏱';
  };

  const docIconStyle = (status?: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'verified' || s === 'match') {
      return { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' };
    }
    if (s === 'rejected' || s === 'mismatch') {
      return { background: 'rgba(255,59,92,0.25)', color: 'var(--error)' };
    }
    return { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };
  };

  const runLink = async () => {
    setBusy('link');
    setError('');
    setMsg('');
    try {
      await axios.post(`${API}/identity/link/${userId}`, {}, { headers: headers() });
      setMsg('Identity link checks refreshed');
      await load(userId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Link failed');
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    if (!userId) return;
    setBusy('approve');
    setError('');
    setMsg('');
    try {
      const res = await axios.post(
        `${API}/identity/${userId}/approve`,
        { reason: overrideReason || 'Approved & attested on-chain' },
        { headers: headers() }
      );
      const att = res.data?.data?.attestation;
      setMsg(
        att?.txHash
          ? `Approved & attested on-chain · ${String(att.txHash).slice(0, 18)}…`
          : 'Approved & attested on-chain'
      );
      await load(userId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Approve failed');
    } finally {
      setBusy(null);
    }
  };

  const applyOverride = async () => {
    if (!userId) return;
    setBusy('override');
    setError('');
    setMsg('');
    try {
      await axios.post(
        `${API}/identity/${userId}/override`,
        {
          checkType: 'all',
          status: 'match',
          reason: overrideReason || 'manual review',
        },
        { headers: headers() }
      );
      setMsg('Manual override applied to all identity checks');
      await load(userId);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Override failed');
    } finally {
      setBusy(null);
    }
  };

  const profile = data?.profile;
  const docs = data?.documentsSummary || [];
  const links = data?.linkStatus || [];
  const attestation = data?.attestation;
  const attested =
    String(attestation?.status || '').toLowerCase() === 'verified' ||
    Boolean(data?.identityLinked && data?.kycStatus === 'approved');

  return (
    <AdminShell activeLabel="Identity review" hidePageTitle>
      <AdminOpsNav />
      <div style={styles.profile}>
        {profile?.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" style={styles.avatarImg} />
        ) : (
          <div style={styles.avatar} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={styles.name}>{profile?.name || 'Identity review'}</h1>
          <p style={styles.meta}>
            {profile ? (
              <>
                {profile.role}
                {profile.appliedAgo ? ` · ${profile.appliedAgo}` : ''}
                {data?.kycStatus ? ` · KYC ${data.kycStatus}` : ''}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') load(userId, true).catch(() => undefined);
            }}
          />
          <button
            type="button"
            style={styles.secondaryBtn}
            onClick={() => load(userId, true).catch(() => undefined)}
            disabled={loading}
          >
            Load
          </button>
        </div>
      </div>

      {attested ? (
        <p style={styles.attestedBanner}>
          Approved & attested on-chain
          {attestation?.txHash ? (
            attestation.explorerUrl ? (
              <>
                {' · '}
                <a href={attestation.explorerUrl} target="_blank" rel="noreferrer" style={styles.link}>
                  {String(attestation.txHash).slice(0, 16)}…
                </a>
              </>
            ) : (
              ` · ${String(attestation.txHash).slice(0, 16)}…`
            )
          ) : null}
        </p>
      ) : null}

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
                  <div style={{ minWidth: 0 }}>
                    <p style={styles.docLabel}>{d.label}</p>
                    <p style={styles.docStatus}>{String(d.status || 'pending').toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.actions} className="admin-actions">
            <button
              type="button"
              style={styles.primaryBtn}
              disabled={Boolean(busy) || attested}
              onClick={() => approve()}
            >
              {busy === 'approve' ? 'Approving…' : attested ? 'Already attested' : 'Approve & attest on-chain'}
            </button>
            <button
              type="button"
              style={styles.secondaryBtnWide}
              disabled={Boolean(busy)}
              onClick={() => applyOverride()}
              title={overrideReason}
            >
              {busy === 'override' ? 'Applying…' : 'Manual override'}
            </button>
          </div>
          <div style={styles.tools}>
            <input
              style={{ ...styles.input, flex: 1, minWidth: 200 }}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Override / approve reason (audit)"
            />
            <button
              type="button"
              style={styles.secondaryBtn}
              disabled={Boolean(busy)}
              onClick={() => runLink()}
            >
              {busy === 'link' ? 'Linking…' : 'Re-run link checks'}
            </button>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  profile: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' },
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
  lookup: { marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    minWidth: 0,
  },
  attestedBanner: {
    color: 'var(--success)',
    fontWeight: 700,
    margin: '0 0 16px',
  },
  link: { color: 'var(--motion-blue)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(220px, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
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
    gap: 12,
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
    flexShrink: 0,
  },
  docLabel: { margin: 0, fontWeight: 600 },
  docStatus: { margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13 },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  tools: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
    maxWidth: 640,
  },
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  secondaryBtnWide: { ...adminBtn.secondary },
};
