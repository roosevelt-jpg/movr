import React from 'react';
import { Link } from 'react-router-dom';

/** Crypto staking removed for store compliance. */
const StakingPage: React.FC = () => (
  <div className="min-h-[50vh] max-w-lg mx-auto p-6 text-center" data-force-dark>
    <h1 className="text-2xl font-bold mb-3">Rewards</h1>
    <p className="text-zinc-400 mb-6">
      Staking is not available in the app. Earn loyalty points on trips and redeem them for ride credit.
    </p>
    <Link to="/rewards" className="inline-flex rounded-full bg-white text-black px-5 py-2.5 font-semibold">
      View rewards
    </Link>
  </div>
);

export default StakingPage;
