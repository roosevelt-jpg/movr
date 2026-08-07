import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

const API = import.meta.env.VITE_API_URL || '/api/v1';

type Section = { section_number: number; title: string; body: string };

type Doc = {
  title: string;
  updated_label: string;
  sections: Section[];
};

const TERMS_FALLBACK: Doc = {
  title: 'Terms of Service',
  updated_label: 'Last updated July 2026',
  sections: [
    {
      section_number: 1,
      title: 'Introduction',
      body: 'these terms govern your use of the Movr platform across ride, shop, deliver, and rental services.',
    },
    {
      section_number: 2,
      title: 'Eligibility',
      body: 'you must be verified to use certain features including payments and driving.',
    },
    {
      section_number: 3,
      title: 'Payments',
      body: 'transactions are processed through our payment partners in accordance with local regulations.',
    },
  ],
};

/** Terms / Privacy — prefer CMS page, then legal_documents API. */
export default function TermsPage() {
  const location = useLocation();
  const slug = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  const { page, loading: cmsLoading } = useCmsPage(slug);
  const [doc, setDoc] = useState<Doc>(
    slug === 'terms' ? TERMS_FALLBACK : { ...TERMS_FALLBACK, title: 'Privacy Policy', sections: [] }
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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
      .catch(() => undefined)
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
