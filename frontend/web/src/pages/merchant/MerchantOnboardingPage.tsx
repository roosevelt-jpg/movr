import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Check, Upload } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Merchant onboarding — 3-step flow; Step 2 matches KYC mockup. */
export default function MerchantOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    businessName: 'Boutique 22',
    category: 'Fashion',
    country: 'GH',
    documentUrl: '',
    registrationNumber: 'BN-2024-88213',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const finish = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/register`, form);
      const token = res.data.data.token;
      localStorage.setItem('movr_merchant_token', token);
      localStorage.setItem('movr_merchant', JSON.stringify(res.data.data.merchant));

      if (form.documentUrl || form.registrationNumber) {
        await axios.post(
          `${API}/merchant/kyc`,
          {
            documentType: 'business_registration',
            documentNumber: form.registrationNumber,
            fileUrl: form.documentUrl || `upload://cert/${form.registrationNumber}`,
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

  const StepDots = () => (
    <div className="flex items-center justify-center gap-0 mb-10">
      {[1, 2, 3].map((n) => (
        <React.Fragment key={n}>
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
              n < step
                ? 'bg-gradient-to-br from-[#6A00FF] to-[#0055FF]'
                : n === step
                  ? 'bg-gradient-to-br from-[#6A00FF] to-[#0055FF]'
                  : 'bg-[#2A2A2A] text-[#888]'
            }`}
          >
            {n < step ? <Check size={16} /> : n}
          </div>
          {n < 3 ? (
            <div
              className={`w-16 h-0.5 ${n < step ? 'bg-[#3F7048]' : 'bg-[#2A2A2A]'}`}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-10 font-[Poppins,Montserrat,sans-serif]">
      <div className="w-full max-w-md">
        <StepDots />

        {step === 1 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Create your account</h1>
            <p className="text-[#A0A0A0]">Step 1 of 3 · Account details</p>
            {(
              [
                ['email', 'Email', 'email'],
                ['password', 'Password', 'password'],
                ['firstName', 'Your name', 'text'],
              ] as const
            ).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-sm text-[#888] mb-2">{label}</label>
                <input
                  type={type}
                  className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full rounded-xl py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF]"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Business registration</h1>
            <p className="text-[#A0A0A0]">Step 2 of 3 · KYC verification</p>
            <div>
              <label className="block text-sm text-[#888] mb-2">Business name</label>
              <input
                className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-[#888] mb-2">
                Business registration number
              </label>
              <input
                className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                set(
                  'documentUrl',
                  form.documentUrl || `https://uploads.movr.local/certs/${Date.now()}.pdf`
                )
              }
              className="w-full rounded-xl border border-dashed border-[#444] bg-[#111] py-10 flex flex-col items-center gap-2 text-[#A0A0A0] hover:border-[#6A00FF]"
            >
              <Upload size={22} />
              <span>
                {form.documentUrl ? 'Certificate attached' : 'Upload registration certificate'}
              </span>
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl px-5 py-3 border border-[#2A2A2A]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF]"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Store category</h1>
            <p className="text-[#A0A0A0]">Step 3 of 3 · Almost done</p>
            <select
              className="w-full rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-3"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {['Food', 'Groceries', 'Electronics', 'Fashion', 'Pharmacy'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl px-5 py-3 border border-[#2A2A2A]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={finish}
                className="flex-1 rounded-xl py-3.5 font-semibold bg-gradient-to-r from-[#3F7048] via-[#6A00FF] to-[#0055FF] disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create storefront'}
              </button>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-[#A0A0A0] text-center mt-8">
          Already registered?{' '}
          <Link className="text-[#5E9EFF]" to="/merchant/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
