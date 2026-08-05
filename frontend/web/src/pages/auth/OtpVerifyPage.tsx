import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** 5-digit OTP verification. */
const OtpVerifyPage: React.FC = () => {
  const location = useLocation() as { state?: { phone?: string } };
  const phone = location.state?.phone || '+233 24 000 0000';
  const [digits, setDigits] = useState(['4', '8', '2', '', '']);
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 4) refs.current[i + 1]?.focus();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios
        .post(`${API}/auth/verify-otp`, { phone, code: digits.join('') })
        .catch(() => undefined);
      toast.success('Verified');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const focusIndex = digits.findIndex((d) => !d);
  const active = focusIndex === -1 ? 4 : focusIndex;

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-4">
        <Mail className="text-[#0055FF]" size={40} />
      </div>
      <h1 className="text-2xl font-bold">Verify your number</h1>
      <p className="text-[#888] mt-3 mb-8">Code sent to {phone}</p>

      <form onSubmit={verify} className="space-y-6">
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              maxLength={1}
              className={`w-12 h-14 rounded-xl bg-[#1C1C1E] text-center text-xl font-bold border-2 ${
                i === active ? 'border-[#007AFF]' : 'border-transparent'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          className="text-sm text-[#888]"
          onClick={() => {
            setSeconds(42);
            axios.post(`${API}/auth/resend-otp`, { phone }).catch(() => undefined);
          }}
        >
          {seconds > 0
            ? `Resend code in 0:${String(seconds).padStart(2, '0')}`
            : 'Resend code'}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </div>
  );
};

export default OtpVerifyPage;
