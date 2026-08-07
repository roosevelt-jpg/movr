import React from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

/**
 * Root chrome — every route inherits global header + footer.
 * Nested layouts (Auth, App, Merchant) render inside <Outlet />.
 */
export default function SiteChrome() {
  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-jet-black text-text-primary font-[Poppins,Montserrat,sans-serif]">
      <SiteHeader />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
