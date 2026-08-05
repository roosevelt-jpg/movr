import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Earnings & payouts — balances, withdraw, recent payouts. */
export default function MerchantPayoutsPage() {
  const { currency, formatMoney } = useLocalCurrency();
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [summary, setSummary] = useState({
    available: 0,
    month: 0,
    pending: 0,
  });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/merchant/earnings?period=monthly`, { headers: headers() }).catch(() => null),
      axios.get(`${API}/merchant/payouts`, { headers: headers() }).catch(() => null),
      axios.get(`${API}/merchant/balance`, { headers: headers() }).catch(() => null),
    ]).then(([e, p, b]) => {
      const earnings = e?.data?.data;
      const bal = b?.data?.data;
      setSummary({
        available: Number(bal?.available ?? bal?.balance ?? earnings?.available ?? 0),
        month: Number(earnings?.total ?? earnings?.month ?? 0),
        pending: Number(bal?.pending ?? earnings?.pending ?? 0),
      });
      if (Array.isArray(p?.data?.data)) {
        setPayouts(
          p.data.data.map((row: any) => ({
            id: row.id,
            label: row.label || row.reference_id || 'Payout',
            amount: Number(row.amount || 0),
            status: row.status || 'Pending',
          }))
        );
      }
    });
  }, []);

  const withdraw = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await axios.post(
        `${API}/merchant/payouts/withdraw`,
        {
          amount: Number(amount),
          bankAccount: { accountNumber, bankCode },
          currency,
        },
        { headers: headers() }
      );
      toast.success('Payout requested');
      setAmount('');
      setShowForm(false);
      setPayouts((prev) => [
        {
          id: String(Date.now()),
          label: `Payout · ${bankCode || 'Bank'}`,
          amount: Number(amount),
          status: 'Pending',
        },
        ...prev,
      ]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payout failed');
    }
  };

  return (
    <MerchantShell activePath="/merchant/payouts">
      <h1 className="text-3xl font-bold mb-6">Earnings & payouts</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Available balance', value: summary.available },
          { label: 'This month', value: summary.month },
          { label: 'Pending settlement', value: summary.pending },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-[#121212] border border-[#2A2A2A] p-5">
            <p className="text-sm text-[#A0A0A0]">{c.label}</p>
            <p className="text-3xl font-bold mt-3">{formatMoney(Number(c.value))}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowForm((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF] mb-6"
      >
        ↓ Withdraw to bank
      </button>

      {showForm ? (
        <form
          onSubmit={withdraw}
          className="max-w-lg space-y-3 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 mb-6"
        >
          <input
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
            placeholder={`Amount (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
            placeholder="Bank code"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          />
          <button className="w-full rounded-xl py-3 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]">
            Confirm withdrawal
          </button>
        </form>
      ) : null}

      <p className="text-sm text-[#A0A0A0] mb-3">Recent payouts</p>
      <div className="space-y-2">
        {payouts.length === 0 ? (
          <p className="text-sm text-[#8E8E93]">No payouts yet</p>
        ) : (
          payouts.map((p) => (
            <div
              key={p.id}
              className="flex justify-between gap-4 rounded-xl bg-[#121212] border border-[#2A2A2A] px-4 py-3"
            >
              <span>{p.label}</span>
              <span className="text-[#9BE0A8] font-medium">
                {formatMoney(Number(p.amount))} · {p.status}
              </span>
            </div>
          ))
        )}
      </div>
    </MerchantShell>
  );
}
