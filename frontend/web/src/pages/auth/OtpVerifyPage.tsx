import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

/** 4-digit OTP verification — signup or password reset. */
const OtpVerifyPage: React.FC = () => {
  const location = useLocation() as {
    state?: {
      phone?: string;
      identifier?: string;
      mode?: string;
      devCode?: string;
      firebasePhone?: boolean;
      firebaseEmail?: boolean;
    };
  };
  const mode = location.state?.mode === 'reset' ? 'reset' : 'signup';
  const identifier = location.state?.identifier || location.state?.phone || '';
  const firebasePhone = Boolean(location.state?.firebasePhone);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
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

  const idBody = (extra: Record<string, string> = {}) =>
    identifier.includes('@')
      ? { email: identifier, ...extra }
      : { phone: identifier, ...extra };

  const setDigit = (i: number, v: string) => {
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = ['', '', '', '', '', ''];
      cleaned.slice(0, 6).split('').forEach((c, idx) => {
        next[idx] = c;
      });
      setDigits(next);
      refs.current[Math.min(cleaned.length, 5)]?.focus();
      return;
    }
    const d = cleaned.slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('').replace(/\s/g, '');
    if (code.length < 4) {
      toast.error('Enter the verification code');
      return;
    }
    setLoading(true);
    try {
      const { confirmFirebasePhoneCode, hasFirebasePhoneSession } = await import('../../lib/firebase');
      if (firebasePhone || hasFirebasePhoneSession()) {
        try {
          const idToken = await confirmFirebasePhoneCode(code);
          const res = await api.post('/auth/verify-otp', {
            ...idBody({ purpose: mode }),
            firebaseIdToken: idToken,
          });
          toast.success('Verified with Firebase');
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
          return;
        } catch (fbErr: any) {
          toast.error(fbErr?.message || 'Firebase code failed — trying backup code');
        }
      }
      const res = await api.post('/auth/verify-otp', idBody({ code, purpose: mode }));
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
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
      let firebaseResent = false;
      if (!identifier.includes('@')) {
        try {
          const { startFirebasePhoneAuth } = await import('../../lib/firebase');
          const phone = identifier.startsWith('+')
            ? identifier
            : `+${identifier.replace(/^\+/, '')}`;
          await startFirebasePhoneAuth(phone);
          firebaseResent = true;
        } catch {
          firebaseResent = false;
        }
      }
      const res = await api.post('/auth/resend-otp', {
        ...idBody({ purpose: mode }),
        skipDelivery: firebaseResent,
      });
      setSeconds(42);
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
  const active = focusIndex === -1 ? 5 : focusIndex;

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
      <p className="text-zinc-400 mt-3 mb-8">
        {location.state?.firebaseEmail
          ? `Firebase emailed ${identifier || 'you'}. Enter the code if you received one, or follow the email link.`
          : `Code sent to ${identifier || 'your account'}${firebasePhone ? ' via Firebase' : ''}`}
      </p>

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
              maxLength={i === 0 ? 6 : 1}
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
