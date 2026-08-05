import React, { useEffect, useMemo, useState } from 'react';
import { BrowserProvider, Contract, parseUnits } from 'ethers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const DISTRIBUTOR_ABI = [
  'function claim(uint256 index, address account, uint256 amount, bytes32[] proof)',
  'function isClaimed(uint256 index) view returns (bool)',
];

/**
 * Phase 8 — lightweight claim DApp page (public-website).
 * Connects an external wallet and submits Merkle claim on-chain.
 */
const Claim: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [status, setStatus] = useState('');

  const distributor = useMemo(
    () => import.meta.env.VITE_DVT_MERKLE_DISTRIBUTOR_ADDRESS || '',
    []
  );

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setStatus('Install MetaMask or another injected wallet');
      return;
    }
    const provider = new BrowserProvider(eth);
    const accounts = await provider.send('eth_requestAccounts', []);
    setAccount(accounts[0]);
  };

  useEffect(() => {
    if (!account) return;
    // Public eligibility is authenticated in-app; here we expect query params for demo/ops
    const params = new URLSearchParams(window.location.search);
    const amount = params.get('amount');
    const index = params.get('index');
    const proof = params.get('proof');
    const root = params.get('root');
    if (amount && index && proof) {
      setEligibility({
        amount,
        index: Number(index),
        proof: JSON.parse(decodeURIComponent(proof)),
        merkleRoot: root,
        address: account,
      });
    }
  }, [account]);

  const claim = async () => {
    if (!account || !eligibility || !distributor) {
      setStatus('Missing wallet, eligibility, or distributor address');
      return;
    }
    try {
      const eth = (window as any).ethereum;
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const c = new Contract(distributor, DISTRIBUTOR_ABI, signer);
      const amountWei = parseUnits(String(eligibility.amount), 18);
      const tx = await c.claim(eligibility.index, account, amountWei, eligibility.proof);
      setStatus(`Submitted ${tx.hash}`);
      await tx.wait();
      setStatus(`Confirmed ${tx.hash}`);
      await fetch(`${API}/token/claim/mark-claimed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationId: eligibility.allocationId, txHash: tx.hash }),
      }).catch(() => undefined);
    } catch (err: any) {
      setStatus(err.message || 'Claim failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0A0A0A 0%, #6A00FF 55%, #0055FF 100%)',
        color: '#fff',
        padding: 32,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Claim DVT</h1>
      <p style={{ opacity: 0.85, marginBottom: 24 }}>Move. Shop. Deliver. — TGE airdrop</p>
      {!account ? (
        <button
          onClick={connect}
          style={{
            background: '#fff',
            color: '#6A00FF',
            border: 0,
            borderRadius: 8,
            padding: '12px 20px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Connect Wallet
        </button>
      ) : (
        <div>
          <p style={{ fontFamily: 'monospace', marginBottom: 16 }}>{account}</p>
          {eligibility ? (
            <>
              <p style={{ fontSize: 40, fontWeight: 700 }}>{eligibility.amount} DVT</p>
              <button
                onClick={claim}
                style={{
                  marginTop: 16,
                  background: '#3F7048',
                  color: '#fff',
                  border: 0,
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Claim on-chain
              </button>
            </>
          ) : (
            <p>Pass amount, index, and proof query params from the in-app eligibility response.</p>
          )}
        </div>
      )}
      {status && <p style={{ marginTop: 20 }}>{status}</p>}
    </div>
  );
};

export default Claim;
