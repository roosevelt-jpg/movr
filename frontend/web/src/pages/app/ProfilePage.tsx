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
      className="w-full flex items-center gap-3 py-4 border-b border-[#2A2A2A] text-left"
    >
      <Icon size={18} className="text-white" />
      <span className="flex-1 font-medium">{label}</span>
      {value ? (
        <span className="text-[#8E8E93] text-sm">{value}</span>
      ) : (
        <ChevronRight size={18} className="text-[#8E8E93]" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] p-6 md:p-8 max-w-xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full bg-[#2A2A2A]" />
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-[#888] mt-1">{phone}</p>
        </div>
      </div>

      <p className="text-xs tracking-wider text-[#8E8E93] mb-2">ACCOUNT</p>
      <div className="mb-8">
        <Row icon={Pencil} label="Edit profile" onClick={() => navigate('/settings')} />
        <Row
          icon={Bell}
          label="Notifications"
          value={notifications}
          onClick={() => navigate('/settings/notifications')}
        />
        <Row icon={Globe} label="Language & region" value="English, Ghana" />
      </div>

      <p className="text-xs tracking-wider text-[#8E8E93] mb-2">SUPPORT</p>
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
        className="w-full text-center text-[#E57373] font-semibold"
      >
        Sign out
      </button>
    </div>
  );
};

export default ProfilePage;
