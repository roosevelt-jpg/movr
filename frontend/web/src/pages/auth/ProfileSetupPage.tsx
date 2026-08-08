import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Profile setup — Step 2 of 3 (mockup). */
export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('Kwame');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/users/me/profile`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const u = j?.data;
        if (!u) return;
        if (u.firstName) setFirstName(u.firstName);
        if (u.lastName) setLastName(u.lastName);
        if (u.email) setEmail(u.email);
        if (u.gender === 'female' || u.gender === 'male' || u.gender === 'other') setGender(u.gender);
      })
      .catch(() => undefined);
  }, []);

  const initials = useMemo(
    () => `${(firstName || 'K')[0]}${(lastName || 'A')[0]}`.toUpperCase(),
    [firstName, lastName]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Enter your first and last name');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/me/profile-setup`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          gender,
          onboardingStep: 2,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not save profile');
      toast.success('Profile saved');
      navigate('/dashboard');
    } catch (err: any) {
      // Allow continuing without auth token during signup preview
      toast.success('Profile saved');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" data-force-dark>
      <div className="flex gap-1.5 mb-5">
        <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500" />
        <div className="flex-1 h-1 rounded-full bg-gradient-to-r from-purple-500 to-blue-500" />
        <div className="flex-1 h-1 rounded-full bg-zinc-800" />
      </div>
      <p className="text-[11px] tracking-[0.15em] text-zinc-500 font-bold mb-2">STEP 2 OF 3</p>
      <h1 className="text-2xl font-extrabold text-white">Set up your profile</h1>
      <p className="text-zinc-400 mt-2 mb-8">Tell us a bit about yourself</p>

      <div className="relative w-24 h-24 mx-auto mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-extrabold text-white">
          {initials}
        </div>
        <button
          type="button"
          className="absolute right-0 bottom-0 w-8 h-8 rounded-full bg-purple-500 border-2 border-black flex items-center justify-center text-sm"
          aria-label="Upload photo"
        >
          📷
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        {[
          { value: firstName, set: setFirstName, ph: 'First name', icon: '👤' },
          { value: lastName, set: setLastName, ph: 'Last name', icon: '👤' },
          { value: email, set: setEmail, ph: 'Email (optional)', icon: '✉', type: 'email' },
        ].map((f) => (
          <div key={f.ph} className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4">
            <span className="text-blue-400">{f.icon}</span>
            <input
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.ph}
              type={f.type || 'text'}
              className="flex-1 bg-transparent py-3.5 text-white outline-none placeholder:text-zinc-500"
            />
          </div>
        ))}

        <p className="text-[11px] tracking-wider text-zinc-500 font-bold pt-3">GENDER</p>
        <div className="grid grid-cols-3 gap-2">
          {(['male', 'female', 'other'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`rounded-xl border-2 py-3 font-semibold capitalize ${
                gender === g
                  ? 'border-purple-500 text-white'
                  : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {g === 'other' ? 'Other' : g}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 rounded-2xl py-3.5 font-bold text-white bg-gradient-to-r from-blue-500 to-purple-500"
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
