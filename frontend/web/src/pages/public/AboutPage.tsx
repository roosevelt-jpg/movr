import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

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
    return <CmsUnavailable title="About page unpublished" />;
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="about" />
    </div>
  );
}
