import React from 'react';
import { useLocation } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

/** Map pretty URLs → CMS slugs (Admin → Site content). */
const PATH_SLUG: Record<string, string> = {
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/cookies': 'cookies',
  '/delete-account': 'delete-account',
  '/data-safety': 'data-safety',
  '/app-permissions': 'app-permissions',
  '/play-store-listing': 'play-store-listing',
  '/refund-policy': 'refund-policy',
  '/community-guidelines': 'community-guidelines',
  '/child-safety': 'child-safety',
  '/driver-terms': 'driver-terms',
  '/support': 'support',
  '/contact': 'contact',
};

/**
 * Legal / Play Store / support pages — content from CMS (editable in admin).
 */
export default function LegalCmsPage({ slug: slugProp }: { slug?: string }) {
  const location = useLocation();
  const slug =
    slugProp ||
    PATH_SLUG[location.pathname] ||
    location.pathname.replace(/^\//, '').split('/')[0] ||
    'terms';
  const { page, loading, error } = useCmsPage(slug);

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (!page?.sections?.length) {
    return (
      <CmsUnavailable
        title={`${slug} unpublished`}
        message={
          error ||
          'Publish this page in Admin → Site content (Ensure defaults), or open /pages/' + slug
        }
      />
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug={slug} />
    </div>
  );
}
