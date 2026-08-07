import React from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Stake from './pages/Stake';
import MyStakes from './pages/MyStakes';
import Claim from './pages/Claim';

function Chrome({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  if (pathname === '/') return <>{children}</>;
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: 24 }}>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center' }}>
        <Link to="/" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
          Movr · Stake
        </Link>
        <Link to="/stake" style={{ color: '#A0A0A0', textDecoration: 'none' }}>
          Stake
        </Link>
        <Link to="/my-stakes" style={{ color: '#A0A0A0', textDecoration: 'none' }}>
          My Stakes
        </Link>
        <Link to="/claim" style={{ color: '#A0A0A0', textDecoration: 'none' }}>
          Claim
        </Link>
      </nav>
      {children}
    </div>
  );
}

/** Staking webapp — landing is full-bleed mockup; other routes keep minimal chrome. */
export default function App() {
  return (
    <Chrome>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/stake" element={<Stake />} />
        <Route path="/my-stakes" element={<MyStakes />} />
        <Route path="/claim" element={<Claim />} />
      </Routes>
    </Chrome>
  );
}
