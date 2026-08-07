import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** 404 — CMS slug `not-found`; SiteChrome supplies header/footer. */
export default function NotFoundPage() {
  const { page, loading } = useCmsPage('not-found');
  if (loading) {
    return (
      <div className="flex-1 bg-jet-black text-pure-white flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }
  return (
    <div className="flex-1 bg-jet-black text-pure-white py-12">
      <CmsSections sections={page?.sections} />
    </div>
  );
}
