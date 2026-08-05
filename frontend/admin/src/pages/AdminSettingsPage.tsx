import React from 'react';
import AdminShell from '../layouts/AdminShell';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemePreference } from '@movr/design-system/theme';

/** Admin account settings — appearance + identity. */
export default function AdminSettingsPage() {
  const { preference, mode, setPreference } = useTheme();
  const email = localStorage.getItem('movr_admin_email') || 'admin@movr.app';

  return (
    <AdminShell activeLabel="Settings">
      <h1 style={{ marginTop: 0, fontSize: 28, fontWeight: 700 }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Account and appearance for the ops console.
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
            margin: '0 0 6px',
            fontSize: 12,
            letterSpacing: 1,
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          ACCOUNT
        </p>
        <p style={{ margin: 0, fontWeight: 600 }}>{email}</p>
        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>Admin</p>
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
