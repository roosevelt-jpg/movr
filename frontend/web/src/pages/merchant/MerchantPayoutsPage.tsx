import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

export default function MerchantPayoutsPage() {
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');

  const withdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API}/merchant/payouts/withdraw`,
        {
          amount: Number(amount),
          bankAccount: { accountNumber, bankCode },
          currency: 'GHS',
        },
        { headers: headers() }
      );
      toast.success('Payout requested');
      setAmount('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payout failed');
    }
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white p-6 max-w-lg">
      <Link to="/merchant/dashboard" className="text-motion-blue text-sm">← Dashboard</Link>
      <h1 className="text-2xl font-semibold mt-4 mb-2">Payouts</h1>
      <p className="text-text-secondary mb-6">Withdraw store earnings.</p>
      <form onSubmit={withdraw} className="space-y-3 bg-surface border border-border rounded-lg p-6">
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Amount (GHS)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        <input className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3" placeholder="Bank code" value={bankCode} onChange={(e) => setBankCode(e.target.value)} />
        <button className="w-full rounded-pill bg-movr-gradient py-3 font-semibold">Request payout</button>
      </form>
    </div>
  );
}
