import React from 'react';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsNav, CmsSections } from '../../cms/sections';

/** Download page — CMS slug `download`. */
export default function DownloadAppPage() {
  const { page, loading, error } = useCmsPage('download');
  const global = useCmsPage('global');
  const nav = global.section('nav');

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  }
  if (error || !page) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Download page not published in CMS
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
}
