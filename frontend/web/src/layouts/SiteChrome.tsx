import React from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import SiteBranding from '../components/SiteBranding';
import LiveChatWidget from '../components/LiveChatWidget';
import { useAutoLocale } from '../hooks/useAutoLocale';
import { useLocaleStore } from '../store/locale.store';

/**
 * Root chrome — every route inherits global header + footer.
 * Auto-detects country → currency + language for booking and display.
 */
export default function SiteChrome() {
  useAutoLocale();
  const dir = useLocaleStore((s) => s.dir);
  const language = useLocaleStore((s) => s.language);

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col bg-surface text-text-primary font-[Poppins,Montserrat,sans-serif]"
      lang={language}
      dir={dir}
    >
      <SiteBranding />
      <SiteHeader />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
      <SiteFooter />
      <LiveChatWidget />
    </div>
  );
}
