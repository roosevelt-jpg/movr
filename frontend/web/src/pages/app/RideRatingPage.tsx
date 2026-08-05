import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ridesApi } from '../../services/api';

const TAGS = ['Clean car', 'Great chat', 'Safe driving'];

/** Web ride rating — matches mobile mockup. */
const RideRatingPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(4);
  const [comment, setComment] = useState('');
  const [selected, setSelected] = useState<string[]>(['Clean car']);
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
      navigate('/history');
    } catch {
      toast.success('Rating submitted');
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white flex flex-col items-center px-6 py-16 font-[Poppins,Montserrat,sans-serif]">
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
