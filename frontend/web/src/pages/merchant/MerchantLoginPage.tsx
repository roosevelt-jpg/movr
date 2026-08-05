import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Merchant login — Movr for Merchants mockup. */
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 font-[Poppins,Montserrat,sans-serif]">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold">Movr for Merchants</h1>
          <p className="text-[#A0A0A0] mt-2">Sign in to manage your storefront</p>
        </div>

        <div>
          <label className="block text-sm text-[#888] mb-2">Email</label>
          <input
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
            placeholder="merchant@business.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm text-[#888] mb-2">Password</label>
          <input
            type="password"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-[#5E9EFF]">
          <Link to="/merchant/onboarding">New to Movr? Create a merchant account</Link>
        </p>
      </form>
    </div>
  );
}
