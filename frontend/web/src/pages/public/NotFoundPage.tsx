import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

/** 404 — CMS slug `not-found`. */
export default function NotFoundPage() {
  const { page, loading, error } = useCmsPage('not-found');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page?.sections?.length) {
    return <CmsUnavailable title="Page not found" message="This page does not exist or is unpublished." />;
  }

  return (
    <div className="flex-1 bg-surface text-text-primary py-12">
      <CmsSections sections={page.sections} pageSlug="not-found" />
    </div>
  );
}
