import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Moon, Sun } from 'lucide-react';

const API = process.env.REACT_APP_API_URL || '/api/v1';

/** Admin login — stores JWT in movr_admin_token. */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@movr.app');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [themeMode, setThemeMode] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  );

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Login failed');
      const userType = json.data?.userType || json.data?.user?.userType;
      if (userType !== 'admin') {
        throw new Error('This account is not an admin');
      }
      localStorage.setItem('movr_admin_token', json.data.token);
      localStorage.setItem('movr_admin_email', email);
      const roles = json.data?.roles || json.data?.user?.roles || [];
      localStorage.setItem('movr_admin_roles', JSON.stringify(roles));
      toast.success('Signed in');
      navigate('/overview');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--jet-black)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Poppins, Montserrat, sans-serif',
        padding: 24,
      }}
    >
      <form
        onSubmit={login}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Movr Admin</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 14 }}>
          Sign in with your admin account
        </p>

        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          style={inputStyle}
        />

        <label
          style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, marginTop: 16 }}
        >
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            marginTop: 28,
            border: 'none',
            borderRadius: 999,
            padding: '14px 0',
            fontWeight: 700,
            color: 'var(--brand-white)',
            cursor: 'pointer',
            background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => {
              const current = document.documentElement.getAttribute('data-theme') || 'dark';
              const next = current === 'light' ? 'dark' : 'light';
              localStorage.setItem('movr-theme', next);
              document.documentElement.setAttribute('data-theme', next);
              document.documentElement.style.colorScheme = next;
              setThemeMode(next);
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            {themeMode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Use seeded admin credentials from db:seed
        </p>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: 15,
  outline: 'none',
};
