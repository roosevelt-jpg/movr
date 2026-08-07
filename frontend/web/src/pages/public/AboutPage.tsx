import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** About page — CMS slug `about`. */
export default function AboutPage() {
  const { page, loading, error } = useCmsPage('about');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary mkt-shell py-20">
        <p className="mkt-eyebrow">About Movr</p>
        <h1 className="mkt-display mt-4">Move. Shop. Deliver.</h1>
        <p className="mt-6 text-white/60 max-w-2xl leading-relaxed">
          We connect riders, drivers, and merchants across African cities on one platform.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="about" />
    </div>
  );
}
