import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** Onboarding — CMS slug `onboarding`. */
export default function OnboardingIntroPage() {
  const { page, loading, error } = useCmsPage('onboarding');

  if (loading) {
    return <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">Loading…</div>;
  }
  if (error || !page) {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">
        Onboarding content not published in CMS
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <CmsSections sections={page.sections} />
    </div>
  );
}
