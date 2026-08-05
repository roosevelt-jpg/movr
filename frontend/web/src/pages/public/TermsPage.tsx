import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** Terms / Privacy — CMS slugs `terms` | `privacy`. */
export default function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const slug = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  const { page, loading, error } = useCmsPage(slug);

  if (loading) {
    return <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">Loading…</div>;
  }
  if (error || !page) {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">
        Legal page not published in CMS
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <button type="button" onClick={() => navigate('/')} className="text-xl font-bold">
            Movr
          </button>
        </div>
      </header>
      <CmsSections sections={page.sections} />
      <SiteFooter />
    </div>
  );
}
