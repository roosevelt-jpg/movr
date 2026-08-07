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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>
    );
  }

  if (error || !cat) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3">
        <p>{error || 'Article not found'}</p>
        <button type="button" onClick={() => navigate('/help')} className="text-[#6B8AFF]">
          Back to help
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="px-6 pt-6 pb-5 border-b border-white/15">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/help')} className="text-sm text-white/55">
            ← Help
          </button>
          <button type="button" onClick={() => navigate('/')} className="text-xl font-bold">
            Movr
          </button>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">{cat.title}</h1>
        <div className="space-y-8">
          {(cat.articles || []).map((a: any) => (
            <section key={a.slug}>
              <h2 className="text-lg font-semibold mb-2">{a.title}</h2>
              <p className="text-white/60 leading-relaxed whitespace-pre-wrap">{a.body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
