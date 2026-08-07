import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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

/** Terms / Privacy — live from legal_documents; matches Terms mockup. */
export default function TermsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const slug = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  const [doc, setDoc] = useState<Doc>(slug === 'terms' ? TERMS_FALLBACK : { ...TERMS_FALLBACK, title: 'Privacy Policy', sections: [] });
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

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="px-6 pt-6 pb-5">
        <button type="button" onClick={() => navigate('/')} className="text-xl font-bold tracking-tight">
          Movr
        </button>
      </header>
      <div className="h-px w-full bg-white/15" />

      <main className="max-w-3xl mx-auto px-6 pt-10 pb-24">
        {loading && !doc.sections.length ? (
          <p className="text-white/50">Loading…</p>
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{doc.title}</h1>
            {doc.updated_label ? (
              <p className="text-white/50 mt-3 mb-10">{doc.updated_label}</p>
            ) : (
              <div className="mb-10" />
            )}
            <ol className="space-y-6 list-none">
              {doc.sections.map((s) => (
                <li key={s.section_number} className="text-white leading-relaxed">
                  <span className="font-bold">
                    {s.section_number}. {s.title}
                  </span>
                  <span className="font-normal"> — {s.body}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}
