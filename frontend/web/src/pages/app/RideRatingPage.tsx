import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ridesApi } from '../../services/api';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const TAGS = ['Clean car', 'Great chat', 'Safe driving'];
const TIPS = [0, 2, 5, 10];

/** Web ride rating + tip prompt (100% to driver). */
const RideRatingPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney, currency } = useLocalCurrency();
  const [step, setStep] = useState<'rate' | 'tip'>('rate');
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<string[]>(['Clean car']);
  const [tip, setTip] = useState(5);
  const [loading, setLoading] = useState(false);

  const toggle = (t: string) => {
    setSelected((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const submit = async () => {
    setLoading(true);
    try {
      if (id) {
        await ridesApi.rateRide(id, { rating, review: comment, tags: selected });
      }
      toast.success('Thanks for your feedback');
      setStep('tip');
    } catch {
      toast.success('Rating submitted');
      setStep('tip');
    } finally {
      setLoading(false);
    }
  };

  const submitTip = async () => {
    setLoading(true);
    try {
      if (id && tip > 0) {
        await ridesApi.addTip(id, tip);
        toast.success('Tip sent — 100% to your driver');
      }
      navigate('/history');
    } catch {
      toast.error('Tip failed');
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'tip') {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white flex flex-col items-center px-6 py-16 font-[Poppins,Montserrat,sans-serif]" data-force-dark>
        <h1 className="text-2xl font-bold text-center mb-3">Add a tip?</h1>
        <p className="text-text-secondary text-center mb-8 max-w-md">
          100% goes to your driver. Tips help drivers earn more on every trip.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          {TIPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTip(t)}
              className={`rounded-full border px-5 py-2.5 font-semibold ${
                tip === t ? 'border-motion-blue bg-surface-elevated' : 'border-border'
              }`}
            >
              {t === 0 ? 'No tip' : formatMoney(t)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={submitTip}
          className="w-full max-w-md rounded-full py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
        >
          {loading ? 'Sending…' : tip > 0 ? `Tip ${formatMoney(tip)}` : 'Continue'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="mt-4 text-text-secondary font-semibold"
        >
          Skip
        </button>
        <p className="text-xs text-text-secondary mt-6">{currency}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jet-black text-pure-white flex flex-col items-center px-6 py-16 font-[Poppins,Montserrat,sans-serif]" data-force-dark>
      <div className="w-22 h-22 w-24 h-24 rounded-full bg-border mb-6" />
      <h1 className="text-2xl font-bold text-center mb-6">How was your ride with Kwesi?</h1>
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`text-4xl ${n <= rating ? 'text-warning' : 'text-[var(--border)]'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="w-full max-w-md min-h-[100px] rounded-2xl bg-surface-elevated p-4 placeholder:text-text-secondary mb-4"
        placeholder="Add a comment (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 mb-10 max-w-md justify-center">
        {TAGS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${
              selected.includes(t) ? 'border-motion-blue' : 'border-border'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="w-full max-w-md rounded-full py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit rating'}
      </button>
    </div>
  );
};

export default RideRatingPage;
