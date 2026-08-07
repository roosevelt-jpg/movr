import React from 'react';
import { Link } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { BrandHeroBanner } from '../../brand/BrandHeroBanner';
import { BRAND } from '../../brand/assets';

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
      <div className="bg-surface text-text-primary">
        <BrandHeroBanner
          imageUrl={BRAND.rideSedan}
          eyebrow="About Movr"
          headline="Move. Shop. Deliver."
          subhead="We connect riders, drivers, and merchants across African cities on one platform."
        >
          <Link to="/download" className="mkt-btn-primary inline-flex">
            Get the app
          </Link>
        </BrandHeroBanner>
      </div>
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="about" />
    </div>
  );
}
