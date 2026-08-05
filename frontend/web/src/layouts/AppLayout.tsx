import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { usersApi } from '../services/api';
import toast from 'react-hot-toast';
import {
  Menu,
  X,
  LogOut,
  User,
  Settings,
  Wallet,
  Home,
  Car,
  Store,
  Coins,
  Layers,
  Clock,
  HelpCircle,
  Camera,
  ChevronDown,
} from 'lucide-react';
import MovrLogoMark from '../components/MovrLogoMark';
import { colors } from '@movr/design-system/theme';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: Home, match: ['/dashboard'] },
  { label: 'Rides', path: '/ride/active/new', icon: Car, match: ['/ride'] },
  { label: 'Marketplace', path: '/marketplace', icon: Store, match: ['/marketplace', '/store', '/cart'] },
  { label: 'Wallet', path: '/wallet', icon: Wallet, match: ['/wallet'] },
  { label: 'Token', path: '/token', icon: Coins, match: ['/token', '/claim'] },
  { label: 'Staking', path: '/staking', icon: Layers, match: ['/staking'] },
  { label: 'History', path: '/history', icon: Clock, match: ['/history'] },
  { label: 'Support', path: '/support', icon: HelpCircle, match: ['/support', '/bot', '/channels/bot'] },
  { label: 'Profile', path: '/profile', icon: User, match: ['/profile'] },
  { label: 'Settings', path: '/settings', icon: Settings, match: ['/settings'] },
];

function formatDateTime(d: Date) {
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return { date, time };
}

const AppLayout: React.FC = () => {
  const { user, logout, setUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (item: (typeof NAV_ITEMS)[number]) =>
    item.match.some(
      (prefix) =>
        location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
    );

  const go = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
    setProfileOpen(false);
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
      try {
        const res = await usersApi.uploadAvatar(file);
        const url = res.data?.data?.avatarUrl || res.data?.data?.avatar_url || res.data?.url;
        if (url) {
          setUser({ ...user, avatarUrl: url });
          toast.success('Profile photo updated');
          setProfileOpen(false);
          return;
        }
      } catch {
        // Fall back to local preview if API upload is unavailable
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      setUser({ ...user, avatarUrl: dataUrl });
      toast.success('Profile photo updated');
      setProfileOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const { date, time } = formatDateTime(now);

  const Avatar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const cls = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm';
    if (user?.avatarUrl) {
      return (
        <img
          src={user.avatarUrl}
          alt=""
          className={`${cls} rounded-full object-cover border border-[#2A2A2A]`}
        />
      );
    }
    return (
      <div
        className={`${cls} rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-[#6A00FF] to-[#0055FF]`}
      >
        {user?.firstName?.[0] || 'U'}
      </div>
    );
  };

  const SidebarNav = ({ onNavigate }: { onNavigate?: (path: string) => void }) => (
    <>
      <div className="flex items-center gap-2 px-2 mb-6">
        <MovrLogoMark className="w-9 h-9" />
        <span className="text-xl font-black" style={{ color: colors.pureWhite }}>
          MOVR
        </span>
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => (onNavigate ? onNavigate(item.path) : go(item.path))}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-gradient-to-r from-[#6A00FF] to-[#0055FF] text-white'
                  : 'text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-6 flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A] w-full"
      >
        <LogOut size={16} /> Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex font-[Poppins,Montserrat,sans-serif]">
      <aside className="hidden md:flex w-56 shrink-0 border-r border-[#2A2A2A] bg-black p-4 flex-col sticky top-0 h-screen">
        <SidebarNav />
      </aside>

      {isMenuOpen ? (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw] h-full bg-black border-r border-[#2A2A2A] p-4 flex flex-col">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                className="p-2 text-[#A0A0A0] hover:text-white"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <SidebarNav onNavigate={go} />
          </aside>
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur border-b border-[#2A2A2A] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 -ml-2 text-white shrink-0"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <Link to="/dashboard" className="md:hidden flex items-center gap-2 shrink-0">
              <MovrLogoMark className="w-8 h-8" />
              <span className="font-black" style={{ color: colors.pureWhite }}>
                MOVR
              </span>
            </Link>

            {/* Live date & time on every dashboard page */}
            <div className="hidden sm:flex flex-col leading-tight min-w-0">
              <span className="text-sm font-medium text-white truncate">{date}</span>
              <span className="text-xs text-[#A0A0A0] tabular-nums">{time}</span>
            </div>
            <div className="sm:hidden flex flex-col leading-tight min-w-0">
              <span className="text-xs text-[#A0A0A0] tabular-nums">{time}</span>
            </div>
          </div>

          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 bg-[#1A1A1A] rounded-full border border-[#2A2A2A] hover:border-[#6A00FF]/50 transition-colors"
            >
              <Avatar />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-white leading-tight">
                  {user?.firstName || 'User'}
                </p>
                <p className="text-xs text-[#A0A0A0] capitalize">{user?.userType || 'customer'}</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-[#A0A0A0] transition-transform ${profileOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {profileOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#2A2A2A] bg-[#121212] shadow-xl overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-[#2A2A2A]">
                  <p className="text-sm font-semibold truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-[#888] truncate">{user?.email || user?.phone}</p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-[#E0E0E0] hover:bg-[#1A1A1A]"
                  onClick={() => go('/profile')}
                >
                  <User size={16} /> Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-[#E0E0E0] hover:bg-[#1A1A1A]"
                  onClick={() => go('/settings')}
                >
                  <Settings size={16} /> Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={uploading}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-[#E0E0E0] hover:bg-[#1A1A1A] disabled:opacity-50"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera size={16} /> {uploading ? 'Uploading…' : 'Upload profile photo'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-[#FF3B5C] hover:bg-[#1A1A1A] border-t border-[#2A2A2A]"
                  onClick={handleLogout}
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarSelected}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
