import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  User,
  Lock,
  Bell,
  Trophy,
  MessageCircle,
  LogOut,
  ChevronRight,
  Gift,
  History,
  Shield,
  Settings,
  Tag,
} from 'lucide-react';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Profile — stats, ACCOUNT / REWARDS / SUPPORT (mockup). */
const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [name, setName] = useState(
    user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Traveler' : 'Traveler'
  );
  const [initials, setInitials] = useState('?');
  const [phone, setPhone] = useState(user?.phone || '');
  const [rides, setRides] = useState(0);
  const [rating, setRating] = useState(0);
  const [points, setPoints] = useState(0);
  const [unread, setUnread] = useState(0);
  const [trustScore, setTrustScore] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/users/me/profile`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const u = j?.data;
        if (!u) return;
        if (u.name) setName(u.name);
        if (u.initials) setInitials(u.initials);
        if (u.phone) setPhone(u.phone);
        if (u.stats) {
          setRides(Number(u.stats.rides ?? 0));
          setRating(Number(u.stats.rating ?? 0));
          setPoints(Number(u.stats.points ?? 0));
        }
        if (u.unreadNotifications != null) setUnread(Number(u.unreadNotifications));
      })
      .catch(() => undefined);
    fetch(`${API}/rails/trust-score`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setTrustScore(j?.data || null))
      .catch(() => undefined);
  }, []);

  const Row = ({
    icon: Icon,
    iconClass,
    label,
    badge,
    danger,
    onClick,
  }: {
    icon: any;
    iconClass?: string;
    label: string;
    badge?: number;
    danger?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-4 border-b border-zinc-800 text-left"
    >
      <Icon size={18} className={iconClass || 'text-zinc-400'} />
      <span className={`flex-1 font-medium ${danger ? 'text-red-500' : ''}`}>{label}</span>
      {badge != null && badge > 0 ? (
        <span className="min-w-[22px] h-[22px] rounded-full bg-purple-600 text-xs font-bold flex items-center justify-center px-1.5">
          {badge}
        </span>
      ) : (
        <ChevronRight size={18} className="text-zinc-600" />
      )}
    </button>
  );

  return (
    <div
      className="min-h-[70vh] bg-black text-white font-[Poppins,Montserrat,sans-serif] p-4 sm:p-6 md:p-8 max-w-xl mx-auto w-full"
      data-force-dark
    >
      <div className="flex flex-col items-center mb-6">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-2xl font-extrabold">
            {initials}
          </div>
        )}
        <h1 className="text-2xl font-bold mt-4">{name}</h1>
        <p className="text-zinc-400 mt-1">{phone}</p>
      </div>

      <div className="flex items-center justify-center mb-8">
        {[
          { v: rides, l: 'Rides' },
          { v: rating.toFixed(1), l: 'Rating' },
          { v: points, l: 'Points' },
          {
            v: trustScore?.score != null ? Number(trustScore.score).toFixed(0) : '—',
            l: 'Trust',
          },
        ].map((s, i) => (
          <React.Fragment key={s.l}>
            {i > 0 ? <div className="w-px h-7 bg-zinc-800 mx-2" /> : null}
            <div className="flex-1 text-center">
              <p className="text-xl font-extrabold">{s.v}</p>
              <p className="text-xs text-zinc-500 mt-1">{s.l}</p>
            </div>
          </React.Fragment>
        ))}
      </div>
      {trustScore?.kyc_boost ? (
        <p className="text-center text-xs text-emerald-400 mb-4">KYC verified · trust boost active</p>
      ) : null}

      <p className="text-xs tracking-wider text-zinc-500 mb-1">ACCOUNT</p>
      <div className="mb-6">
        <Row icon={User} iconClass="text-blue-400" label="Personal Info" onClick={() => navigate('/profile/edit')} />
        <Row icon={Settings} iconClass="text-zinc-400" label="Settings" onClick={() => navigate('/settings')} />
        <Row icon={Lock} iconClass="text-amber-400" label="Privacy & Security" onClick={() => navigate('/settings')} />
        <Row
          icon={Bell}
          iconClass="text-amber-400"
          label="Notifications"
          badge={unread}
          onClick={() => navigate('/settings/notifications')}
        />
      </div>

      <p className="text-xs tracking-wider text-zinc-500 mb-1">REWARDS</p>
      <div className="mb-6">
        <Row icon={Trophy} iconClass="text-amber-400" label="Rewards & Leaderboard" onClick={() => navigate('/rewards')} />
        <Row icon={Tag} iconClass="text-green-400" label="Deals & Promos" onClick={() => navigate('/deals')} />
        <Row icon={Gift} iconClass="text-purple-400" label="Refer & Earn" onClick={() => navigate('/refer')} />
      </div>

      <p className="text-xs tracking-wider text-zinc-500 mb-1">ACTIVITY</p>
      <div className="mb-6">
        <Row icon={History} iconClass="text-blue-400" label="Activity History" onClick={() => navigate('/history')} />
        <Row
          icon={Gift}
          iconClass="text-emerald-400"
          label="Family gifts & circles"
          onClick={() => navigate('/wallet/settlement?gifts=1')}
        />
        <Row icon={Shield} iconClass="text-red-400" label="Safety Center" onClick={() => navigate('/safety')} />
      </div>

      <p className="text-xs tracking-wider text-zinc-500 mb-1">SUPPORT</p>
      <div className="mb-4">
        <Row icon={MessageCircle} label="Help Center" onClick={() => navigate('/help')} />
        <Row
          icon={LogOut}
          iconClass="text-amber-700"
          label="Sign Out"
          danger
          onClick={() => {
            logout();
            navigate('/login');
          }}
        />
      </div>
    </div>
  );
};

export default ProfilePage;
