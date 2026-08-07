import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const AVATAR_KEY = 'movr_admin_avatar_url';

const NAV = [
  { label: 'Overview', to: '/overview' },
  { label: 'Site content', to: '/cms' },
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'Live map', to: '/live-map' },
  { label: 'Pricing engine', to: '/pricing' },
  { label: 'Finance', to: '/finance' },
  { label: 'Users', to: '/users' },
  { label: 'Rides', to: '/rides' },
  { label: 'Orders', to: '/orders' },
  { label: 'Merchants', to: '/merchants' },
  { label: 'KYC queue', to: '/kyc-queue' },
  { label: 'Identity review', to: '/identity' },
  { label: 'Feature flags', to: '/feature-flags' },
  { label: 'Airdrops', to: '/airdrops' },
  { label: 'Integrations', to: '/integrations' },
  { label: 'Payments', to: '/payments' },
  { label: 'Rewards', to: '/rewards' },
  { label: 'Vehicle pricing', to: '/vehicles' },
  { label: 'Channels', to: '/channels' },
  { label: 'SMS', to: '/sms' },
  { label: 'Audit', to: '/audit' },
];

function mediaUrl(url?: string | null) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads') || url.startsWith('/assets')) {
    try {
      if (API.startsWith('http')) return new URL(url, new URL(API).origin).toString();
      return `${window.location.origin}${url}`;
    } catch {
      return url;
    }
  }
  return url;
}

/** Admin shell — sidebar + top header with profile dropdown. */
export default function AdminShell({
  children,
  activeLabel,
  hidePageTitle,
}: {
  children: React.ReactNode;
  activeLabel?: string;
  hidePageTitle?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode, setPreference } = useTheme();
  const email = localStorage.getItem('movr_admin_email') || 'admin@movr.app';
  const initial = (email.trim()[0] || 'A').toUpperCase();

  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem(AVATAR_KEY) || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeItem =
    NAV.find((n) => activeLabel === n.label || location.pathname.startsWith(n.to)) ||
    (location.pathname.startsWith('/settings')
      ? { label: 'Settings', to: '/settings' }
      : NAV[0]);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const signOut = () => {
    localStorage.removeItem('movr_admin_token');
    localStorage.removeItem('movr_admin_email');
    localStorage.removeItem('movr_admin_roles');
    localStorage.removeItem(AVATAR_KEY);
    window.location.href = '/admin/login';
  };

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file');
      return;
    }
    setUploading(true);
    setUploadError('');
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
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const Avatar = ({ size = 36 }: { size?: number }) =>
    avatarUrl ? (
      <img
        src={mediaUrl(avatarUrl)}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid var(--border)',
        }}
      />
    ) : (
      <div
        style={{
          ...styles.avatar,
          width: size,
          height: size,
          background: 'linear-gradient(135deg, var(--electric-violet), var(--motion-blue))',
          color: 'var(--brand-white)',
        }}
      >
        {initial}
      </div>
    );

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>Movr</div>
        <p style={styles.brandSub}>Admin console</p>
        <nav style={styles.nav}>
          {NAV.map((item) => {
            const active =
              activeLabel === item.label || location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  ...styles.navItem,
                  ...(active ? styles.navActive : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div style={styles.mainCol}>
        <header style={styles.header}>
          <div>
            {!hidePageTitle ? (
              <>
                <p style={styles.headerEyebrow}>MOVR OPS</p>
                <h2 style={styles.headerTitle}>{activeItem.label}</h2>
              </>
            ) : (
              <p style={styles.headerEyebrow}>MOVR OPS</p>
            )}
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={mode === 'light' ? 'Dark mode' : 'Light mode'}
              onClick={() => setPreference(mode === 'light' ? 'dark' : 'light')}
              style={styles.themeIconBtn}
            >
              {mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <div style={styles.headerRight} ref={dropdownRef}>
              <button
                type="button"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-label="Open profile menu"
                onClick={() => setProfileOpen((v) => !v)}
                style={styles.avatarBtn}
              >
                <Avatar />
              </button>

              {profileOpen ? (
                <div role="menu" style={styles.menu}>
                  <div style={styles.menuHeader}>
                    <Avatar size={48} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={styles.menuName}>Admin</p>
                      <p style={styles.menuEmail}>{email}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    style={styles.menuItem}
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Change profile photo'}
                  </button>
                  {uploadError ? <p style={styles.menuError}>{uploadError}</p> : null}

                  <button
                    type="button"
                    role="menuitem"
                    style={styles.menuItem}
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                  >
                    Settings
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    style={{ ...styles.menuItem, ...styles.menuSignOut }}
                    onClick={signOut}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onAvatarSelected}
              />
            </div>
          </div>
        </header>
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'var(--jet-black)',
    color: 'var(--text-primary)',
    display: 'flex',
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    overflowY: 'auto',
  },
  brand: { fontSize: 22, fontWeight: 800, padding: '0 8px' },
  brandSub: { color: 'var(--text-secondary)', fontSize: 12, padding: '4px 8px 20px', margin: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navItem: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
  },
  navActive: {
    color: 'var(--brand-white)',
    background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
  },
  mainCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '18px 32px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--jet-black)',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  headerEyebrow: {
    margin: 0,
    fontSize: 11,
    letterSpacing: 1.2,
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  headerTitle: { margin: '4px 0 0', fontSize: 22, fontWeight: 700 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },
  themeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  headerRight: { position: 'relative', display: 'flex', alignItems: 'center' },
  avatarBtn: {
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    borderRadius: '50%',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 13,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 10px)',
    width: 260,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
    zIndex: 50,
  },
  menuHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px',
    borderBottom: '1px solid var(--border)',
  },
  menuName: { margin: 0, fontWeight: 700, fontSize: 14 },
  menuEmail: {
    margin: '4px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  menuItem: {
    width: '100%',
    display: 'block',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
  menuError: {
    margin: '0 16px 8px',
    color: 'var(--error)',
    fontSize: 12,
  },
  menuSignOut: {
    color: 'var(--error)',
    borderTop: '1px solid var(--border)',
    fontWeight: 600,
  },
  content: { padding: 32, flex: 1 },
};
