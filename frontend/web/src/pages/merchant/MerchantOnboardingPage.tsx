import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Check, Upload } from 'lucide-react';
import { uploadCatalogImage } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Merchant onboarding — 3-step flow; Step 2 matches KYC mockup. */
export default function MerchantOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    password: '',
    firstName: '',
    businessName: 'Boutique 22',
    category: 'Fashion',
    country: 'GH',
    documentUrl: '',
    registrationNumber: 'BN-2024-88213',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onCertSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCert(true);
    try {
      // Register may not have token yet — upload after register in finish(), or use temp local preview.
      // Prefer direct upload when a merchant token already exists; otherwise stash File for finish().
      (window as any).__MOVR_PENDING_CERT__ = file;
      set('documentUrl', '');
      toast.success(`Selected ${file.name} — will upload on submit`);
    } finally {
      setUploadingCert(false);
    }
  };

  const finish = async () => {
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Add an email or phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/register`, form);
      const token = res.data.data.token;
      localStorage.setItem('movr_merchant_token', token);
      localStorage.setItem('movr_merchant', JSON.stringify(res.data.data.merchant));

      let fileUrl = form.documentUrl;
      const pending: File | undefined = (window as any).__MOVR_PENDING_CERT__;
      if (pending) {
        fileUrl = await uploadCatalogImage(pending, token);
        delete (window as any).__MOVR_PENDING_CERT__;
        set('documentUrl', fileUrl);
      }

      if (!fileUrl) {
        toast.error('Upload a registration certificate file to continue');
        setLoading(false);
        return;
      }

      await axios.post(
        `${API}/merchant/kyc`,
        {
          documentType: 'business_registration',
          documentNumber: form.registrationNumber,
          fileUrl,
          businessRegistrationNumber: form.registrationNumber,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
                ? 'bg-movr-gradient'
                : n === step
                  ? 'bg-movr-gradient'
                  : 'bg-border text-text-secondary'
            }`}
          >
            {n < step ? <Check size={16} /> : n}
          </div>
          {n < 3 ? (
            <div
              className={`w-16 h-0.5 ${n < step ? 'bg-movr-green' : 'bg-border'}`}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center px-4 py-10 font-[Poppins,Montserrat,sans-serif]">
      <div className="w-full max-w-md">
        <StepDots />

        {step === 1 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Create your account</h1>
            <p className="text-text-secondary">Step 1 of 3 · Account details</p>
            {(
              [
                ['email', 'Email', 'email', 'merchant@business.com'],
                ['phone', 'Phone number', 'tel', '+233 24 000 0000'],
                ['password', 'Password', 'password', ''],
                ['firstName', 'Your name', 'text', ''],
              ] as const
            ).map(([key, label, type, placeholder]) => (
              <div key={key}>
                <label className="block text-sm text-text-secondary mb-2">{label}</label>
                <input
                  type={type}
                  className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3 placeholder:text-text-secondary"
                  placeholder={placeholder || undefined}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  required={key === 'password' || key === 'firstName'}
                />
              </div>
            ))}
            <p className="text-xs text-text-secondary">Provide at least an email or a phone number.</p>
            <button
              type="button"
              onClick={() => {
                if (!form.email.trim() && !form.phone.trim()) {
                  toast.error('Add an email or phone number');
                  return;
                }
                if (!form.password || !form.firstName) {
                  toast.error('Name and password are required');
                  return;
                }
                setStep(2);
              }}
              className="w-full rounded-xl py-3.5 font-semibold bg-movr-gradient"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Business registration</h1>
            <p className="text-text-secondary">Step 2 of 3 · KYC verification</p>
            <div>
              <label className="block text-sm text-text-secondary mb-2">Business name</label>
              <input
                className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                Business registration number
              </label>
              <input
                className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
              />
            </div>
            <label className="w-full rounded-xl border border-dashed border-[var(--border)] bg-surface-elevated py-10 flex flex-col items-center gap-2 text-text-secondary hover:border-electric-violet cursor-pointer">
              <Upload size={22} />
              <span>
                {uploadingCert
                  ? 'Preparing…'
                  : form.documentUrl || (typeof window !== 'undefined' && (window as any).__MOVR_PENDING_CERT__)
                    ? 'Certificate selected · tap to replace'
                    : 'Upload registration certificate'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={onCertSelected}
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl px-5 py-3 border border-border"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl py-3.5 font-semibold bg-movr-gradient"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h1 className="text-3xl font-bold">Store category</h1>
            <p className="text-text-secondary">Step 3 of 3 · Almost done</p>
            <select
              className="w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
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
                className="rounded-xl px-5 py-3 border border-border"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={finish}
                className="flex-1 rounded-xl py-3.5 font-semibold bg-movr-gradient disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create storefront'}
              </button>
            </div>
          </div>
        ) : null}

        <p className="text-sm text-text-secondary text-center mt-8">
          Already registered?{' '}
          <Link className="text-motion-blue" to="/merchant/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
