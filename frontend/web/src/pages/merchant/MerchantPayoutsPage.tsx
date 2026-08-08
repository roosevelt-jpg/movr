import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}`,
});

/** Merchant Payout — available balance, account, history, request CTA. */
export default function MerchantPayoutsPage() {
  const { formatMoney } = useLocalCurrency();
  const [summary, setSummary] = useState({
    available: 0,
    thisWeek: 0,
    movrFee: 0,
    movrFeePct: 0,
    net: 0,
    currency: 'NGN',
  });
  const [account, setAccount] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [kycMsg, setKycMsg] = useState('');

  const load = () => {
    Promise.all([
      axios.get(`${API}/merchant/earnings/summary`, { headers: headers() }).catch(() => null),
      axios.get(`${API}/merchant/payouts`, { headers: headers() }).catch(() => null),
    ]).then(([s, p]) => {
      const d = s?.data?.data;
      if (d) {
        setSummary((prev) => ({
          ...prev,
          available: Number(d.available ?? prev.available),
          thisWeek: Number(d.thisWeek ?? prev.thisWeek),
          movrFee: Number(d.movrFee ?? prev.movrFee),
          movrFeePct: Number(d.movrFeePct ?? 0),
          net: Number(d.net ?? prev.net),
          currency: d.currency || prev.currency,
        }));
        if (d.payoutAccount) {
          setAccount({
            bankName: d.payoutAccount.bankName || '',
            accountNumber: d.payoutAccount.accountNumber || '',
            accountName: d.payoutAccount.accountName || '',
          });
        } else if (d.accounts?.[0]) {
          const a = d.accounts[0];
          setAccount({
            bankName: a.bankName,
            accountNumber: a.accountNumber,
            accountName: a.accountName,
          });
        }
      }
      if (Array.isArray(p?.data?.data)) {
        setPayouts(
          p.data.data.map((row: any) => ({
            id: row.id,
            label: row.label || 'Weekly payout',
            detail: row.detail || row.statusLabel || '',
            amount: Number(row.amount || 0),
          }))
        );
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const amt = Number(summary.available || 0);
    if (!amt) {
      setKycMsg('');
      return;
    }
    axios
      .get(`${API}/trust/kyc-gate`, {
        headers: headers(),
        params: { amount: amt, role: 'merchant' },
      })
      .then((r) => {
        const d = r.data?.data;
        if (d && d.allowed === false) setKycMsg(d.message || 'KYC required for this payout');
        else setKycMsg('');
      })
      .catch(() => setKycMsg(''));
  }, [summary.available]);

  const requestPayout = async () => {
    if (kycMsg) {
      toast.error(kycMsg);
      return;
    }
    setBusy(true);
    try {
      await axios.post(
        `${API}/merchant/payouts/withdraw`,
        {
          amount: summary.available,
          bankAccount: {
            bankName: account?.bankName,
            accountNumber: account?.accountNumber,
            accountName: account?.accountName,
          },
          currency: summary.currency,
        },
        { headers: headers() }
      );
      toast.success('Payout requested');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Payout failed');
    } finally {
      setBusy(false);
    }
  };

  const addAccount = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      await axios.post(`${API}/merchant/payouts/accounts`, bankForm, { headers: headers() });
      toast.success('Account added');
      setShowAdd(false);
      setBankForm({ bankName: '', accountNumber: '', accountName: '' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add account');
    }
  };

  return (
    <MerchantShell activePath="/merchant/payouts">
      <div className="mx-auto max-w-lg pb-28 text-white">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Payout</h1>
        </div>

        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-violet-600 p-5">
          <p className="text-xs font-bold tracking-widest text-white/80">AVAILABLE BALANCE</p>
          <p className="mt-2 text-4xl font-extrabold">{formatMoney(summary.available)}</p>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/20 pt-4 text-center">
            <div>
              <p className="text-[10px] font-bold tracking-wide text-white/70">THIS WEEK</p>
              <p className="mt-1 text-sm font-bold">{formatMoney(summary.thisWeek)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wide text-white/70">
                MOVR FEE ({summary.movrFeePct}%)
              </p>
              <p className="mt-1 text-sm font-bold">{formatMoney(summary.movrFee)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wide text-white/70">NET</p>
              <p className="mt-1 text-sm font-bold">{formatMoney(summary.net)}</p>
            </div>
          </div>
        </div>

        <p className="mb-3 text-xs font-bold tracking-widest text-zinc-500">PAYOUT ACCOUNT</p>
        {account ? <div className="mb-2 flex items-center gap-3 rounded-2xl border-2 border-violet-500 bg-zinc-900 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-lg">🏦</div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {account.bankName} · {account.accountNumber}
            </p>
            <p className="text-sm text-zinc-400">{account.accountName}</p>
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-sm">✓</span>
        </div> : <p className="mb-2 text-sm text-zinc-500">No payout account added.</p>}
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="mb-6 text-sm font-semibold text-violet-400"
        >
          + Add another account
        </button>

        {showAdd ? (
          <form onSubmit={addAccount} className="mb-6 space-y-3 rounded-2xl bg-zinc-900 p-4">
            <input
              className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3"
              placeholder="Bank name"
              value={bankForm.bankName}
              onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3"
              placeholder="Account number"
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-xl border border-zinc-700 bg-black/40 px-4 py-3"
              placeholder="Account name"
              value={bankForm.accountName}
              onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
            />
            <button type="submit" className="w-full rounded-full bg-violet-600 py-3 font-bold">
              Save account
            </button>
          </form>
        ) : null}

        <p className="mb-3 text-xs font-bold tracking-widest text-zinc-500">PAYOUT HISTORY</p>
        <div className="space-y-3">
          {payouts.length === 0 ? (
            <p className="text-sm text-zinc-500">No payouts yet</p>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-emerald-400">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{p.label}</p>
                  <p className="text-sm text-zinc-500">{p.detail}</p>
                </div>
                <p className="font-bold text-emerald-400">{formatMoney(p.amount)}</p>
              </div>
            ))
          )}
        </div>

        <div className="sticky bottom-0 mt-8 border-t border-zinc-900 bg-black/95 p-4">
          <div className="mx-auto max-w-lg">
            {kycMsg ? <p className="mb-2 text-center text-sm text-amber-400">{kycMsg}</p> : null}
            <button
              type="button"
              disabled={busy || summary.available <= 0 || Boolean(kycMsg)}
              onClick={requestPayout}
              className="w-full rounded-full bg-gradient-to-r from-blue-500 to-violet-600 py-3.5 font-bold disabled:opacity-40"
            >
              {busy ? 'Requesting…' : `Request Payout · ${formatMoney(summary.available)}`}
            </button>
          </div>
        </div>
      </div>
    </MerchantShell>
  );
}
