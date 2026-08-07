import React from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import LiveChatWidget from '../components/LiveChatWidget';

/**
 * Root chrome — every route inherits global header + footer.
 * Canvas and chrome follow the visitor theme preference (light/dark).
 * Live chat widget escalates beyond AI to human agents.
 */
export default function SiteChrome() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-surface text-text-primary font-[Poppins,Montserrat,sans-serif]">
      <SiteHeader />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
      <SiteFooter />
      <LiveChatWidget />
    </div>
  );
}
