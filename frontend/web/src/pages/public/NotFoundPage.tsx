import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** 404 — CMS slug `not-found`. */
export default function NotFoundPage() {
  const { page, loading } = useCmsPage('not-found');
  if (loading) {
    return <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">Loading…</div>;
  }
  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <CmsSections sections={page?.sections} />
    </div>
  );
}
