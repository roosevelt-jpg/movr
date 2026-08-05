import React, { useEffect, useState } from 'react';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';
const CLAIM_DAPP =
  (import.meta as any).env?.VITE_CLAIM_DAPP_URL ||
  'http://localhost:5174/claim';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Phase 8 — Claim DVT (custodial or external wallet DApp) */
const ClaimPage: React.FC = () => {
  const [eligibility, setEligibility] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const load = () => {
    fetch(`${API}/token/claim/eligibility`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setEligibility(j.data));
  };

  useEffect(() => {
    load();
  }, []);

  const claimCustodial = async () => {
    setMsg('');
    const res = await fetch(`${API}/token/claim/custodial`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    });
    const json = await res.json();
    setMsg(json.message || (res.ok ? 'Claimed via custodial wallet' : 'Failed'));
    load();
  };

  const openExternal = () => {
    window.open(CLAIM_DAPP, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-movr-gradient">
        <h1 className="text-3xl font-bold">Claim DVT</h1>
        <p className="text-pure-white/80 mt-2">Merkle airdrop eligibility from the latest snapshot</p>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        {!eligibility?.eligible ? (
          <p className="text-gray-600">No claimable allocation for your account right now.</p>
        ) : (
          <>
            <p className="text-4xl font-bold">{Number(eligibility.amount).toFixed(2)} DVT</p>
            <p className="text-sm text-gray-500 font-mono">{eligibility.address}</p>
            <p className="text-sm">Mode: {eligibility.claimMode}</p>
            <div className="flex flex-wrap gap-3">
              {eligibility.claimMode === 'custodial' ? (
                <button
                  onClick={claimCustodial}
                  className="bg-electric-violet text-pure-white px-5 py-2 rounded-lg font-semibold"
                >
                  Claim (custodial)
                </button>
              ) : (
                <button
                  onClick={openExternal}
                  className="bg-motion-blue text-pure-white px-5 py-2 rounded-lg font-semibold"
                >
                  Open claim DApp
                </button>
              )}
            </div>
          </>
        )}
        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  );
};

export default ClaimPage;
