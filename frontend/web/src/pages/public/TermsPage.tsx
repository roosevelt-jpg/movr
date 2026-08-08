import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

const API = import.meta.env.VITE_API_URL || '/api/v1';

type Section = { section_number: number; title: string; body: string };

type Doc = {
  title: string;
  updated_label: string;
  sections: Section[];
};

/** Terms / Privacy — CMS first, then live legal_documents API (no hardcoded legal copy). */
export default function TermsPage() {
  const location = useLocation();
  const slug = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  const { page, loading: cmsLoading } = useCmsPage(slug);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setDoc(null);
    fetch(`${API}/public/legal/${slug}`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) {
          setDoc({
            title: body.data.title,
            updated_label: body.data.updated_label || '',
            sections: body.data.sections || [],
          });
        }
      })
      .catch(() => setError('Could not load legal document'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (cmsLoading || loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary">
        <CmsSections sections={page.sections} pageSlug={slug} />
      </div>
    );
  }

  if (!doc?.sections?.length) {
    return (
      <CmsUnavailable
        title={slug === 'privacy' ? 'Privacy policy unpublished' : 'Terms unpublished'}
        message={error || 'Publish this page in CMS or add a legal document via the API.'}
      />
    );
  }

  return (
    <div className="bg-surface text-text-primary">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold">{doc.title}</h1>
        {doc.updated_label ? (
          <p className="text-white/50 mt-3 mb-10">{doc.updated_label}</p>
        ) : (
          <div className="mb-10" />
        )}
        <ol className="space-y-6 text-white/70 leading-relaxed list-none">
          {doc.sections.map((c) => (
            <li key={c.section_number}>
              <span className="text-white font-medium">
                {c.section_number}. {c.title}
              </span>{' '}
              — {c.body}
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
