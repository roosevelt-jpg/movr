import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';
import axios from 'axios';
import {
  TextField,
  GenderSelect,
  CountrySelect,
  DateSelect,
  GenderValue,
} from '../../components/forms';
import { setStoredCountry } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Create account — global gender / country / DOB selectors. */
const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<GenderValue>('');
  const [country, setCountry] = useState('GH');
  const [city, setCity] = useState('Accra');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, error } = useAuthStore();
  const navigate = useNavigate();

  const onCountry = async (code: string) => {
    setCountry(code);
    setStoredCountry(code);
    try {
      const res = await fetch(`${API}/public/resolve?country=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (j?.data?.city) setCity(j.data.city);
    } catch {
      /* keep city */
    }
  };

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
        country,
        city,
        gender: gender || undefined,
        dateOfBirth: dateOfBirth || undefined,
        userType: 'customer',
      });
      const identifier = phone.trim() || email.trim();
      try {
        const otpBody = identifier.includes('@')
          ? { email: identifier, purpose: 'signup' }
          : { phone: identifier, purpose: 'signup' };
        const otpRes = await axios.post(`${API}/auth/resend-otp`, otpBody);
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
      <h1 className="text-2xl sm:text-3xl font-bold">Create account</h1>
      <p className="text-text-secondary mt-2 mb-6 sm:mb-8 text-sm sm:text-base">
        Ride, shop, and deliver in one app
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <TextField
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ama Konadu"
          autoComplete="name"
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
          />
          <TextField
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 24 000 0000"
            autoComplete="tel"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GenderSelect value={gender} onChange={setGender} required />
          <DateSelect value={dateOfBirth} onChange={setDateOfBirth} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CountrySelect value={country} onChange={onCountry} required />
          <TextField
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            required
          />
        </div>

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          autoComplete="new-password"
          required
        />

        <p className="text-xs text-text-secondary">Provide at least an email or a phone number.</p>

        <p className="text-xs text-text-secondary leading-relaxed">
          By continuing, you agree to Movr&apos;s{' '}
          <a className="text-motion-blue" href="/terms">
            Terms of Service
          </a>{' '}
          and{' '}
          <a className="text-motion-blue" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full rounded-full py-3.5 text-base"
        >
          {isLoading ? 'Creating...' : 'Create account'}
        </button>

        <p className="text-center text-text-secondary text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-motion-blue font-semibold">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
