import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Merchant login — email or phone + password. */
export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const body = identifier.includes('@')
        ? { email: identifier.trim(), password }
        : { phone: identifier.trim(), password };
      const res = await axios.post(`${API}/merchant/auth/login`, body);
      localStorage.setItem('movr_merchant_token', res.data.data.token);
      localStorage.setItem('movr_merchant', JSON.stringify(res.data.data.merchant));
      toast.success('Welcome back');
      navigate('/merchant/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center px-4 font-[Poppins,Montserrat,sans-serif]">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold">Movr for Merchants</h1>
          <p className="text-text-secondary mt-2">Sign in to manage your storefront</p>
        </div>

        <div>
          <label className="block text-sm text-text-secondary mb-2">Email or phone</label>
          <input
            className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3 placeholder:text-text-secondary"
            placeholder="merchant@business.com or +233…"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-2">Password</label>
          <input
            type="password"
            className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-motion-blue">
          <Link to="/merchant/onboarding">New to Movr? Create a merchant account</Link>
        </p>
      </form>
    </div>
  );
}
