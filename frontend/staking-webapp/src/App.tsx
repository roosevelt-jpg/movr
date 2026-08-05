import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Stake from './pages/Stake';
import MyStakes from './pages/MyStakes';
import Claim from './pages/Claim';

export default function App() {
  return (
    <div className="shell">
      <nav className="nav">
        <Link to="/" className="brand">
          MOVR STAKE
        </Link>
        <Link to="/stake">Stake</Link>
        <Link to="/my-stakes">My Stakes</Link>
        <Link to="/claim">Claim</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/stake" element={<Stake />} />
        <Route path="/my-stakes" element={<MyStakes />} />
        <Route path="/claim" element={<Claim />} />
      </Routes>
    </div>
  );
}
