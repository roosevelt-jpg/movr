import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { TextField } from '../../components/forms';

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
      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold">Welcome back</h1>
        <p className="text-text-secondary mt-2 text-sm sm:text-base">Sign in to continue</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <TextField
          label="Email or phone"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@email.com or +233…"
          leading={<Mail size={18} />}
          required
        />

        <div>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            leading={<Lock size={18} />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-text-secondary"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            required
          />
          <div className="text-right mt-2">
            <Link to="/forgot-password" className="text-sm text-motion-blue">
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="btn-primary w-full rounded-full py-3.5">
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>

        <p className="text-center text-text-secondary text-sm">
          New to Movr?{' '}
          <Link to="/register" className="text-motion-blue font-semibold">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
