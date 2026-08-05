import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** Offline — CMS slug `no-connection`. */
export default function NoConnectionPage() {
  const { page, loading } = useCmsPage('no-connection');
  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>;
  }
  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <CmsSections sections={page?.sections} />
    </div>
  );
}
