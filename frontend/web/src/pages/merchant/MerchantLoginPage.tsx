import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/login`, { email, password });
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
    <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md bg-surface border border-border rounded-lg p-8 space-y-4">
        <h1 className="text-2xl font-semibold">Merchant login</h1>
        <p className="text-text-secondary text-sm">Sell faster with in-app storefronts.</p>
        <input
          className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-pill bg-movr-gradient py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="text-sm text-text-secondary">
          New here? <Link className="text-motion-blue" to="/merchant/onboarding">Create storefront</Link>
        </p>
      </form>
    </div>
  );
}
