import React from 'react';
import { Link } from 'react-router-dom';

/** Crypto token redeem removed for store compliance. */
const TokenPage: React.FC = () => (
  <div className="min-h-[50vh] max-w-lg mx-auto p-6 text-center" data-force-dark>
    <h1 className="text-2xl font-bold mb-3">Rewards</h1>
    <p className="text-zinc-400 mb-6">
      Movr does not offer crypto tokens in the app. Use your wallet for fiat balance, ride credit, and
      loyalty points.
    </p>
    <Link to="/wallet" className="inline-flex rounded-full bg-white text-black px-5 py-2.5 font-semibold">
      Open wallet
    </Link>
  </div>
);

export default TokenPage;
