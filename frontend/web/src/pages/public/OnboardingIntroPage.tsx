import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

/** Onboarding intro — CMS slug `onboarding`. */
export default function OnboardingIntroPage() {
  const navigate = useNavigate();
  const { page, loading, error } = useCmsPage('onboarding');

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>
    );
  }

  if (error || !page?.sections?.length) {
    return (
      <div className="min-h-screen bg-surface">
        <CmsUnavailable title="Onboarding unpublished" />
      </div>
    );
  }

  const slides = page.sections.find((s) => s.type === 'onboarding_slides');
  const ctaHref = slides?.payload?.cta?.href || '/register';
  const ctaLabel = slides?.payload?.cta?.label || 'Get started';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" data-force-dark>
      <div className="flex-1">
        <CmsSections sections={page.sections} pageSlug="onboarding" />
      </div>
      <div className="px-6 pb-10 max-w-md mx-auto w-full space-y-3">
        <button
          type="button"
          className="w-full rounded-2xl py-3.5 font-extrabold bg-movr-gradient"
          onClick={() => navigate(ctaHref.startsWith('/') ? ctaHref : '/register')}
        >
          {ctaLabel}
        </button>
        <button
          type="button"
          className="w-full text-center text-sm text-white/60 font-semibold"
          onClick={() => navigate('/login')}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
