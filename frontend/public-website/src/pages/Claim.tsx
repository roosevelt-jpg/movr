import React from 'react';

/**
 * Public crypto claim page decommissioned for store / app-store compliance.
 * Blockchain remains for identity verification only — not token claims.
 */
const Claim: React.FC = () => {
  return (
    <main style={{ maxWidth: 480, margin: '4rem auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Rewards</h1>
      <p style={{ color: '#52525b', lineHeight: 1.5, marginBottom: 24 }}>
        Crypto token claims are not available. Movr uses fiat payments, mobile money, ride credit, and
        loyalty points. Blockchain is used only for identity verification and protecting sensitive
        customer data.
      </p>
      <a
        href="https://mymovr.io"
        style={{
          display: 'inline-block',
          background: '#111',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 999,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Go to Movr
      </a>
    </main>
  );
};

export default Claim;
