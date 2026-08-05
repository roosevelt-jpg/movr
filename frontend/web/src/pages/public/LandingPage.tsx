import React from 'react';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsNav, CmsSections } from '../../cms/sections';

/** Homepage — all copy/media from CMS (`home` + `global` nav). */
const LandingPage: React.FC = () => {
  const { page, loading, error } = useCmsPage('home');
  const global = useCmsPage('global');
  const nav = global.section('nav');

  if (loading || global.loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-xl font-bold">Homepage content not published</p>
        <p className="text-[#A0A0A0] text-sm max-w-md">
          Seed the CMS from Admin → Site content, or run{' '}
          <code className="text-white">pnpm --filter @movr/backend run db:seed-cms</code>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      {nav ? <CmsNav payload={nav.payload} /> : null}
      <CmsSections sections={page.sections} />
      <SiteFooter />
    </div>
  );
};

export default LandingPage;
