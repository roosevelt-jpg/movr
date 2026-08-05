import React from 'react';

/** Reuses Merkle claim pattern from Phase 8 public Claim page. */
export default function Claim() {
  const dapp =
    import.meta.env.VITE_CLAIM_PAGE_URL ||
    (typeof window !== 'undefined' ? `${window.location.origin}/claim-external` : '/claim');

  return (
    <div className="panel">
      <h1>Claim airdrop</h1>
      <p className="muted">
        Opens the Merkle claim flow against DVT_MERKLE_DISTRIBUTOR_ADDRESS using your connected
        wallet.
      </p>
      <a className="btn" href={dapp}>
        Open claim flow
      </a>
    </div>
  );
}
