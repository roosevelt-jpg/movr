import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Settlement rails — MoMo, bank, cash agents, USSD, receipts, disputes. */
export default function SettlementHubPage() {
  const [rails, setRails] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [momo, setMomo] = useState({ provider: 'MTN MoMo', accountNumber: '', bankCode: '' });
  const [dispute, setDispute] = useState({ domain: 'wallet', reason: '' });
  const [confirmCode, setConfirmCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, rec, d] = await Promise.all([
        fetch(`${API}/trust/rails`, { headers: authHeaders() }).then((x) => x.json()),
        fetch(`${API}/trust/receipts`, { headers: authHeaders() }).then((x) => x.json()),
        fetch(`${API}/trust/disputes`, { headers: authHeaders() }).then((x) => x.json()),
      ]);
      setRails(r.data || null);
      setReceipts(rec.data || []);
      setDisputes(d.data || []);
      if (r.data?.cashAgents?.[0] && !agentId) setAgentId(r.data.cashAgents[0].id);
    } catch (e: any) {
      setMsg(e.message || 'Failed to load settlement hub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveMomo = async () => {
    const res = await fetch(`${API}/trust/rails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        railType: 'momo',
        provider: momo.provider,
        accountNumber: momo.accountNumber,
        bankCode: momo.bankCode || undefined,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'MoMo rail saved' : j.message || 'Failed');
    await load();
  };

  const agentAction = async (kind: 'deposit' | 'withdraw') => {
    const res = await fetch(`${API}/trust/cash-agent/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ agentId, amount: Number(amount) }),
    });
    const j = await res.json();
    setMsg(res.ok ? j.data?.message || 'Done' : j.message || 'Failed');
    await load();
  };

  const openDispute = async () => {
    const res = await fetch(`${API}/trust/disputes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(dispute),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Dispute opened' : j.message || 'Failed');
    setDispute({ domain: 'wallet', reason: '' });
    await load();
  };

  const confirmAgentCode = async () => {
    const res = await fetch(`${API}/trust/cash-agent/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ code: confirmCode }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? j.data?.credited
          ? 'Deposit credited'
          : j.data?.collected
            ? 'Pickup confirmed'
            : 'Confirmed'
        : j.message || 'Invalid code'
    );
    setConfirmCode('');
    await load();
  };

  const currency = 'NGN';
  const promise = rails?.promise;

  return (
    <div className="min-h-[70vh] max-w-2xl mx-auto p-6 space-y-6" data-force-dark>
      <div className="rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] text-white p-6">
        <p className="text-sm text-white/70 mb-1">Trust & Settlement</p>
        <h1 className="text-3xl font-extrabold">Move money. Keep trust.</h1>
        <p className="text-white/80 mt-2 text-sm">
          {promise?.matchSlaText} · {promise?.noShowText}
        </p>
        <p className="text-xs text-emerald-300 mt-3">{promise?.keep100Note}</p>
      </div>

      {loading ? <p className="text-zinc-400">Loading rails…</p> : null}
      {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-3">
        <h2 className="font-bold text-lg">Payment rails</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(rails?.channels || []).map((c: any) => (
            <div key={c.id} className="rounded-xl bg-zinc-900 p-3">
              <p className="font-semibold text-sm">{c.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{c.eta}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          USSD: <span className="text-white font-mono">{rails?.ussdCode || '*920*MOVR#'}</span> works
          offline
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-3">
        <h2 className="font-bold text-lg">Link MoMo / bank</h2>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          placeholder="Provider (MTN MoMo, Vodafone, Bank)"
          value={momo.provider}
          onChange={(e) => setMomo({ ...momo, provider: e.target.value })}
        />
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          placeholder="Bank / MoMo code (optional, e.g. MTN)"
          value={momo.bankCode}
          onChange={(e) => setMomo({ ...momo, bankCode: e.target.value })}
        />
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          placeholder="Account / MoMo number"
          value={momo.accountNumber}
          onChange={(e) => setMomo({ ...momo, accountNumber: e.target.value })}
        />
        <button type="button" onClick={saveMomo} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold">
          Save rail
        </button>
        <div className="space-y-1 text-sm text-zinc-400">
          {(rails?.methods || []).map((m: any) => (
            <p key={m.id}>
              {m.rail_type} · {m.provider} · {m.account_mask}
              {m.is_default ? ' · default' : ''}
            </p>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-3">
        <h2 className="font-bold text-lg">Cash agents</h2>
        <select
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          {(rails?.cashAgents || []).map((a: any) => (
            <option key={a.id} value={a.id}>
              {a.name} · {a.city}
            </option>
          ))}
        </select>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => agentAction('deposit')}
            className="flex-1 rounded-xl bg-emerald-700 py-2 font-bold"
          >
            Deposit cash
          </button>
          <button
            type="button"
            onClick={() => agentAction('withdraw')}
            className="flex-1 rounded-xl bg-zinc-800 py-2 font-bold"
          >
            Withdraw cash
          </button>
        </div>
        <p className="text-xs text-zinc-500">Deposits credit only after the agent confirms your code.</p>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          placeholder="Agent confirmation code"
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
        />
        <button type="button" onClick={confirmAgentCode} className="rounded-xl bg-zinc-800 px-4 py-2 font-bold">
          Confirm agent code
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-3">
        <h2 className="font-bold text-lg">Open a dispute</h2>
        <select
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={dispute.domain}
          onChange={(e) => setDispute({ ...dispute, domain: e.target.value })}
        >
          {['ride', 'shop', 'wallet', 'parcel', 'rental'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <textarea
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2 min-h-[80px]"
          placeholder="What went wrong?"
          value={dispute.reason}
          onChange={(e) => setDispute({ ...dispute, reason: e.target.value })}
        />
        <button type="button" onClick={openDispute} className="rounded-xl bg-orange-700 px-4 py-2 font-bold">
          Submit dispute
        </button>
        {disputes.slice(0, 3).map((d) => (
          <p key={d.id} className="text-xs text-zinc-500">
            {d.domain} · {d.status} · {d.reason}
          </p>
        ))}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-2">
        <h2 className="font-bold text-lg">Receipts</h2>
        {receipts.length === 0 ? (
          <p className="text-zinc-500 text-sm">No receipts yet.</p>
        ) : (
          receipts.slice(0, 8).map((r) => (
            <div key={r.id} className="flex justify-between text-sm border-b border-zinc-900 py-2">
              <div>
                <p className="font-semibold">{r.kind.replace(/_/g, ' ')}</p>
                <p className="text-zinc-500 text-xs">{r.reference}</p>
              </div>
              <p className="font-bold">{formatCurrency(Number(r.amount), r.currency || currency)}</p>
            </div>
          ))
        )}
      </section>

      <Link to="/wallet" className="block text-center text-zinc-500 text-sm">
        ← Back to wallet
      </Link>
    </div>
  );
}
