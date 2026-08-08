import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

/** Phone entry — Send Code OTP (mockup). */
export default function PhoneEntryPage() {
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState('+234');
  const [phone, setPhone] = useState('801 234 5678');
  const [autoFill, setAutoFill] = useState(false);
  const [loading, setLoading] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      toast.error('Enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, countryCode, autoFillFromSim: autoFill }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not send code');
      const full = json.data?.phone || `${countryCode}${digits.replace(/^0/, '')}`;
      if (json.data?.devCode) toast.success(`Dev code: ${json.data.devCode}`);
      navigate('/verify-otp', {
        state: { phone: full, identifier: full, mode: 'signup', devCode: json.data?.devCode },
      });
    } catch (err: any) {
      toast.error(err.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto text-center" data-force-dark>
      <div className="relative mb-10">
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 w-40 h-40 rounded-full bg-purple-500/20 blur-2xl" />
        <h1 className="relative text-4xl font-extrabold text-white">Movr</h1>
        <p className="relative text-[11px] tracking-[0.2em] text-zinc-500 font-semibold mt-2">
          MOVE · SHOP · DELIVER
        </p>
      </div>

      <h2 className="text-2xl font-bold text-white">Enter your phone number</h2>
      <p className="text-zinc-400 mt-2 mb-7">We&apos;ll send you a verification code</p>

      <form onSubmit={send} className="space-y-4 text-left">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCountryCode(countryCode === '+234' ? '+233' : '+234')}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-3.5 text-white"
          >
            <span>{countryCode === '+234' ? '🇳🇬' : '🇬🇭'}</span>
            <span className="font-semibold">{countryCode}</span>
            <span className="text-zinc-500 text-xs">▾</span>
          </button>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="flex-1 rounded-xl bg-zinc-900 border-2 border-purple-500 px-4 py-3.5 text-white outline-none focus:border-purple-400"
            placeholder="801 234 5678"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-zinc-950 px-4 py-3.5">
          <span className="text-sm text-zinc-400">📱 Auto-fill from SIM</span>
          <button
            type="button"
            onClick={() => setAutoFill((v) => !v)}
            className="text-purple-400 font-bold text-sm"
          >
            {autoFill ? 'Enabled' : 'Enable'}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl py-3.5 font-bold text-white bg-gradient-to-r from-purple-500 to-blue-500 mt-6"
        >
          {loading ? 'Sending…' : 'Send Code'}
        </button>
      </form>

      <p className="text-xs text-zinc-600 mt-6 leading-relaxed">
        By continuing you agree to our{' '}
        <Link to="/terms" className="text-zinc-400">
          Terms & Privacy Policy
        </Link>
      </p>

      <p className="text-sm text-zinc-500 mt-8">
        Prefer password?{' '}
        <Link to="/login" className="text-purple-400 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
