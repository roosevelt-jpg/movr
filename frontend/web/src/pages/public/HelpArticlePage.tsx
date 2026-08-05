import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

/** Help article — CMS slug `help-{id}`. */
export default function HelpArticlePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const slug = `help-${id || 'ride'}`;
  const { page, loading, error } = useCmsPage(slug);

  if (loading) {
    return <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">Loading…</div>;
  }
  if (error || !page) {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white flex flex-col items-center justify-center gap-3">
        <p>Article not found</p>
        <button type="button" onClick={() => navigate('/help')} className="text-motion-blue">
          Back to help
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <button type="button" onClick={() => navigate('/help')} className="text-sm text-text-secondary">
            ← Help
          </button>
        </div>
      </header>
      <CmsSections sections={page.sections} />
      <SiteFooter />
    </div>
  );
}
