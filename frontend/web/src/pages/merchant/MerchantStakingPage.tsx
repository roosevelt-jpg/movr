import React from 'react';
import { Link } from 'react-router-dom';
import MerchantShell from '../../layouts/MerchantShell';

/** Merchant crypto staking removed for store compliance. */
export default function MerchantStakingPage() {
  return (
    <MerchantShell activePath="/merchant">
      <div className="max-w-lg p-6">
        <h1 className="text-2xl font-bold mb-3">Merchant rewards</h1>
        <p className="text-white/60 mb-6">
          Token staking is not available. Manage payouts and store performance from your dashboard.
        </p>
        <Link to="/merchant" className="inline-flex rounded-full bg-white text-black px-5 py-2.5 font-semibold">
          Back to dashboard
        </Link>
      </div>
    </MerchantShell>
  );
}
