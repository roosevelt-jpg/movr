import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Check, Upload } from 'lucide-react';
import { uploadCatalogImage } from '../../lib/media';
import { CountrySelect } from '../../components/forms';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Merchant onboarding — Step 2 matches Business registration KYC mockup. */
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
  const [certFile, setCertFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onCertSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingCert(true);
    try {
      setCertFile(file);
      set('documentUrl', '');
      toast.success(`Selected ${file.name}`);
    } finally {
      setUploadingCert(false);
    }
  };

  const hasCertificate = Boolean(certFile || form.documentUrl);

  const finish = async () => {
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Add an email or phone number');
      return;
    }
    if (!hasCertificate) {
      toast.error('Upload a registration certificate');
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/merchant/auth/register`, form);
      const token = res.data.data.token;
      localStorage.setItem('movr_merchant_token', token);
      localStorage.setItem('movr_merchant', JSON.stringify(res.data.data.merchant));

      let fileUrl = form.documentUrl;
      if (certFile) {
        fileUrl = await uploadCatalogImage(certFile, token);
        set('documentUrl', fileUrl);
        setCertFile(null);
      }

      if (!fileUrl) {
        toast.error('Upload a registration certificate file to continue');
        setLoading(false);
        setStep(2);
        return;
      }

      await axios.post(
        `${API}/merchant/kyc`,
        {
          documentType: 'business_registration',
          documentNumber: form.registrationNumber,
          fileUrl,
          businessRegistrationNumber: form.registrationNumber,
          businessName: form.businessName,
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
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
              n <= step ? 'bg-[#6345ED]' : 'bg-[#2A2A2A] text-zinc-400'
            }`}
          >
            {n < step ? <Check size={16} strokeWidth={3} /> : n}
          </div>
          {n < 3 ? (
            <div className={`w-16 h-0.5 ${n < step ? 'bg-[#22C55E]' : 'bg-[#2A2A2A]'}`} />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );

  const fieldClass =
    'input-base rounded-xl min-h-[48px]';

  return (
    <div className="min-h-[70vh] bg-jet-black text-pure-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <StepDots />

        {step === 1 ? (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold">Create your account</h1>
              <p className="text-text-secondary mt-2">Step 1 of 3 · Account details</p>
            </div>
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
                  className={fieldClass}
                  placeholder={placeholder || undefined}
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  required={key === 'password' || key === 'firstName'}
                />
              </div>
            ))}
            <CountrySelect
              value={form.country}
              onChange={(code) => set('country', code)}
              required
            />
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
                if (!form.country) {
                  toast.error('Select a country');
                  return;
                }
                setStep(2);
              }}
              className="btn-primary w-full rounded-full py-3.5"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="text-center">
              <h1 className="text-3xl font-bold">Business registration</h1>
              <p className="text-zinc-400 mt-2">Step 2 of 3 · KYC verification</p>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Business name</label>
              <input
                className={fieldClass}
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Business registration number</label>
              <input
                className={fieldClass}
                value={form.registrationNumber}
                onChange={(e) => set('registrationNumber', e.target.value)}
              />
            </div>
            <label className="w-full rounded-xl border border-dashed border-zinc-500 bg-transparent py-12 flex flex-col items-center gap-2 text-zinc-400 hover:border-[#6345ED] cursor-pointer transition-colors">
              <Upload size={22} />
              <span className="text-sm">
                {uploadingCert
                  ? 'Preparing…'
                  : hasCertificate
                    ? `${certFile?.name || 'Certificate selected'} · tap to replace`
                    : 'Upload registration certificate'}
              </span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={onCertSelected}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!form.businessName.trim()) {
                  toast.error('Enter a business name');
                  return;
                }
                if (!form.registrationNumber.trim()) {
                  toast.error('Enter a registration number');
                  return;
                }
                if (!hasCertificate) {
                  toast.error('Upload a registration certificate');
                  return;
                }
                setStep(3);
              }}
              className="btn-primary w-full rounded-full py-3.5"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold">Store category</h1>
              <p className="text-text-secondary mt-2">Step 3 of 3 · Almost done</p>
            </div>
            <select
              className={fieldClass}
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
                className="btn-secondary rounded-full px-5 py-3"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={finish}
                className="btn-primary flex-1 rounded-full py-3.5"
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
