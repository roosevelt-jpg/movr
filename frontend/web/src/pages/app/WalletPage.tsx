import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Plus } from 'lucide-react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Wallet — local currency + points/DVT. */
const WalletPage: React.FC = () => {
  const { currency } = useLocalCurrency();
  const [balance, setBalance] = useState(0);
  const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const [estimatedDvt, setEstimatedDvt] = useState(0);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/wallet`, { headers: authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/points/estimated-dvt`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
      fetch(`${API}/wallet/transactions`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([w, p, t]) => {
      if (w?.data?.balance_fiat != null || w?.data?.balance != null) {
        setBalance(Number(w.data.balance_fiat ?? w.data.balance));
      }
      if (w?.data?.currency) setWalletCurrency(String(w.data.currency));
      if (w?.data?.points_balance != null) setPoints(Number(w.data.points_balance));
      if (p?.data?.estimatedDvt != null) setEstimatedDvt(Number(p.data.estimatedDvt));
      if (p?.data?.points != null) setPoints(Number(p.data.points));
      if (Array.isArray(t?.data)) {
        setActivity(
          t.data.slice(0, 10).map((row: any) => ({
            id: row.id,
            title: row.type || row.reference || 'Transaction',
            when: row.created_at ? new Date(row.created_at).toLocaleString() : '',
            amount: Number(row.amount),
            kind: 'fiat',
            status: 'Completed',
          }))
        );
      }
    });
  }, []);

  const fmt = (n: number) => formatCurrency(Math.abs(n), walletCurrency || currency);

  return (
    <div className="min-h-[70vh] rounded-2xl bg-jet-black text-pure-white p-6 md:p-8 space-y-6" data-force-dark>
      <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>

      <div className="rounded-2xl p-6 bg-gradient-to-br from-surface via-electric-violet/70 to-motion-blue">
        <p className="text-pure-white/70 text-sm">Available balance</p>
        <p className="text-4xl md:text-5xl font-bold mt-1">{fmt(balance)}</p>
        <div className="h-px bg-white/20 my-5" />
        <div className="flex justify-between items-end gap-4">
          <div>
            <p className="text-pure-white/70 text-sm">Movr points</p>
            <p className="text-2xl font-bold">{points.toLocaleString()} pts</p>
          </div>
          <p className="text-pure-white/80 text-sm">≈ {estimatedDvt.toLocaleString()} DVT at TGE</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          to="/token"
          className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 font-semibold bg-movr-gradient"
        >
          <Send size={18} /> Send money
        </Link>
        <Link
          to="/wallet/topup"
          className="flex-1 rounded-full py-3 font-semibold bg-surface-elevated border border-border"
        >
          <span className="inline-flex items-center gap-2 justify-center w-full">
            <Plus size={18} /> Top up
          </span>
        </Link>
      </div>

      <Link
        to="/wallet/redeem"
        className="block text-center text-sm text-motion-blue hover:underline"
      >
        Redeem points →
      </Link>

      <div>
        <p className="text-sm text-text-secondary mb-3">Recent activity</p>
        {activity.length === 0 ? (
          <p className="text-text-secondary text-sm">No transactions yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((row) => (
              <li
                key={row.id}
                className="flex justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div>
                  <p className="font-semibold">{row.title}</p>
                  <p className="text-sm text-text-secondary mt-1">{row.when}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${row.kind === 'pts' ? 'text-motion-blue' : ''}`}>
                    {row.kind === 'pts'
                      ? `+${row.amount} pts`
                      : `${row.amount < 0 ? '-' : '+'}${fmt(row.amount)}`}
                  </p>
                  <span
                    className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      row.status === 'Reward'
                        ? 'bg-electric-violet/40'
                        : 'bg-movr-green/40'
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WalletPage;
