import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowLeftRight, CreditCard, Landmark } from 'lucide-react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
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

const ICONS: Record<string, string> = {
  topup: '↓',
  ride: '🚗',
  points: '★',
  parcel: '📦',
  withdraw: '↑',
  transfer: '↔',
  tx: '•',
};

/** My Wallet — fiat, ride credit, and loyalty points (no crypto tokens). */
const WalletPage: React.FC = () => {
  const { currency: locCurrency } = useLocalCurrency();
  const [portfolio, setPortfolio] = useState(0);
  const [fiat, setFiat] = useState(0);
  const [points, setPoints] = useState(0);
  const [currency, setCurrency] = useState(locCurrency || 'NGN');
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [promise, setPromise] = useState<any>(null);
  const [mobilityCredit, setMobilityCredit] = useState(0);

  useEffect(() => {
    fetch(`${API}/wallet/portfolio`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) throw new Error('Wallet data is unavailable');
        setPortfolio(Number(d.portfolioValue ?? 0));
        setFiat(Number(d.fiatBalance ?? 0));
        setPoints(Number(d.points ?? 0));
        setCurrency(d.currency || locCurrency || 'NGN');
        if (Array.isArray(d.transactions)) {
          setTxs(d.transactions.filter((t: any) => t.unit !== 'dvt' && t.icon !== 'dvt'));
        }
      })
      .catch(() => setError('Could not load wallet'))
      .finally(() => setLoading(false));
    fetch(`${API}/rails/credit`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMobilityCredit(Number(j?.data?.mobilityCredit || 0)))
      .catch(() => undefined);
    fetch(`${API}/trust/promise`)
      .then((r) => r.json())
      .then((j) => setPromise(j?.data || null))
      .catch(() => undefined);
  }, [locCurrency]);

  const fmt = (n: number) => formatCurrency(Math.abs(n), currency);

  const actions = [
    { label: 'Top Up', icon: ArrowUp, to: '/wallet/topup' },
    { label: 'Ride credit', icon: Landmark, to: '/wallet/topup?mobility=1' },
    { label: 'Family gifts', icon: ArrowLeftRight, to: '/wallet/settlement?gifts=1' },
    { label: 'Settle', icon: Landmark, to: '/wallet/settlement' },
    { label: 'Cards', icon: CreditCard, to: '/wallet/payment-methods' },
    { label: 'Withdraw', icon: ArrowDown, to: '/wallet/withdraw' },
    { label: 'Redeem points', icon: ArrowLeftRight, to: '/wallet/redeem' },
  ];

  return (
    <div
      className="min-h-[70vh] rounded-2xl bg-black text-white p-6 md:p-8 max-w-xl mx-auto w-full"
      data-force-dark
    >
      <h1 className="text-3xl font-bold tracking-tight mb-2">My Wallet</h1>
      {promise ? (
        <p className="text-xs text-emerald-400/90 mb-4 leading-relaxed">
          {promise.matchSlaText} · {promise.noShowText}
        </p>
      ) : (
        <div className="mb-4" />
      )}
      {loading ? <p className="mb-4 text-sm text-zinc-400">Loading wallet…</p> : null}
      {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

      <div className="relative overflow-hidden rounded-2xl p-6 mb-5 bg-gradient-to-br from-[#8E2DE2] via-[#6B21A8] to-[#3B82F6]">
        <p className="text-4xl md:text-5xl font-extrabold">{fmt(portfolio)}</p>
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div>
            <p className="text-white/70 text-xs font-semibold">Fiat Balance</p>
            <p className="font-bold mt-1">{fmt(fiat)}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold">Ride credit</p>
            <p className="font-bold mt-1">{fmt(mobilityCredit)}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold">Points</p>
            <p className="font-bold mt-1">{points.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="rounded-2xl bg-[#1A1A1A] py-4 flex flex-col items-center gap-2 text-center hover:bg-[#222]"
          >
            <a.icon size={18} className="text-zinc-300" />
            <span className="text-[11px] font-semibold">{a.label}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs tracking-wider text-zinc-500 font-bold mb-3">TRANSACTIONS</p>
      {txs.length === 0 ? (
        <p className="text-zinc-500 text-sm">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {txs.map((t) => {
            const credit = t.credit || t.amount > 0;
            const amt = `${credit || t.amount >= 0 ? '+' : '-'}${fmt(t.amount)}`;
            return (
              <li key={t.id} className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-sm">
                  {ICONS[t.icon] || ICONS.tx}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t.title}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
                  </p>
                </div>
                <p className={`font-bold ${credit ? 'text-green-500' : ''}`}>{amt}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WalletPage;
