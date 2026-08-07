import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import MerchantShell from '../../layouts/MerchantShell';
import { VerifiedBadgeWeb } from '@movr/design-system/components/VerifiedBadgeWeb';
import { TextField, GenderSelect, GenderValue } from '../../components/forms';
import { mediaUrl } from '../../lib/media';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` });

/** Merchant account settings — personal profile + business + notifications. */
export default function MerchantSettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<GenderValue | string>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [business, setBusiness] = useState({
    email: '',
    reg: '',
    payout: '',
  });
  const [alerts, setAlerts] = useState({ newOrders: true, dailySummary: true });
  const [attestation, setAttestation] = useState<{ status?: string; explorerUrl?: string } | null>(
    null
  );

  useEffect(() => {
    axios
      .get(`${API}/merchant/me`, { headers: headers() })
      .then(async (res) => {
        const m = res.data?.data;
        if (!m) return;
        setFirstName(m.first_name || '');
        setLastName(m.last_name || '');
        setPhone(m.phone || '');
        setGender(m.gender || '');
        setAvatarUrl(m.avatar_url || '');
        setBusiness({
          email: m.business_email || m.email || '',
          reg: m.registration_number || m.business_registration_number || '',
          payout:
            typeof m.payout_account === 'string'
              ? m.payout_account
              : 'GCB Bank · ****3390',
        });
        if (m.notifications) {
          setAlerts({
            newOrders: m.notifications.new_order_alerts !== false,
            dailySummary: m.notifications.daily_sales_summary !== false,
          });
        }
        const uid = m.user_id;
        if (!uid) return;
        try {
          const a = await axios.get(`${API}/kyc/attestation/${uid}`, { headers: headers() });
          const row = a.data?.data;
          if (!row) return;
          const chain = String(row.chain || 'polygon-amoy');
          const explorer = row.tx_hash
            ? chain.includes('amoy')
              ? `https://amoy.polygonscan.com/tx/${row.tx_hash}`
              : `https://polygonscan.com/tx/${row.tx_hash}`
            : undefined;
          setAttestation({ status: row.status || row.attestationStatus, explorerUrl: explorer });
        } catch {
          /* none yet */
        }
      })
      .catch(() => undefined);
  }, []);

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('avatar', file);
      const res = await axios.post(`${API}/users/avatar`, body, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.avatarUrl || res.data?.data?.url;
      if (!url) throw new Error('Upload did not return a URL');
      setAvatarUrl(url);
      toast.success('Profile photo saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await axios.put(
        `${API}/users/profile`,
        {
          firstName,
          lastName,
          phone,
          gender: gender || null,
        },
        { headers: headers() }
      );
      toast.success('Profile saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const persistAlert = async (next: { newOrders: boolean; dailySummary: boolean }) => {
    setAlerts(next);
    try {
      await axios.patch(
        `${API}/merchant/settings/notifications`,
        {
          new_order_alerts: next.newOrders,
          daily_sales_summary: next.dailySummary,
        },
        { headers: headers() }
      );
    } catch {
      toast.error('Could not save notification setting');
    }
  };

  const Row = ({
    label,
    value,
    onClick,
  }: {
    label: string;
    value: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex justify-between gap-4 py-4 border-b border-border text-left disabled:cursor-default"
    >
      <span className="text-pure-white">{label}</span>
      <span className="text-text-secondary text-right">{value}</span>
    </button>
  );

  return (
    <MerchantShell activePath="/merchant/settings">
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Account settings</h1>
        <VerifiedBadgeWeb status={attestation?.status} explorerUrl={attestation?.explorerUrl} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">PROFILE</p>
      <form onSubmit={saveProfile} className="mb-10 max-w-xl space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 rounded-full overflow-hidden border border-border bg-[#1A1A1A] shrink-0"
            aria-label="Upload profile photo"
          >
            {avatarUrl ? (
              <img src={mediaUrl(avatarUrl)} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-lg text-text-secondary">
                {(firstName || 'M')[0].toUpperCase()}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] py-0.5 flex items-center justify-center gap-1">
              <Camera size={11} /> {uploading ? '…' : 'Edit'}
            </span>
          </button>
          <p className="text-sm text-text-secondary">Photo saves to the database immediately.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatarSelected}
          />
        </div>
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
        />
        <GenderSelect value={gender} onChange={setGender} />
        <button type="submit" disabled={savingProfile} className="btn-primary rounded-full px-6 py-3">
          {savingProfile ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <p className="text-xs tracking-wider text-text-secondary mb-2">BUSINESS</p>
      <div className="mb-10 max-w-xl">
        <Row label="Business email" value={business.email || '—'} />
        <Row label="Registration number" value={business.reg || '—'} />
        <Row label="Payout account" value={business.payout || '—'} />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">NOTIFICATIONS</p>
      <div className="mb-10 max-w-xl">
        <Row
          label="New order alerts"
          value={alerts.newOrders ? 'On' : 'Off'}
          onClick={() => persistAlert({ ...alerts, newOrders: !alerts.newOrders })}
        />
        <Row
          label="Daily sales summary"
          value={alerts.dailySummary ? 'On' : 'Off'}
          onClick={() => persistAlert({ ...alerts, dailySummary: !alerts.dailySummary })}
        />
      </div>

      <Link to="/merchant/store" className="text-sm text-motion-blue hover:underline">
        Edit store profile & banner →
      </Link>
    </MerchantShell>
  );
}
