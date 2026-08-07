import React, { useEffect, useRef, useState } from 'react';
import AdminShell from '../layouts/AdminShell';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '@movr/design-system/theme';
import { mediaUrl } from '../lib/media';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const AVATAR_KEY = 'movr_admin_avatar_url';

/** Admin account settings — profile + appearance. */
export default function AdminSettingsPage() {
  const { preference, mode, setPreference } = useTheme();
  const email = localStorage.getItem('movr_admin_email') || 'admin@movr.app';
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem(AVATAR_KEY) || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('movr_admin_token') || '';
    fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        const p = json?.data;
        if (!p) return;
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setPhone(p.phone || '');
        if (p.avatarUrl) {
          setAvatarUrl(p.avatarUrl);
          localStorage.setItem(AVATAR_KEY, p.avatarUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Please choose an image file');
      return;
    }
    setUploading(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('avatar', file);
      const res = await fetch(`${API}/users/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` },
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Upload failed');
      const url = json.data?.avatarUrl || json.data?.url;
      if (!url) throw new Error('Upload did not return a URL');
      localStorage.setItem(AVATAR_KEY, url);
      setAvatarUrl(url);
      setMessage('Photo saved to database');
    } catch (err: any) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API}/users/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Save failed');
      setMessage('Profile saved');
    } catch (err: any) {
      setMessage(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    marginTop: 6,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 14,
  };

  return (
    <AdminShell activeLabel="Settings">
      <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 700 }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Account and appearance for the ops console. Profile changes write to the database.
      </p>

      <section
        style={{
          maxWidth: 480,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            letterSpacing: 1,
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          PROFILE
        </p>
        <form onSubmit={saveProfile}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                padding: 0,
                cursor: 'pointer',
                background: 'var(--surface)',
              }}
              aria-label="Upload profile photo"
            >
              {avatarUrl ? (
                <img
                  src={mediaUrl(avatarUrl)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700 }}>
                  {(firstName || email)[0].toUpperCase()}
                </span>
              )}
            </button>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{email}</p>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                {uploading ? 'Uploading…' : 'Photo saves immediately'}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onAvatarSelected}
            />
          </div>
          <label style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            First name
            <input
              style={fieldStyle}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
            Last name
            <input
              style={fieldStyle}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </label>
          <label style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
            Phone
            <input
              style={fieldStyle}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            style={{
              border: 'none',
              borderRadius: 999,
              padding: '10px 18px',
              background: 'var(--motion-blue)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          {message ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              {message}
            </p>
          ) : null}
        </form>
      </section>

      <section
        style={{
          maxWidth: 480,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 20,
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 12,
            letterSpacing: 1,
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          APPEARANCE · {preference === 'system' ? `Auto (${mode})` : preference}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreference(p)}
              style={{
                flex: 1,
                border: `1px solid ${preference === p ? 'var(--motion-blue)' : 'var(--border)'}`,
                background:
                  preference === p ? 'rgba(0, 85, 255, 0.12)' : 'var(--surface)',
                color: 'var(--text-primary)',
                borderRadius: 999,
                padding: '10px 12px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {p === 'system' ? 'Auto' : p === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
