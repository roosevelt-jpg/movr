import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { TextField } from '../../components/forms';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Movr for Merchants sign-in. */
export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/login`, {
        email: email.trim(),
        password,
      });
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
    <div className="min-h-[70vh] bg-jet-black text-pure-white flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-5">
        <div className="text-center mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold">Movr for Merchants</h1>
          <p className="text-text-secondary mt-2 text-sm sm:text-base">
            Sign in to manage your storefront
          </p>
        </div>

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="merchant@business.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading} className="btn-primary w-full rounded-full py-3.5">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-motion-blue">
          <Link to="/merchant/onboarding">New to Movr? Create a merchant account</Link>
        </p>
      </form>
    </div>
  );
}
