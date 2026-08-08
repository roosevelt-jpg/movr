import React from 'react';
import { Link } from 'react-router-dom';

/** Placeholder docs page. */
export default function Docs() {
  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 800 }}>Docs</h1>
      <p style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 520, lineHeight: 1.6 }}>
        Learn how staking works, lock periods, rewards accrual, and claiming. Full documentation will live here.
      </p>
      <Link to="/stake" style={{ color: '#a78bfa', fontWeight: 600 }}>
        Go to Stake →
      </Link>
    </div>
  );
}
