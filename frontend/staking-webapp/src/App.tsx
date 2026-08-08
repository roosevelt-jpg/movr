import React, { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Stake from './pages/Stake';
import MyStakes from './pages/MyStakes';
import Claim from './pages/Claim';
import Governance from './pages/Governance';
import Docs from './pages/Docs';

function shortWallet(w: string) {
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function Chrome({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [account, setAccount] = useState<string | null>(null);

  if (pathname === '/') return <>{children}</>;

  const link = (to: string, label: string) => {
    const active =
      pathname === to ||
      (to === '/stake' && (pathname === '/stake' || pathname === '/my-stakes')) ||
      (to !== '/' && to !== '/stake' && pathname.startsWith(to));
    return (
      <Link
        to={to}
        style={{
          color: active ? '#fff' : '#A0A0A0',
          textDecoration: 'none',
          fontWeight: active ? 600 : 500,
        }}
      >
        {label}
      </Link>
    );
  };

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setAccount('0x3a4f9d2c00000000000000000000000000009d2c');
      return;
    }
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0]);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#05050a', color: '#fff', padding: '20px 28px' }}>
      <nav
        style={{
          display: 'flex',
          gap: 28,
          marginBottom: 28,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={{ color: '#fff', fontWeight: 800, textDecoration: 'none', fontSize: 22 }}>
            Movr
          </Link>
          {link('/', 'Home')}
          {link('/stake', 'Staking')}
          {link('/governance', 'Governance')}
          {link('/docs', 'Docs')}
          {link('/claim', 'DVT Token')}
        </div>
        <button
          type="button"
          onClick={connect}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#141414',
            border: '1px solid #333',
            borderRadius: 999,
            padding: '8px 14px',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: account ? '#22c55e' : '#666',
            }}
          />
          {account ? shortWallet(account) : 'Connect'}
        </button>
      </nav>
      {children}
    </div>
  );
}

/** Staking webapp — landing is full-bleed mockup; other routes keep chrome. */
export default function App() {
  return (
    <Chrome>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/stake" element={<Stake />} />
        <Route path="/my-stakes" element={<MyStakes />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </Chrome>
  );
}
