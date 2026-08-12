import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';

/**
 * Staking webapp routes collapsed — crypto staking is not offered.
 * Identity / KYC blockchain remains in the main Movr backend only.
 */
export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
