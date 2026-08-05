import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** 5-digit OTP verification — signup or password reset. */
const OtpVerifyPage: React.FC = () => {
  const location = useLocation() as {
    state?: { phone?: string; identifier?: string; mode?: string; devCode?: string };
  };
  const mode = location.state?.mode === 'reset' ? 'reset' : 'signup';
  const identifier =
    location.state?.identifier || location.state?.phone || '';
  const [digits, setDigits] = useState(['', '', '', '', '']);
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!identifier) {
      navigate(mode === 'reset' ? '/forgot-password' : '/register', { replace: true });
    }
  }, [identifier, mode, navigate]);

  useEffect(() => {
    if (location.state?.devCode) {
      toast(`Dev code: ${location.state.devCode}`, { duration: 10000, icon: '🔑' });
    }
  }, [location.state?.devCode]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 4) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 5) {
      toast.error('Enter the 5-digit code');
      return;
    }
    setLoading(true);
    try {
      const body = identifier.includes('@')
        ? { email: identifier, code, purpose: mode }
        : { phone: identifier, code, purpose: mode };
      const res = await axios.post(`${API}/auth/verify-otp`, body);
      toast.success('Verified');
      if (mode === 'reset') {
        const resetToken = res.data?.data?.resetToken;
        if (!resetToken) {
          toast.error('Missing reset token. Try again.');
          navigate('/forgot-password');
          return;
        }
        navigate('/reset-password', { state: { resetToken, identifier } });
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    try {
      const body = identifier.includes('@')
        ? { email: identifier, purpose: mode }
        : { phone: identifier, purpose: mode };
      const res = await axios.post(`${API}/auth/resend-otp`, body);
      setSeconds(60);
      setDigits(['', '', '', '', '']);
      refs.current[0]?.focus();
      if (res.data?.data?.devCode) {
        toast.success(`New code: ${res.data.data.devCode}`, { duration: 12000 });
      } else {
        toast.success('Code resent');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not resend code');
    }
  };

  const focusIndex = digits.findIndex((d) => !d);
  const active = focusIndex === -1 ? 4 : focusIndex;

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-4">
        <Mail className="text-[#0055FF]" size={40} />
      </div>
      <h1 className="text-2xl font-bold">
        {mode === 'reset' ? 'Enter reset code' : 'Verify your number'}
      </h1>
      <p className="text-[#888] mt-3 mb-8">Code sent to {identifier || 'your account'}</p>

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
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              className={`w-12 h-14 rounded-xl bg-[#1C1C1E] text-center text-xl font-bold border-2 ${
                i === active ? 'border-[#007AFF]' : 'border-transparent'
              }`}
            />
          ))}
        </div>

        <button type="button" className="text-sm text-[#888]" onClick={resend}>
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

        <Link
          to={mode === 'reset' ? '/forgot-password' : '/login'}
          className="block text-sm text-[#4A72FF]"
        >
          {mode === 'reset' ? 'Use a different email or phone' : 'Back to sign in'}
        </Link>
      </form>
    </div>
  );
};

export default OtpVerifyPage;
