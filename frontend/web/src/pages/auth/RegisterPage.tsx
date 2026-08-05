import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';

/** Create account — simplified mockup fields; still calls register API. */
const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const parts = fullName.trim().split(/\s+/);
    try {
      await register({
        firstName: parts[0] || fullName,
        lastName: parts.slice(1).join(' ') || 'User',
        email: `${phone.replace(/\D/g, '') || 'user'}@phone.movr`,
        phone,
        password,
        country: 'Ghana',
        city: 'Accra',
        userType: 'customer',
      });
      toast.success('Account created');
      navigate('/verify-otp', { state: { phone } });
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

        {(
          [
            ['Full name', fullName, setFullName, 'Ama Konadu', 'text'],
            ['Phone number', phone, setPhone, '+233 24 000 0000', 'tel'],
            ['Password', password, setPassword, 'Create a password', 'password'],
          ] as const
        ).map(([label, value, setter, placeholder, type]) => (
          <div key={label}>
            <label className="block text-sm text-[#888] mb-2">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3 placeholder:text-[#666]"
              required
            />
          </div>
        ))}

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
