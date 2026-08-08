import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';

/** Accept admin invite — set password and join the team. */
export default function InviteAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing invite token');
      setLoading(false);
      return;
    }
    fetch(`${API}/admin/team/invites/preview?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || 'Invalid invite');
        setEmail(j.data.email);
        setRoles(j.data.roles || []);
      })
      .catch((e) => setError(e.message || 'Invalid invite'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/team/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, firstName, lastName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not accept invite');
      toast.success('Welcome to the team — sign in');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Accept failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--jet-black)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: 'Poppins, Montserrat, sans-serif',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>Join Movr Admin</h1>
        {loading ? <p style={{ color: 'var(--text-secondary)' }}>Checking invite…</p> : null}
        {error ? (
          <>
            <p style={{ color: 'var(--error)' }}>{error}</p>
            <Link to="/login" style={{ color: 'var(--motion-blue)' }}>
              Back to login
            </Link>
          </>
        ) : null}
        {!loading && !error ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
              Invited as <strong>{email}</strong>
              <br />
              Roles: {(roles || []).join(', ') || '—'}
            </p>
            <label style={label}>First name</label>
            <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <label style={label}>Last name</label>
            <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <label style={label}>Password</label>
            <input
              style={input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <label style={label}>Confirm password</label>
            <input
              style={input}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" style={{ ...adminBtn.block, marginTop: 16 }} disabled={busy}>
              {busy ? 'Creating account…' : 'Accept invite'}
            </button>
          </>
        ) : null}
      </form>
    </div>
  );
}

const label: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  marginTop: 12,
};
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
};
