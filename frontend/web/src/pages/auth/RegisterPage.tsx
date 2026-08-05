import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';
import axios from 'axios';

/** Create account — email and/or phone + password. */
const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      toast.error('Add an email or phone number');
      return;
    }
    setIsLoading(true);
    const parts = fullName.trim().split(/\s+/);
    try {
      await register({
        firstName: parts[0] || fullName,
        lastName: parts.slice(1).join(' ') || 'User',
        email: email.trim() || null,
        phone: phone.trim() || null,
        password,
        country: 'GH',
        city: 'Accra',
        userType: 'customer',
      });
      const identifier = phone.trim() || email.trim();
      try {
        const otpBody = identifier.includes('@')
          ? { email: identifier, purpose: 'signup' }
          : { phone: identifier, purpose: 'signup' };
        const otpRes = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1'}/auth/resend-otp`,
          otpBody
        );
        toast.success(
          otpRes.data?.data?.devCode
            ? `Account created · code ${otpRes.data.data.devCode}`
            : 'Account created · check your code'
        );
        navigate('/verify-otp', {
          state: {
            phone: identifier,
            identifier,
            mode: 'signup',
            devCode: otpRes.data?.data?.devCode,
          },
        });
      } catch {
        toast.success('Account created');
        navigate('/verify-otp', { state: { phone: identifier, identifier, mode: 'signup' } });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-3xl font-bold">Create account</h1>
      <p className="text-[#888] mt-2 mb-8">Ride, shop, and deliver in one app</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <p className="text-sm text-[#FF3B5C]">{error}</p> : null}

        <div>
          <label className="block text-sm text-[#888] mb-2">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ama Konadu"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-[#888] mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
          />
        </div>

        <div>
          <label className="block text-sm text-[#888] mb-2">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 24 000 0000"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
          />
        </div>

        <div>
          <label className="block text-sm text-[#888] mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
            required
          />
        </div>

        <p className="text-xs text-[#666]">Provide at least an email or a phone number.</p>

        <p className="text-xs text-[#888] leading-relaxed">
          By continuing, you agree to Movr's{' '}
          <a className="text-[#4A72FF]" href="/terms">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="text-[#4A72FF]" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create account'}
        </button>

        <p className="text-center text-[#888] text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-[#4A72FF] font-semibold">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
