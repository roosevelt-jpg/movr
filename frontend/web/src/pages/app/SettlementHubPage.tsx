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
  const [corridors, setCorridors] = useState<any[]>([]);
  const [corridorId, setCorridorId] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftAmount, setGiftAmount] = useState('50');
  const [claimCode, setClaimCode] = useState('');
  const [giftQuote, setGiftQuote] = useState<any>(null);
  const [family, setFamily] = useState<any[]>([]);
  const [circleName, setCircleName] = useState('Family');
  const [memberId, setMemberId] = useState('');
  const [directGiftAmt, setDirectGiftAmt] = useState('20');
  const [directGiftPhone, setDirectGiftPhone] = useState('');
  const showGifts =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('gifts') === '1';

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
    fetch(`${API}/rails/remittance/corridors`)
      .then((r) => r.json())
      .then((j) => {
        const rows = j?.data || [];
        setCorridors(rows);
        if (rows[0]) setCorridorId(rows[0].id);
      })
      .catch(() => undefined);
    fetch(`${API}/rails/family`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setFamily(j?.data || []))
      .catch(() => undefined);
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

  const quoteGift = async () => {
    if (!corridorId) return;
    const res = await fetch(`${API}/rails/remittance/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ corridorId, amountFrom: Number(giftAmount) }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.message || 'Quote failed');
      return;
    }
    setGiftQuote(j.data);
    setMsg(`Quote: ${j.data.creditTo} ${j.data.currencyTo} ride credit after fees`);
  };

  const sendGift = async () => {
    const res = await fetch(`${API}/rails/remittance/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        corridorId,
        amountFrom: Number(giftAmount),
        recipientPhone: giftPhone,
      }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? `Gift sent · claim code ${j.data?.claim_code || j.data?.claimCode || ''}`
        : j.message || 'Send failed'
    );
  };

  const claimGift = async () => {
    const res = await fetch(`${API}/rails/remittance/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ claimCode }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Ride gift claimed into mobility credit' : j.message || 'Claim failed');
    setClaimCode('');
  };

  const createCircle = async () => {
    const res = await fetch(`${API}/rails/family/circles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: circleName || 'Family' }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Family circle created' : j.message || 'Failed');
    const fam = await fetch(`${API}/rails/family`, { headers: authHeaders() }).then((r) => r.json());
    setFamily(fam?.data || []);
  };

  const addMember = async () => {
    const circle = family.find((c) => c.role === 'owner') || family[0];
    if (!circle?.id || !memberId) {
      setMsg('Create a circle and enter member user id');
      return;
    }
    const res = await fetch(`${API}/rails/family/circles/${circle.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ memberId, dailyLimit: 50 }),
    });
    const j = await res.json();
    setMsg(res.ok ? 'Member added' : j.message || 'Failed');
  };

  const sendDirectGift = async () => {
    const res = await fetch(`${API}/rails/remittance/gift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        amount: Number(directGiftAmt),
        recipientPhone: directGiftPhone,
        note: 'Ride gift',
      }),
    });
    const j = await res.json();
    setMsg(
      res.ok
        ? `Gift sent · claim ${j.data?.claim_code || j.data?.claimCode || ''}`
        : j.message || 'Gift failed'
    );
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

      <section
        id="gifts"
        className={`rounded-2xl border p-5 text-white space-y-3 ${
          showGifts ? 'border-emerald-600 bg-zinc-950' : 'border-zinc-800 bg-zinc-950'
        }`}
      >
        <h2 className="font-bold text-lg">Family remittance → ride gifts</h2>
        <p className="text-xs text-zinc-500">
          Diaspora corridors fund ring-fenced mobility credit — not a licensed money transmitter.
        </p>
        <select
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={corridorId}
          onChange={(e) => setCorridorId(e.target.value)}
        >
          {corridors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.currency_from}→{c.currency_to})
            </option>
          ))}
        </select>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          type="number"
          value={giftAmount}
          onChange={(e) => setGiftAmount(e.target.value)}
          placeholder="Amount (from currency)"
        />
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={giftPhone}
          onChange={(e) => setGiftPhone(e.target.value)}
          placeholder="Recipient phone"
        />
        <div className="flex gap-2">
          <button type="button" onClick={quoteGift} className="flex-1 rounded-xl bg-zinc-800 py-2 font-bold">
            Quote
          </button>
          <button type="button" onClick={sendGift} className="flex-1 rounded-xl bg-emerald-700 py-2 font-bold">
            Send gift
          </button>
        </div>
        {giftQuote ? (
          <p className="text-xs text-zinc-400">
            Fee {giftQuote.fee} · credit {giftQuote.creditTo} {giftQuote.currencyTo}
          </p>
        ) : null}
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          placeholder="Claim code"
          value={claimCode}
          onChange={(e) => setClaimCode(e.target.value)}
        />
        <button type="button" onClick={claimGift} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold">
          Claim gift
        </button>
        <p className="text-xs text-zinc-500 pt-2">Or send a local ride gift (no FX corridor)</p>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          type="number"
          value={directGiftAmt}
          onChange={(e) => setDirectGiftAmt(e.target.value)}
          placeholder="Amount"
        />
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={directGiftPhone}
          onChange={(e) => setDirectGiftPhone(e.target.value)}
          placeholder="Recipient phone"
        />
        <button type="button" onClick={sendDirectGift} className="rounded-xl bg-zinc-800 px-4 py-2 font-bold">
          Send local gift
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white space-y-3">
        <h2 className="font-bold text-lg">Family share circle</h2>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={circleName}
          onChange={(e) => setCircleName(e.target.value)}
          placeholder="Circle name"
        />
        <button type="button" onClick={createCircle} className="rounded-xl bg-indigo-600 px-4 py-2 font-bold">
          Create circle
        </button>
        <input
          className="w-full rounded-xl bg-black border border-zinc-700 px-3 py-2"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          placeholder="Member user id (UUID)"
        />
        <button type="button" onClick={addMember} className="rounded-xl bg-zinc-800 px-4 py-2 font-bold">
          Add member
        </button>
        {family.map((c) => (
          <p key={c.id} className="text-xs text-zinc-400">
            {c.name} · {c.role} · {c.currency || ''}
          </p>
        ))}
      </section>

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
