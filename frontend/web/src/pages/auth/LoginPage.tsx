import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

/** Sign in — email or phone + password. */
const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(identifier, password);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold">Movr</h1>
        <p className="text-[#888] mt-2">Welcome back</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <p className="text-sm text-[#FF3B5C]">{error}</p> : null}

        <div>
          <label className="block text-sm text-[#888] mb-2">Email or phone</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-[#888]" size={18} />
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@email.com or +233…"
              className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] pl-10 pr-4 py-3 text-white placeholder:text-[#666]"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-[#888] mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-[#888]" size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] pl-10 pr-10 py-3 text-white"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3.5 text-[#888]"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="text-right mt-2">
            <Link to="/forgot-password" className="text-sm text-[#4A72FF]">
              Forgot password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-[#888] text-sm">
          New to Movr?{' '}
          <Link to="/register" className="text-[#4A72FF] font-semibold">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
