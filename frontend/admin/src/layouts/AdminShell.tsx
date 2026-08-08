import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { clearAdminAccess } from '../lib/rbac';
import { useTheme } from '../theme/ThemeProvider';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const AVATAR_KEY = 'movr_admin_avatar_url';

type NavItem = { label: string; to: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/overview' },
      { label: 'Analytics', to: '/analytics' },
      { label: 'Live Map', to: '/live-map' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Ride Management', to: '/rides' },
      { label: 'Dispatcher', to: '/dispatch' },
      { label: 'Deliveries', to: '/orders' },
      { label: 'Rentals', to: '/vehicles' },
      { label: 'Broadcasts', to: '/broadcasts' },
    ],
  },
  {
    title: 'Marketplace',
    items: [
      { label: 'Stores', to: '/marketplace-mgmt' },
      { label: 'Orders', to: '/orders' },
      { label: 'Products', to: '/marketplace' },
      { label: 'Coupons', to: '/promotions' },
    ],
  },
  {
    title: 'Users',
    items: [
      { label: 'Customers', to: '/customers' },
      { label: 'Drivers', to: '/drivers' },
      { label: 'Merchants', to: '/merchants' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Transactions', to: '/finance' },
      { label: 'Settlements', to: '/finance' },
      { label: 'GMV Report', to: '/finance' },
    ],
  },
  {
    title: 'Tokens',
    items: [{ label: 'DVT Overview', to: '/tokens' }],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Site content', to: '/cms' },
      { label: 'Team & access', to: '/team' },
      { label: 'KYC', to: '/kyc-queue' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Subscription fees', to: '/subscription-fees' },
      { label: 'Identity review', to: '/identity' },
      { label: 'Feature flags', to: '/feature-flags' },
      { label: 'Integrations', to: '/integrations' },
      { label: 'Payments', to: '/payments' },
      { label: 'SMS', to: '/sms' },
      { label: 'Settings', to: '/settings' },
      { label: 'Audit', to: '/audit' },
    ],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((g) => g.items);

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

function resolveActive(pathname: string, activeLabel?: string): NavItem {
  if (activeLabel) {
    const byLabel = FLAT_NAV.find((n) => n.label === activeLabel);
    if (byLabel) return byLabel;
  }
  const exact = FLAT_NAV.find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  if (exact) return exact;
  if (pathname.startsWith('/map')) return { label: 'Live Map', to: '/live-map' };
  if (pathname.startsWith('/settings')) return { label: 'Settings', to: '/settings' };
  return FLAT_NAV[0];
}

/** Admin shell — grouped sidebar + top header with profile dropdown. */
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

  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(() => localStorage.getItem(AVATAR_KEY) || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeItem = resolveActive(location.pathname, activeLabel);

  useEffect(() => {
    setProfileOpen(false);
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem('movr_admin_token') || '';
    if (!token) return;
    fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        const url = json?.data?.avatarUrl;
        if (url) {
          localStorage.setItem(AVATAR_KEY, url);
          setAvatarUrl(url);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const signOut = () => {
    localStorage.removeItem('movr_admin_token');
    localStorage.removeItem('movr_admin_email');
    localStorage.removeItem('movr_admin_roles');
    clearAdminAccess();
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

  const pathMatches = (item: NavItem) => {
    if (item.to === '/overview') return location.pathname === '/overview';
    if (item.to === '/drivers') return location.pathname.startsWith('/drivers');
    if (item.to === '/customers') return location.pathname.startsWith('/customers');
    if (item.to === '/promotions') return location.pathname.startsWith('/promotions');
    if (item.to === '/tokens') return location.pathname.startsWith('/tokens');
    if (item.to === '/dispatch') return location.pathname.startsWith('/dispatch');
    if (item.to === '/marketplace-mgmt') return location.pathname.startsWith('/marketplace-mgmt');
    if (item.to === '/marketplace') {
      return location.pathname === '/marketplace' || location.pathname.startsWith('/marketplace/');
    }
    if (item.to === '/live-map') {
      return location.pathname.startsWith('/live-map') || location.pathname.startsWith('/map');
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const isNavActive = (item: NavItem) => {
    if (activeLabel && item.label === activeLabel) return true;
    if (activeLabel && FLAT_NAV.some((n) => n.label === activeLabel)) return false;
    if (!pathMatches(item)) return false;
    const first = FLAT_NAV.find(pathMatches);
    return first?.label === item.label && first?.to === item.to;
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
          background: 'var(--movr-gradient)',
          color: 'var(--brand-white)',
        }}
      >
        {initial}
      </div>
    );

  const sidebar = (
    <>
      <div style={styles.brandRow}>
        <div>
          <div style={styles.brand}>Movr</div>
          <p style={styles.brandSub}>Admin console</p>
        </div>
        <button
          type="button"
          className="admin-shell-close"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          style={styles.iconBtn}
        >
          <X size={18} />
        </button>
      </div>
      <nav style={styles.nav}>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} style={styles.navGroup}>
            <div style={styles.navSection}>{group.title}</div>
            {group.items.map((item) => {
              const active = isNavActive(item);
              return (
                <Link
                  key={`${group.title}-${item.label}-${item.to}`}
                  to={item.to}
                  style={{
                    ...styles.navItem,
                    ...(active ? styles.navActive : {}),
                  }}
                  onClick={() => setNavOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className={`admin-shell${navOpen ? ' admin-shell--nav-open' : ''}`} style={styles.root}>
      {navOpen ? (
        <button
          type="button"
          className="admin-shell-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside className="admin-shell-sidebar" style={styles.sidebar}>
        {sidebar}
      </aside>

      <div style={styles.mainCol}>
        <header className="admin-shell-header" style={styles.header}>
          <div style={styles.headerLeft}>
            <button
              type="button"
              className="admin-shell-menu"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
              style={styles.iconBtn}
            >
              <Menu size={18} />
            </button>
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
        <main className="admin-main" style={styles.content}>
          {children}
        </main>
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
    zIndex: 40,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  brand: { fontSize: 22, fontWeight: 800, padding: '0 8px' },
  brandSub: { color: 'var(--text-secondary)', fontSize: 12, padding: '4px 8px 20px', margin: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 16, flex: 1 },
  navGroup: { display: 'flex', flexDirection: 'column', gap: 2 },
  navSection: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    padding: '4px 12px 8px',
  },
  navItem: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
    padding: '9px 12px',
    borderRadius: 10,
    textDecoration: 'none',
  },
  navActive: {
    color: 'var(--brand-white)',
    background: 'var(--movr-gradient)',
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
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  headerEyebrow: {
    margin: 0,
    fontSize: 11,
    letterSpacing: 1.2,
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  headerTitle: { margin: '4px 0 0', fontSize: 22, fontWeight: 700 },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
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
    maxWidth: 'calc(100vw - 24px)',
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
