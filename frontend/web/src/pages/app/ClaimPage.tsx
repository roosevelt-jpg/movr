import React from 'react';
import { Link } from 'react-router-dom';

/** Crypto claim removed for store compliance. */
const ClaimPage: React.FC = () => (
  <div className="min-h-[50vh] max-w-lg mx-auto p-6 text-center" data-force-dark>
    <h1 className="text-2xl font-bold mb-3">Rewards</h1>
    <p className="text-zinc-400 mb-6">
      Token claims are not available. Open Wallet for ride credit and loyalty points.
    </p>
    <Link to="/wallet" className="inline-flex rounded-full bg-white text-black px-5 py-2.5 font-semibold">
      Open wallet
    </Link>
  </div>
);

export default ClaimPage;
