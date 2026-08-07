import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  Pencil,
  Bell,
  Globe,
  HelpCircle,
  Shield,
  ChevronRight,
} from 'lucide-react';

/** Profile settings — ACCOUNT + SUPPORT + Sign out (mockup). */
const ProfilePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState('On');
  const name = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Ama Konadu'
    : 'Ama Konadu';
  const phone = user?.phone || '+233 24 000 0000';

  const Row = ({
    icon: Icon,
    label,
    value,
    onClick,
  }: {
    icon: any;
    label: string;
    value?: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 py-4 border-b border-border text-left"
    >
      <Icon size={18} className="text-pure-white" />
      <span className="flex-1 font-medium">{label}</span>
      {value ? (
        <span className="text-text-secondary text-sm">{value}</span>
      ) : (
        <ChevronRight size={18} className="text-text-secondary" />
      )}
    </button>
  );

  return (
    <div className="min-h-[70vh] bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif] p-4 sm:p-6 md:p-8 max-w-xl mx-auto w-full" data-force-dark>
      <div className="flex items-center gap-4 mb-8">
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-16 h-16 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-movr-gradient flex items-center justify-center text-2xl font-bold">
            {(user?.firstName?.[0] || 'U').toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-text-secondary mt-1">{phone}</p>
        </div>
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">ACCOUNT</p>
      <div className="mb-8">
        <Row icon={Pencil} label="Edit profile" onClick={() => navigate('/profile/edit')} />
        <Row
          icon={Bell}
          label="Notifications"
          value={notifications}
          onClick={() => navigate('/settings/notifications')}
        />
        <Row
          icon={Globe}
          label="Language & region"
          value={
            user?.country
              ? `English, ${user.country === 'GH' ? 'Ghana' : user.country}`
              : 'English, Ghana'
          }
          onClick={() => navigate('/profile/edit')}
        />
      </div>

      <p className="text-xs tracking-wider text-text-secondary mb-2">SUPPORT</p>
      <div className="mb-10">
        <Row icon={HelpCircle} label="Help centre" onClick={() => navigate('/help')} />
        <Row icon={Shield} label="Chat with support" onClick={() => navigate('/support')} />
      </div>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/login');
        }}
        className="w-full text-center text-error font-semibold"
      >
        Sign out
      </button>
    </div>
  );
};

export default ProfilePage;
