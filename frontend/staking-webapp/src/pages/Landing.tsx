import React from 'react';

/**
 * DVT staking marketing site — decommissioned for App Store / Play Store compliance.
 * Keep this package offline; do not link from Movr consumer apps.
 */
export default function Landing() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 440 }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Not available</h1>
        <p style={{ color: '#a1a1aa', lineHeight: 1.5, marginBottom: 24 }}>
          Crypto token staking is not offered. Movr uses blockchain only for identity verification and
          protecting sensitive customer data. Open the Movr app for rides, wallet, and loyalty points.
        </p>
        <a
          href="https://mymovr.io"
          style={{
            display: 'inline-block',
            background: '#fff',
            color: '#000',
            padding: '12px 20px',
            borderRadius: 999,
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Go to Movr
        </a>
      </div>
    </main>
  );
}
