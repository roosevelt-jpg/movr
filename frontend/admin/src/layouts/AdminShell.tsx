import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NAV = [
  { label: 'Overview', to: '/overview' },
  { label: 'Site content', to: '/cms' },
  { label: 'Marketplace', to: '/marketplace' },
  { label: 'Live map', to: '/live-map' },
  { label: 'Pricing engine', to: '/pricing' },
  { label: 'Finance', to: '/finance' },
  { label: 'Users', to: '/users' },
  { label: 'Merchants', to: '/merchants' },
  { label: 'KYC queue', to: '/kyc-queue' },
  { label: 'Identity review', to: '/identity' },
  { label: 'Feature flags', to: '/feature-flags' },
  { label: 'Integrations', to: '/integrations' },
  { label: 'Payments', to: '/payments' },
  { label: 'Rewards', to: '/rewards' },
  { label: 'Vehicle pricing', to: '/vehicles' },
  { label: 'Channels', to: '/channels' },
  { label: 'SMS', to: '/sms' },
  { label: 'Audit', to: '/audit' },
];

/** Admin shell — sidebar + top header (routes unchanged). */
export default function AdminShell({
  children,
  activeLabel,
}: {
  children: React.ReactNode;
  activeLabel?: string;
}) {
  const location = useLocation();
  const email = localStorage.getItem('movr_admin_email') || 'admin@movr.app';
  const activeItem =
    NAV.find((n) => activeLabel === n.label || location.pathname.startsWith(n.to)) || NAV[0];

  const signOut = () => {
    localStorage.removeItem('movr_admin_token');
    localStorage.removeItem('movr_admin_email');
    window.location.href = '/admin/login';
  };

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
        <button type="button" onClick={signOut} style={styles.signOut}>
          Sign out
        </button>
      </aside>

      <div style={styles.mainCol}>
        <header style={styles.header}>
          <div>
            <p style={styles.headerEyebrow}>MOVR OPS</p>
            <h2 style={styles.headerTitle}>{activeItem.label}</h2>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.email}>{email}</span>
            <div style={styles.avatar}>A</div>
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
    color: 'var(--pure-white)',
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
    color: 'var(--pure-white)',
    background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
  },
  signOut: {
    marginTop: 16,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--error)',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
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
    zIndex: 10,
  },
  headerEyebrow: { margin: 0, color: 'var(--text-secondary)', fontSize: 11, letterSpacing: 1 },
  headerTitle: { margin: '4px 0 0', fontSize: 20, fontWeight: 700 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  email: { color: 'var(--text-secondary)', fontSize: 13 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--electric-violet), var(--motion-blue))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 14,
  },
  content: { padding: 32, flex: 1 },
};
