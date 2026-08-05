import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
});

/** Phase 8 — create Merkle airdrop snapshot for custodial / external claim. */
export default function AirdropsPage() {
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('100');
  const [label, setLabel] = useState('Ops airdrop');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      toast.error('userId required');
      return;
    }
    setBusy(true);
    setResult('');
    try {
      const res = await axios.post(
        `${API}/token/admin/airdrop-snapshot`,
        {
          label: label || undefined,
          allocations: [{ userId: userId.trim(), amount: Number(amount) }],
        },
        { headers: headers() }
      );
      const data = res.data?.data;
      setResult(
        `Snapshot ${data?.snapshot?.id || 'created'} · root ${String(data?.root || '').slice(0, 18)}… · ${data?.count || 0} allocation(s)`
      );
      toast.success('Airdrop snapshot created — user can claim');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell activeLabel="Airdrops">
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>DVT airdrop claims</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
          Create a Merkle snapshot allocation. With <code>CLAIM_CUSTODIAL_ENABLED</code>, the user
          claims in-app at /claim.
        </p>
        <form onSubmit={create} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            User ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID of recipient"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Amount (DVT)
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
          </label>
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 8,
              border: 0,
              borderRadius: 12,
              padding: '12px 16px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #7C3AED, #2563EB)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {busy ? 'Creating…' : 'Create snapshot'}
          </button>
        </form>
        {result ? (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>{result}</p>
        ) : null}
      </div>
    </AdminShell>
  );
}

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
};
