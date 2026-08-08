import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowLeftRight, Link2, CreditCard } from 'lucide-react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ICONS: Record<string, string> = {
  topup: '↓',
  ride: '🚗',
  dvt: '⛓',
  parcel: '📦',
  withdraw: '↑',
  transfer: '↔',
  tx: '•',
};

/** My Wallet — portfolio, quick actions, transactions (mockup). */
const WalletPage: React.FC = () => {
  const { currency: locCurrency } = useLocalCurrency();
  const [portfolio, setPortfolio] = useState(34850);
  const [fiat, setFiat] = useState(24500);
  const [dvt, setDvt] = useState(2400);
  const [points, setPoints] = useState(850);
  const [currency, setCurrency] = useState('NGN');
  const [txs, setTxs] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/wallet/portfolio`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setPortfolio(Number(d.portfolioValue ?? 0));
        setFiat(Number(d.fiatBalance ?? 0));
        setDvt(Number(d.dvtTokens ?? 0));
        setPoints(Number(d.points ?? 0));
        setCurrency(d.currency || locCurrency || 'NGN');
        if (Array.isArray(d.transactions)) setTxs(d.transactions);
      })
      .catch(() => undefined);
  }, [locCurrency]);

  const fmt = (n: number) => formatCurrency(Math.abs(n), currency);

  const actions = [
    { label: 'Top Up', icon: ArrowUp, to: '/wallet/topup' },
    { label: 'Cards', icon: CreditCard, to: '/wallet/payment-methods' },
    { label: 'Withdraw', icon: ArrowDown, to: '/wallet/withdraw' },
    { label: 'Transfer', icon: ArrowLeftRight, to: '/token' },
    { label: 'Claim DVT', icon: Link2, to: '/claim' },
    { label: 'Redeem', icon: ArrowUp, to: '/token/redeem' },
  ];

  return (
    <div className="min-h-[70vh] rounded-2xl bg-black text-white p-6 md:p-8 max-w-xl mx-auto w-full" data-force-dark>
      <h1 className="text-3xl font-bold tracking-tight mb-6">My Wallet</h1>

      <div className="relative overflow-hidden rounded-2xl p-6 mb-5 bg-gradient-to-br from-[#8E2DE2] via-[#6B21A8] to-[#3B82F6]">
        <p className="text-4xl md:text-5xl font-extrabold">{fmt(portfolio)}</p>
        <div className="grid grid-cols-3 gap-3 mt-6">
          <div>
            <p className="text-white/70 text-xs font-semibold">Fiat Balance</p>
            <p className="font-bold mt-1">{fmt(fiat)}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold">DVT Tokens</p>
            <p className="font-bold mt-1">{dvt.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-semibold">Points</p>
            <p className="font-bold mt-1">{points.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-8">
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
            const amt =
              t.unit === 'dvt'
                ? `${credit ? '+' : ''}${Math.abs(t.amount)} DVT`
                : `${credit || t.amount >= 0 ? '+' : '-'}${fmt(t.amount)}`;
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
