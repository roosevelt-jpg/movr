import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

/** Public service marketing page — CMS-editable (Ride, Shop, Deliver, Rentals). */
export default function ServiceLandingPage({
  slug,
  fallbackTitle,
}: {
  slug: string;
  fallbackTitle: string;
}) {
  const { page, loading, error } = useCmsPage(slug);

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page?.sections?.length) {
    return <CmsUnavailable title={`${fallbackTitle} page unpublished`} />;
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug={slug} />
    </div>
  );
}
