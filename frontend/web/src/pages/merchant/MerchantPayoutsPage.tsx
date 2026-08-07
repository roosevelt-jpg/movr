import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

/** Earnings & payouts — balances, withdraw, recent payouts. */
export default function MerchantPayoutsPage() {
  const { currency, formatMoney } = useLocalCurrency();
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('GCB');
  const [bankName, setBankName] = useState('GCB Bank');
  const [summary, setSummary] = useState({
    available: 0,
    month: 0,
    pending: 0,
  });
  const [payouts, setPayouts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    Promise.all([
      axios.get(`${API}/merchant/earnings/summary`, { headers: headers() }).catch(() => null),
      axios.get(`${API}/merchant/payouts`, { headers: headers() }).catch(() => null),
      axios.get(`${API}/merchant/balance`, { headers: headers() }).catch(() => null),
    ]).then(([s, p, b]) => {
      const sum = s?.data?.data;
      const bal = b?.data?.data;
      setSummary({
        available: Number(sum?.available ?? bal?.available ?? 0),
        month: Number(sum?.thisMonth ?? sum?.month ?? 0),
        pending: Number(sum?.pending ?? bal?.pending ?? 0),
      });
      const acct = sum?.payoutAccount;
      if (acct?.bankName) setBankName(acct.bankName);
      if (acct?.bankCode) setBankCode(acct.bankCode);
      if (acct?.accountNumber) setAccountNumber(String(acct.accountNumber).replace(/\*/g, '') || '');
      if (Array.isArray(p?.data?.data)) {
        setPayouts(
          p.data.data.map((row: any) => ({
            id: row.id,
            label: row.label || 'Weekly payout',
            amount: Number(row.amount || 0),
            status: row.statusLabel || row.status || 'Pending',
          }))
        );
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const withdraw = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await axios.post(
        `${API}/merchant/payouts/withdraw`,
        {
          amount: Number(amount),
          bankAccount: { accountNumber, bankCode, bankName },
          currency,
        },
        { headers: headers() }
      );
      toast.success('Payout requested');
      setAmount('');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payout failed');
    }
  };

  return (
    <MerchantShell activePath="/merchant/payouts">
      <h1 className="text-3xl font-bold text-white mb-6">Earnings & payouts</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Available balance', value: summary.available },
          { label: 'This month', value: summary.month },
          { label: 'Pending settlement', value: summary.pending },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl bg-[#1A1A1A] p-5">
            <p className="text-sm text-[#888888]">{c.label}</p>
            <p className="text-3xl font-bold mt-3 text-white">{formatMoney(Number(c.value))}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold bg-movr-gradient text-white mb-6"
      >
        <Download size={16} /> Withdraw to bank
      </button>

      {showForm ? (
        <form
          onSubmit={withdraw}
          className="max-w-lg space-y-3 bg-[#1A1A1A] rounded-2xl p-5 mb-6"
        >
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white"
            placeholder={`Amount (${currency})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white"
            placeholder="Account number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white"
            placeholder="Bank name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <button type="submit" className="w-full rounded-full py-3 font-semibold bg-movr-gradient text-white">
            Confirm withdrawal
          </button>
        </form>
      ) : null}

      <p className="text-sm text-[#888888] mb-3">Recent payouts</p>
      <div className="space-y-2">
        {payouts.length === 0 ? (
          <p className="text-sm text-[#888888]">No payouts yet</p>
        ) : (
          payouts.map((p) => {
            const done =
              String(p.status).toLowerCase() === 'completed' ||
              String(p.status).toLowerCase() === 'paid';
            return (
              <div
                key={p.id}
                className="flex justify-between gap-4 rounded-xl bg-[#1A1A1A] px-4 py-3"
              >
                <span className="text-white">{p.label}</span>
                <span className={`font-medium ${done ? 'text-emerald-400' : 'text-[#888888]'}`}>
                  {formatMoney(Number(p.amount))} · {p.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </MerchantShell>
  );
}
