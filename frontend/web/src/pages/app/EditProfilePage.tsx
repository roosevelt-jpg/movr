import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { usersApi } from '../../services/api';
import {
  TextField,
  GenderSelect,
  CountrySelect,
  DateSelect,
  GenderValue,
  genderLabel,
  formatDisplayDate,
} from '../../components/forms';
import { setStoredCountry } from '../../hooks/useLocalCurrency';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Edit profile — gender / country / DOB via global selectors. */
export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState<GenderValue | string>((user as any)?.gender || '');
  const [country, setCountry] = useState(user?.country || 'GH');
  const [city, setCity] = useState(user?.city || '');
  const [dateOfBirth, setDateOfBirth] = useState((user as any)?.dateOfBirth || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi
      .getProfile()
      .then((res) => {
        const p = res.data?.data;
        if (!p) return;
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setPhone(p.phone || '');
        setGender(p.gender || '');
        setCountry(p.country || 'GH');
        setCity(p.city || '');
        setDateOfBirth(p.dateOfBirth || '');
        setAvatarUrl(p.avatarUrl || '');
        if (user) setUser({ ...user, ...p });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const onCountry = async (code: string) => {
    setCountry(code);
    setStoredCountry(code);
    try {
      const res = await fetch(`${API}/public/resolve?country=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (j?.data?.city) setCity(j.data.city);
    } catch {
      /* keep */
    }
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      const url = res.data?.data?.avatarUrl || res.data?.data?.avatar_url || res.data?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setAvatarUrl(url);
      setUser({ ...user, avatarUrl: url });
      toast.success('Photo saved to your account');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await usersApi.updateProfile({
        firstName,
        lastName,
        phone,
        gender: gender || null,
        country,
        city,
        dateOfBirth: dateOfBirth || null,
      });
      const next = res.data?.data;
      if (next) {
        setUser({
          ...(user as any),
          ...next,
          firstName: next.firstName,
          lastName: next.lastName,
          phone: next.phone,
          country: next.country,
          city: next.city,
          avatarUrl: next.avatarUrl || avatarUrl,
        });
      }
      toast.success('Profile saved');
      navigate('/profile');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-xl">
        <p className="text-text-secondary">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] p-4 sm:p-6 md:p-8 max-w-xl mx-auto w-full">
      <button
        type="button"
        onClick={() => navigate('/profile')}
        className="text-sm text-text-secondary mb-4"
      >
        ← Profile
      </button>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Edit profile</h1>
      <p className="text-text-secondary text-sm mb-6">
        Changes save to your account in the database. Photo uploads apply immediately.
      </p>

      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full overflow-hidden border border-border bg-surface-elevated shrink-0"
          aria-label="Upload profile photo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-xl font-semibold text-text-secondary">
              {(firstName || 'U')[0].toUpperCase()}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] py-1 flex items-center justify-center gap-1">
            <Camera size={12} /> {uploading ? '…' : 'Edit'}
          </span>
        </button>
        <div>
          <p className="font-medium">Profile photo</p>
          <p className="text-sm text-text-secondary">Saved to the database as soon as you upload.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onAvatarSelected}
        />
      </div>

      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <TextField
            label="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GenderSelect value={gender} onChange={setGender} />
          <DateSelect value={dateOfBirth} onChange={setDateOfBirth} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CountrySelect value={country} onChange={onCountry} required />
          <TextField
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </div>

        {(gender || dateOfBirth) && (
          <p className="text-xs text-text-secondary">
            {gender ? genderLabel(String(gender)) : ''}
            {gender && dateOfBirth ? ' · ' : ''}
            {dateOfBirth ? formatDisplayDate(dateOfBirth) : ''}
          </p>
        )}

        <button type="submit" disabled={saving} className="btn-primary w-full rounded-full py-3.5">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
