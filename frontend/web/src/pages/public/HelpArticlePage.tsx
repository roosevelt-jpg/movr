import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/** Help category articles — live from help_articles. */
export default function HelpArticlePage() {
  const params = useParams();
  const topic = params.topic || params.id || 'ride';
  const navigate = useNavigate();
  const [cat, setCat] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/public/help/categories/${topic}`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data) {
          setCat(body.data);
          setError('');
        } else {
          setError(body?.message || 'Not found');
        }
      })
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [topic]);

  if (loading) {
    return (
      <div className="min-h-[50vh] bg-surface text-text-primary flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (error || !cat) {
    return (
      <div className="min-h-[50vh] bg-surface text-text-primary flex flex-col items-center justify-center gap-3">
        <p>{error || 'Article not found'}</p>
        <button type="button" onClick={() => navigate('/help')} className="text-brand-blue">
          Back to help
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface text-text-primary flex-1">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="text-sm text-text-secondary mb-6"
        >
          ← Help
        </button>
        <h1 className="text-3xl font-bold mb-8">{cat.title}</h1>
        <div className="space-y-8">
          {(cat.articles || []).map((a: any) => (
            <section key={a.slug}>
              <h2 className="text-lg font-semibold mb-2">{a.title}</h2>
              <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">{a.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
