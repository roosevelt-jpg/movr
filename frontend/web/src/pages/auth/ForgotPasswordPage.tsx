import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Request a password reset code via email or phone. */
const ForgotPasswordPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      toast.error('Enter your email or phone number');
      return;
    }
    setIsLoading(true);
    try {
      const body = value.includes('@') ? { email: value } : { phone: value };
      const res = await axios.post(`${API}/auth/forgot-password`, body);
      const data = res.data?.data || {};
      if (data.devCode) {
        toast.success(`Reset code: ${data.devCode}`, { duration: 12000 });
      } else {
        toast.success(res.data?.message || 'Reset code sent');
      }
      navigate('/verify-otp', {
        state: {
          phone: data.identifier || value,
          identifier: data.identifier || value,
          mode: 'reset',
          devCode: data.devCode,
        },
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-4">
        <Lock className="text-[#0055FF]" size={40} />
      </div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="text-[#888] mt-3 mb-8">
        Enter your email or phone and we&apos;ll send a reset code
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 text-left">
        <div>
          <label className="block text-sm text-[#888] mb-2">Email or phone</label>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com or +233…"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send reset code'}
        </button>

        <Link to="/login" className="block text-center text-sm text-[#4A72FF]">
          Back to sign in
        </Link>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
