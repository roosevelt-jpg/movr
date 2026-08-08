import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** 4-digit OTP verification — signup or password reset (mockup). */
const OtpVerifyPage: React.FC = () => {
  const location = useLocation() as {
    state?: { phone?: string; identifier?: string; mode?: string; devCode?: string };
  };
  const mode = location.state?.mode === 'reset' ? 'reset' : 'signup';
  const identifier = location.state?.identifier || location.state?.phone || '';
  const [digits, setDigits] = useState(['', '', '', '']);
  const [seconds, setSeconds] = useState(42);
  const [loading, setLoading] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!identifier) {
      navigate(mode === 'reset' ? '/forgot-password' : '/phone', { replace: true });
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
    if (d && i < 3) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 4) {
      toast.error('Enter the 4-digit code');
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
        navigate('/profile-setup', { state: { phone: identifier } });
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
      setSeconds(42);
      setDigits(['', '', '', '']);
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
  const active = focusIndex === -1 ? 3 : focusIndex;

  return (
    <div className="w-full text-center" data-force-dark>
      <div className="h-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 mb-10" />
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Smartphone className="text-white" size={36} />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-white">
        {mode === 'reset' ? 'Enter reset code' : 'Verify your number'}
      </h1>
      <p className="text-zinc-400 mt-3 mb-8">Code sent to {identifier || 'your account'}</p>

      <form onSubmit={verify} className="space-y-6">
        <div className="flex justify-center gap-3">
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
              className={`w-14 h-14 rounded-xl bg-zinc-900 text-center text-2xl font-bold border-2 text-white ${
                i === active || d ? 'border-purple-500' : 'border-zinc-800'
              }`}
            />
          ))}
        </div>

        <button type="button" className="text-sm text-zinc-400" onClick={resend}>
          Didn&apos;t receive it?{' '}
          <span className="text-purple-400 font-bold">
            {seconds > 0 ? `Resend (0:${String(seconds).padStart(2, '0')})` : 'Resend'}
          </span>
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl py-3.5 font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>

        <Link
          to={mode === 'reset' ? '/forgot-password' : '/login'}
          className="block text-sm text-purple-400"
        >
          {mode === 'reset' ? 'Use a different email or phone' : 'Back to sign in'}
        </Link>
      </form>
    </div>
  );
};

export default OtpVerifyPage;
