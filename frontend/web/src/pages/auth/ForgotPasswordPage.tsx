import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { firebaseSendPasswordReset, startFirebasePhoneAuth } from '../../lib/firebase';

function toE164(value: string) {
  const trimmed = value.replace(/[\s\-()]/g, '');
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+/, '')}`;
}

/** Request a password reset via Firebase email or phone OTP. */
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
      const isEmail = value.includes('@');
      let firebasePhone = false;
      if (!isEmail) {
        try {
          await startFirebasePhoneAuth(toE164(value));
          firebasePhone = true;
        } catch {
          firebasePhone = false;
        }
      }

      const body = isEmail
        ? { email: value }
        : { phone: value, skipDelivery: firebasePhone };
      const res = await api.post('/auth/forgot-password', body);
      const data = res.data?.data || {};

      if (isEmail && data.delivery !== 'oob_email') {
        try {
          await firebaseSendPasswordReset(value);
        } catch {
          /* SendGrid / legacy OTP still applied */
        }
      }

      if (data.devCode) {
        toast.success(`Reset code: ${data.devCode}`, { duration: 12000 });
      } else if (isEmail && (data.delivery === 'oob_email' || data.provider === 'firebase')) {
        toast.success('Firebase reset email sent — check your inbox (and spam)');
      } else {
        toast.success(res.data?.message || 'Reset code sent');
      }

      navigate('/verify-otp', {
        state: {
          phone: data.identifier || value,
          identifier: data.identifier || value,
          mode: 'reset',
          devCode: data.devCode,
          firebasePhone,
          firebaseEmail: isEmail && (data.provider === 'firebase' || data.delivery === 'oob_email'),
        },
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="flex justify-center mb-4">
        <Lock className="text-motion-blue" size={40} />
      </div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="text-text-secondary mt-3 mb-8">
        Enter your email or phone. We verify through Firebase (email link or SMS OTP).
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 text-left">
        <div>
          <label className="block text-sm text-text-secondary mb-2">Email or phone</label>
          <input
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com or +233…"
            className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3 placeholder:text-text-secondary"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send reset code'}
        </button>

        <Link to="/login" className="block text-center text-sm text-motion-blue">
          Back to sign in
        </Link>
      </form>
    </div>
  );
};

export default ForgotPasswordPage;
