import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export default function MerchantOnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    businessName: '',
    category: 'Food',
    country: 'GH',
    documentUrl: '',
    registrationNumber: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/register`, form);
      const token = res.data.data.token;
      localStorage.setItem('movr_merchant_token', token);
      localStorage.setItem('movr_merchant', JSON.stringify(res.data.data.merchant));

      if (form.documentUrl) {
        await axios.post(
          `${API}/merchant/kyc`,
          {
            documentType: 'business_registration',
            documentNumber: form.registrationNumber,
            fileUrl: form.documentUrl,
            businessRegistrationNumber: form.registrationNumber,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      toast.success('Storefront created');
      navigate('/merchant/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-lg bg-surface border border-border rounded-lg p-8 space-y-3">
        <h1 className="text-2xl font-semibold">Merchant onboarding</h1>
        <p className="text-text-secondary text-sm mb-2">Business details + KYC documents.</p>
        {(['email', 'password', 'firstName', 'businessName', 'registrationNumber', 'documentUrl'] as const).map(
          (key) => (
            <input
              key={key}
              type={key === 'password' ? 'password' : 'text'}
              className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3"
              placeholder={key}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
            />
          )
        )}
        <select
          className="w-full rounded-md bg-surface-elevated border border-border px-4 py-3"
          value={form.category}
          onChange={(e) => set('category', e.target.value)}
        >
          {['Food', 'Groceries', 'Electronics', 'Fashion', 'Pharmacy'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-pill bg-movr-gradient py-3 font-semibold disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>
        <p className="text-sm text-text-secondary">
          Already registered? <Link className="text-motion-blue" to="/merchant/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
