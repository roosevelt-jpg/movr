import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const OPS_TABS = [
  { label: 'Live map', to: '/live-map' },
  { label: 'Pricing engine', to: '/pricing' },
  { label: 'Finance', to: '/finance' },
  { label: 'Identity review', to: '/identity' },
  { label: 'Integrations', to: '/integrations' },
];

/** Horizontal ops nav matching Live map / Finance mockups. */
export default function AdminOpsNav() {
  const location = useLocation();
  return (
    <nav style={styles.nav}>
      {OPS_TABS.map((t) => {
        const active = location.pathname.startsWith(t.to);
        return (
          <Link
            key={t.to}
            to={t.to}
            style={{
              ...styles.tab,
              ...(active ? styles.tabActive : {}),
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    gap: 28,
    marginBottom: 24,
    borderBottom: '1px solid #222',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '10px 0',
    color: '#888',
    textDecoration: 'none',
    fontSize: 15,
    fontWeight: 500,
    borderBottom: '2px solid transparent',
    marginBottom: -1,
  },
  tabActive: {
    color: '#fff',
    borderBottomColor: '#3B82F6',
    fontWeight: 600,
  },
};
