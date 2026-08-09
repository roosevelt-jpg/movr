import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ridesApi } from '../../services/api';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

const TIP_PRESETS = [100, 200, 500];

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Arrival receipt + rate + tip + DVT. */
const RideRatingPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [tip, setTip] = useState<number | 'custom'>(0);
  const [customTip, setCustomTip] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Ride not found');
      setReceiptLoading(false);
      return;
    }
    fetch(`${API}/rides/${id}/receipt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setReceipt({
          destination: d.destination || '',
          durationMinutes: Number(d.durationMinutes || 0),
          distanceKm: Number(d.distanceKm || 0),
          baseFare: Number(d.baseFare || 0),
          distanceFare: Number(d.distanceFare || 0),
          dvtDiscount: Number(d.dvtDiscount || 0),
          totalPaid: Number(d.totalPaid || 0),
          dvtEarned: Number(d.dvtEarned || 0),
          currency: d.currency || 'NGN',
        });
        if (d.driverFirstName) setName(d.driverFirstName);
      })
      .catch(() => setError('Could not load ride receipt'))
      .finally(() => setReceiptLoading(false));
  }, [id]);

  const tipAmount = tip === 'custom' ? Number(customTip || 0) : Number(tip);
  const c = receipt?.currency || 'NGN';
  const fmt = (n: number) => formatCurrency(n, c);

  const submit = async () => {
    setLoading(true);
    try {
      if (id) {
        const rateRes = await fetch(`${API}/rails/channel/rate`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            rideId: id,
            rating,
            channel: 'app',
            comment: tipAmount > 0 ? `tip:${tipAmount}` : undefined,
          }),
        });
        if (!rateRes.ok) {
          await ridesApi.rateRide(id, { rating });
        }
        if (tipAmount > 0) await ridesApi.addTip(id, tipAmount);
      }
      toast.success('Thanks for riding with Movr');
      navigate('/history');
    } catch {
      toast.error('Could not submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white p-6 max-w-xl mx-auto" data-force-dark>
      {receiptLoading ? <p className="text-center text-zinc-400">Loading ride…</p> : null}
      {error ? <p className="text-center text-red-400">{error}</p> : null}
      {!receipt ? null : (
      <>
      <div className="w-16 h-16 rounded-full bg-green-500 text-black font-black text-2xl flex items-center justify-center mx-auto mb-4">
        ✓
      </div>
      <h1 className="text-2xl font-extrabold text-center">You have arrived!</h1>
      <p className="text-zinc-400 text-center mt-2 mb-6">
        {receipt.destination} · {receipt.durationMinutes} min ride
      </p>

      <div className="rounded-2xl bg-zinc-900 p-4 space-y-2.5 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Base fare</span>
          <span className="font-semibold">{fmt(receipt.baseFare)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Distance ({receipt.distanceKm}km)</span>
          <span className="font-semibold">{fmt(receipt.distanceFare)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">DVT discount</span>
          <span className="font-semibold text-green-500">-{fmt(receipt.dvtDiscount)}</span>
        </div>
        <div className="h-px bg-zinc-800 my-2" />
        <div className="flex justify-between">
          <span className="font-bold">Total paid</span>
          <span className="font-extrabold text-lg">{fmt(receipt.totalPaid)}</span>
        </div>
      </div>

      <p className="font-bold mb-3">{name ? `How was ${name}?` : 'How was your driver?'}</p>
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-3xl ${n <= rating ? 'text-amber-400' : 'text-zinc-700'}`}
          >
            ★
          </button>
        ))}
      </div>

      <p className="font-bold mb-3">Add a tip?</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {TIP_PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTip(t);
              setShowCustom(false);
            }}
            className={`rounded-xl border-2 px-4 py-2.5 font-bold text-sm ${
              tip === t ? 'border-purple-500' : 'border-zinc-800'
            }`}
          >
            {fmt(t)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setTip('custom');
            setShowCustom(true);
          }}
          className={`rounded-xl border-2 px-4 py-2.5 font-bold text-sm ${
            tip === 'custom' || showCustom ? 'border-purple-500' : 'border-zinc-800'
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom ? (
        <input
          value={customTip}
          onChange={(e) => setCustomTip(e.target.value)}
          placeholder="Enter tip amount"
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 mb-4 outline-none"
        />
      ) : null}

      <div className="flex items-center gap-3 rounded-xl bg-[#1E1033] p-4 mb-6">
        <span className="text-xl">⛓</span>
        <div>
          <p className="font-bold">+{receipt.dvtEarned} DVT tokens earned</p>
          <p className="text-xs text-zinc-400 mt-0.5">Added to your wallet</p>
        </div>
      </div>

      <button
        type="button"
        disabled={loading || rating === 0}
        onClick={submit}
        className="w-full rounded-2xl bg-blue-500 py-3.5 font-bold disabled:opacity-50"
      >
        {loading ? 'Submitting…' : 'Submit & Done'}
      </button>
      </>
      )}
    </div>
  );
};

export default RideRatingPage;
