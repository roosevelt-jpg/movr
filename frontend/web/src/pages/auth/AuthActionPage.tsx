import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getFirebaseAuth } from '../../lib/firebase';

/** Firebase Auth email-action handler (verify email / reset password). */
const AuthActionPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') || '';
  const oobCode = params.get('oobCode') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const isReset = mode === 'resetPassword';

  useEffect(() => {
    (async () => {
      const auth = await getFirebaseAuth();
      if (!auth || !oobCode) {
        toast.error('This link is invalid. Request a new one.');
        navigate(isReset ? '/forgot-password' : '/login', { replace: true });
        return;
      }
      if (!isReset) {
        try {
          await api.post('/auth/confirm-email', { oobCode });
          toast.success('Email verified — you can sign in');
        } catch (e: any) {
          toast.error(e?.response?.data?.message || e?.message || 'Could not verify email');
        }
        navigate('/login', { replace: true });
        return;
      }
      setReady(true);
    })();
  }, [isReset, navigate, oobCode]);

  const subtitle = useMemo(() => {
    if (isReset) return 'Choose a new password to finish Firebase verification';
    return 'Verifying your email…';
  }, [isReset]);

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
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { oobCode, newPassword: password });
      toast.success('Password updated — sign in');
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  if (!isReset) {
    return (
      <div className="w-full text-center">
        <h1 className="text-2xl font-bold">Firebase verification</h1>
        <p className="text-text-secondary mt-3">{subtitle}</p>
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="w-full text-center">
      <h1 className="text-2xl font-bold">Create a new password</h1>
      <p className="text-text-secondary mt-3 mb-8">{subtitle}</p>
      <form onSubmit={submit} className="space-y-5 text-left">
        <input
          type="password"
          className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
          placeholder="New password"
          value={password}
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
          placeholder="Confirm password"
          value={confirm}
          minLength={8}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
        >
          {busy ? 'Saving...' : 'Update password'}
        </button>
        <Link to="/login" className="block text-center text-sm text-motion-blue">
          Back to sign in
        </Link>
      </form>
    </div>
  );
};

export default AuthActionPage;
