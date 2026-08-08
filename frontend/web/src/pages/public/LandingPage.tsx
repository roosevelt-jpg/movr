import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

/** Homepage — CMS slug `home` only (no hardcoded marketing fallback). */
const LandingPage: React.FC = () => {
  const { page, loading, error } = useCmsPage('home');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page?.sections?.length) {
    return (
      <CmsUnavailable
        title="Home content unpublished"
        message="Publish the home page in Site content (CMS) to show the marketing site."
      />
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="home" />
    </div>
  );
};

export default LandingPage;
