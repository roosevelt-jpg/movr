import React from 'react';
import { useParams } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** Public dynamic CMS page — /pages/:slug */
export default function DynamicCmsPage() {
  const { slug = '' } = useParams();
  const { page, loading, error } = useCmsPage(slug);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-text-secondary">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-text-secondary">
        Page not found
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] pb-16">
      <CmsSections sections={page.sections} pageSlug={slug} />
    </div>
  );
}
