import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Set a new password after OTP verification. */
const ResetPasswordPage: React.FC = () => {
  const location = useLocation() as {
    state?: { resetToken?: string; identifier?: string };
  };
  const resetToken = location.state?.resetToken || '';
  const identifier = location.state?.identifier || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resetToken) {
      toast.error('Start from forgot password to reset');
      navigate('/forgot-password', { replace: true });
    }
  }, [resetToken, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        resetToken,
        newPassword: password,
      });
      toast.success('Password updated — sign in');
      navigate('/login', { state: { identifier } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) return null;

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-4">
        <Lock className="text-motion-blue" size={40} />
      </div>
      <h1 className="text-2xl font-bold">Create a new password</h1>
      <p className="text-text-secondary mt-3 mb-8">
        Choose a strong password for {identifier || 'your account'}
      </p>

      <form onSubmit={submit} className="space-y-5 text-left">
        <div>
          <label className="block text-sm text-text-secondary mb-2">New password</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-surface-elevated border border-border pl-4 pr-12 py-3"
              minLength={8}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-2">Confirm password</label>
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
            minLength={8}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Update password'}
        </button>

        <Link to="/login" className="block text-center text-sm text-motion-blue">
          Back to sign in
        </Link>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
