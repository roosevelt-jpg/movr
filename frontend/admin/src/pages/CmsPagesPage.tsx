import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type Section = {
  id?: string;
  type: string;
  sortOrder?: number;
  enabled?: boolean;
  payload: Record<string, any>;
};

function Field({
  label,
  value,
  onChange,
  multiline,
  rows = 3,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {multiline ? (
        <textarea
          style={styles.textarea}
          value={value ?? ''}
          rows={rows}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={styles.input}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function LinkRows({
  items,
  onChange,
  disabled,
  title = 'Links',
}: {
  items: Array<{ label?: string; href?: string }>;
  onChange: (next: Array<{ label: string; href: string }>) => void;
  disabled?: boolean;
  title?: string;
}) {
  const rows = items?.length ? items : [{ label: '', href: '' }];
  return (
    <div style={styles.group}>
      <p style={styles.groupTitle}>{title}</p>
      {rows.map((row, i) => (
        <div key={i} style={styles.row2}>
          <Field
            label="Label"
            value={row.label || ''}
            disabled={disabled}
            onChange={(v) => {
              const next = rows.map((r, idx) =>
                idx === i ? { label: v, href: r.href || '' } : { label: r.label || '', href: r.href || '' }
              );
              onChange(next);
            }}
          />
          <Field
            label="Link"
            value={row.href || ''}
            disabled={disabled}
            onChange={(v) => {
              const next = rows.map((r, idx) =>
                idx === i ? { label: r.label || '', href: v } : { label: r.label || '', href: r.href || '' }
              );
              onChange(next);
            }}
          />
          <button
            type="button"
            style={styles.smallDanger}
            disabled={disabled || rows.length <= 1}
            onClick={() => onChange(rows.filter((_, idx) => idx !== i).map((r) => ({ label: r.label || '', href: r.href || '' })))}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        style={styles.smallGhost}
        disabled={disabled}
        onClick={() => onChange([...rows.map((r) => ({ label: r.label || '', href: r.href || '' })), { label: '', href: '' }])}
      >
        + Add link
      </button>
    </div>
  );
}

function SectionEditor({
  section,
  onChange,
  disabled,
}: {
  section: Section;
  onChange: (payload: Record<string, any>) => void;
  disabled?: boolean;
}) {
  const p = section.payload || {};
  const set = (patch: Record<string, any>) => onChange({ ...p, ...patch });

  switch (section.type) {
    case 'nav':
      return (
        <>
          <Field label="Brand name" value={p.brand || ''} disabled={disabled} onChange={(v) => set({ brand: v })} />
          <LinkRows items={p.links || []} disabled={disabled} onChange={(links) => set({ links })} title="Nav links" />
          <div style={styles.row2}>
            <Field
              label="CTA label"
              value={p.cta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ cta: { ...(p.cta || {}), label: v } })}
            />
            <Field
              label="CTA link"
              value={p.cta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ cta: { ...(p.cta || {}), href: v } })}
            />
          </div>
        </>
      );

    case 'hero':
      return (
        <>
          <Field label="Headline" value={p.headline || ''} disabled={disabled} onChange={(v) => set({ headline: v })} />
          <Field
            label="Supporting text"
            value={p.subhead || ''}
            multiline
            disabled={disabled}
            onChange={(v) => set({ subhead: v })}
          />
          <div style={styles.row2}>
            <Field
              label="Primary button label"
              value={p.primaryCta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ primaryCta: { ...(p.primaryCta || {}), label: v } })}
            />
            <Field
              label="Primary button link"
              value={p.primaryCta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ primaryCta: { ...(p.primaryCta || {}), href: v } })}
            />
          </div>
          <div style={styles.row2}>
            <Field
              label="Secondary button label"
              value={p.secondaryCta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), label: v } })}
            />
            <Field
              label="Secondary button link"
              value={p.secondaryCta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), href: v } })}
            />
          </div>
          <LinkRows
            items={p.storeButtons || []}
            disabled={disabled}
            title="Store buttons (optional)"
            onChange={(storeButtons) => set({ storeButtons })}
          />
        </>
      );

    case 'four_ways':
    case 'feature_cards':
      return (
        <>
          {section.type === 'four_ways' ? (
            <Field
              label="Section heading"
              value={p.heading || ''}
              disabled={disabled}
              onChange={(v) => set({ heading: v })}
            />
          ) : null}
          {(p.items || [{ title: '', body: '' }]).map((item: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Card {i + 1}</p>
              <Field
                label="Title"
                value={item.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const items = [...(p.items || [])];
                  items[i] = { ...item, title: v };
                  set({ items });
                }}
              />
              <Field
                label="Description"
                value={item.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const items = [...(p.items || [])];
                  items[i] = { ...item, body: v };
                  set({ items });
                }}
              />
            </div>
          ))}
        </>
      );

    case 'stories':
      return (
        <>
          <Field
            label="Section heading"
            value={p.heading || ''}
            disabled={disabled}
            onChange={(v) => set({ heading: v })}
          />
          {(p.cards || []).map((card: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Story {i + 1}</p>
              <Field
                label="Eyebrow"
                value={card.eyebrow || ''}
                disabled={disabled}
                onChange={(v) => {
                  const cards = [...(p.cards || [])];
                  cards[i] = { ...card, eyebrow: v };
                  set({ cards });
                }}
              />
              <Field
                label="Title"
                value={card.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const cards = [...(p.cards || [])];
                  cards[i] = { ...card, title: v };
                  set({ cards });
                }}
              />
              <Field
                label="Quote"
                value={card.quote || ''}
                multiline
                rows={4}
                disabled={disabled}
                onChange={(v) => {
                  const cards = [...(p.cards || [])];
                  cards[i] = { ...card, quote: v };
                  set({ cards });
                }}
              />
              <Field
                label="Image URL"
                value={card.imageUrl || ''}
                disabled={disabled}
                onChange={(v) => {
                  const cards = [...(p.cards || [])];
                  cards[i] = { ...card, imageUrl: v };
                  set({ cards });
                }}
              />
              {(card.stats || []).map((stat: any, si: number) => (
                <div key={si} style={styles.row2}>
                  <Field
                    label={`Stat ${si + 1} value`}
                    value={stat.value || ''}
                    disabled={disabled}
                    onChange={(v) => {
                      const cards = [...(p.cards || [])];
                      const stats = [...(card.stats || [])];
                      stats[si] = { ...stat, value: v };
                      cards[i] = { ...card, stats };
                      set({ cards });
                    }}
                  />
                  <Field
                    label={`Stat ${si + 1} label`}
                    value={stat.label || ''}
                    disabled={disabled}
                    onChange={(v) => {
                      const cards = [...(p.cards || [])];
                      const stats = [...(card.stats || [])];
                      stats[si] = { ...stat, label: v };
                      cards[i] = { ...card, stats };
                      set({ cards });
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </>
      );

    case 'cta_banner':
      return (
        <>
          <Field label="Banner text" value={p.body || ''} multiline rows={4} disabled={disabled} onChange={(v) => set({ body: v })} />
          <div style={styles.row2}>
            <Field
              label="Button label"
              value={p.button?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ button: { ...(p.button || {}), label: v } })}
            />
            <Field
              label="Button link"
              value={p.button?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ button: { ...(p.button || {}), href: v } })}
            />
          </div>
        </>
      );

    case 'download':
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <Field label="Body" value={p.body || ''} multiline disabled={disabled} onChange={(v) => set({ body: v })} />
          <Field label="QR hint" value={p.qrHint || ''} disabled={disabled} onChange={(v) => set({ qrHint: v })} />
          <LinkRows
            items={p.storeButtons || []}
            disabled={disabled}
            title="Store buttons"
            onChange={(storeButtons) => set({ storeButtons })}
          />
        </>
      );

    case 'footer':
      return (
        <>
          <Field label="Brand" value={p.brand || ''} disabled={disabled} onChange={(v) => set({ brand: v })} />
          <Field label="Tagline" value={p.tagline || ''} multiline disabled={disabled} onChange={(v) => set({ tagline: v })} />
          <Field
            label="Copyright"
            value={p.copyright || ''}
            disabled={disabled}
            onChange={(v) => set({ copyright: v })}
          />
          {(p.columns || []).map((col: any, i: number) => (
            <div key={i} style={styles.card}>
              <Field
                label={`Column ${i + 1} title`}
                value={col.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const columns = [...(p.columns || [])];
                  columns[i] = { ...col, title: v };
                  set({ columns });
                }}
              />
              <LinkRows
                items={col.links || []}
                disabled={disabled}
                title="Column links"
                onChange={(links) => {
                  const columns = [...(p.columns || [])];
                  columns[i] = { ...col, links };
                  set({ columns });
                }}
              />
            </div>
          ))}
          <LinkRows
            items={p.appButtons || []}
            disabled={disabled}
            title="App buttons"
            onChange={(appButtons) => set({ appButtons })}
          />
          <LinkRows
            items={p.legalLinks || []}
            disabled={disabled}
            title="Legal links"
            onChange={(legalLinks) => set({ legalLinks })}
          />
        </>
      );

    case 'help_hub':
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <Field
            label="Search placeholder"
            value={p.searchPlaceholder || ''}
            disabled={disabled}
            onChange={(v) => set({ searchPlaceholder: v })}
          />
          {(p.articles || []).map((a: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Article {i + 1}</p>
              <Field
                label="Title"
                value={a.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const articles = [...(p.articles || [])];
                  articles[i] = { ...a, title: v };
                  set({ articles });
                }}
              />
              <Field
                label="Description"
                value={a.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const articles = [...(p.articles || [])];
                  articles[i] = { ...a, body: v };
                  set({ articles });
                }}
              />
            </div>
          ))}
        </>
      );

    case 'rich_text':
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <Field
            label="Paragraphs (one per line)"
            value={(p.paragraphs || []).join('\n')}
            multiline
            rows={8}
            disabled={disabled}
            onChange={(v) =>
              set({
                paragraphs: v
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
        </>
      );

    case 'legal':
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <Field
            label="Updated label"
            value={p.updatedLabel || ''}
            disabled={disabled}
            onChange={(v) => set({ updatedLabel: v })}
          />
          {(p.clauses || []).map((c: any, i: number) => (
            <div key={i} style={styles.card}>
              <Field
                label={`Clause ${i + 1} title`}
                value={c.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const clauses = [...(p.clauses || [])];
                  clauses[i] = { ...c, title: v };
                  set({ clauses });
                }}
              />
              <Field
                label={`Clause ${i + 1} body`}
                value={c.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const clauses = [...(p.clauses || [])];
                  clauses[i] = { ...c, body: v };
                  set({ clauses });
                }}
              />
            </div>
          ))}
        </>
      );

    case 'onboarding_slides':
      return (
        <>
          {(p.slides || []).map((s: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Slide {i + 1}</p>
              <Field
                label="Title"
                value={s.title || ''}
                disabled={disabled}
                onChange={(v) => {
                  const slides = [...(p.slides || [])];
                  slides[i] = { ...s, title: v };
                  set({ slides });
                }}
              />
              <Field
                label="Body"
                value={s.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const slides = [...(p.slides || [])];
                  slides[i] = { ...s, body: v };
                  set({ slides });
                }}
              />
            </div>
          ))}
          <div style={styles.row2}>
            <Field
              label="Final CTA label"
              value={p.cta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ cta: { ...(p.cta || {}), label: v } })}
            />
            <Field
              label="Final CTA link"
              value={p.cta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ cta: { ...(p.cta || {}), href: v } })}
            />
          </div>
        </>
      );

    default:
      return (
        <p style={styles.hint}>
          This section type ({section.type}) uses structured fields only. No HTML editing.
        </p>
      );
  }
}

const TYPE_LABELS: Record<string, string> = {
  nav: 'Navigation',
  hero: 'Hero',
  four_ways: 'Four ways',
  stories: 'Stories',
  cta_banner: 'CTA banner',
  download: 'Download',
  feature_cards: 'Feature cards',
  help_hub: 'Help hub',
  rich_text: 'Text',
  legal: 'Legal',
  footer: 'Footer',
  onboarding_slides: 'Onboarding',
};

/** Admin CMS — plain-text fields only (no HTML / no raw JSON). */
export default function CmsPagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [slug, setSlug] = useState('home');
  const [pageTitle, setPageTitle] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = async () => {
    const res = await axios.get(`${API}/admin/cms/pages`, { headers: headers() });
    setPages(res.data.data || []);
    return res.data.data || [];
  };

  const loadPage = async (s: string) => {
    setError('');
    const res = await axios.get(`${API}/admin/cms/pages/${s}`, { headers: headers() });
    const data = res.data.data;
    setSlug(s);
    setPageTitle(data?.title || s);
    setSections(
      (data?.sections || []).map((sec: any, i: number) => ({
        id: sec.id,
        type: sec.type,
        sortOrder: sec.sortOrder ?? i,
        enabled: sec.enabled !== false,
        payload: sec.payload || {},
      }))
    );
  };

  const ensureDefaults = async () => {
    try {
      const res = await axios.post(`${API}/admin/cms/ensure-defaults`, {}, { headers: headers() });
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 404) {
        const res = await axios.post(`${API}/admin/cms/seed`, {}, { headers: headers() });
        return res.data;
      }
      throw e;
    }
  };

  const bootstrap = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const ensured = await ensureDefaults();
      setMessage(ensured?.message || 'Defaults ready');
      const list = await loadList();
      const next = list.find((p: any) => p.slug === slug)?.slug || list[0]?.slug || 'home';
      await loadPage(next);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message;
      setError(
        msg === 'Route not found'
          ? 'CMS API not loaded — restart the backend, then refresh.'
          : msg
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSectionPayload = (index: number, payload: Record<string, any>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, payload } : s)));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await axios.put(
        `${API}/admin/cms/pages/${slug}`,
        {
          title: pageTitle || slug,
          status: 'published',
          sections: sections.map((s, i) => ({
            type: s.type,
            sortOrder: s.sortOrder ?? i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        },
        { headers: headers() }
      );
      setMessage(`Saved & published “${slug}”`);
      await loadList();
      await loadPage(slug);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resetAll = async () => {
    if (!window.confirm('Reset ALL CMS pages to mockup defaults? This overwrites edits.')) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/admin/cms/seed`, {}, { headers: headers() });
      setMessage(res.data.message || 'Defaults restored');
      await loadList();
      await loadPage(slug);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell activeLabel="Site content">
      <p style={styles.intro}>
        Edit page copy as plain text. No HTML. Changes go live when you Save & publish.
      </p>

      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={slug}
          disabled={busy || pages.length === 0}
          onChange={(e) => loadPage(e.target.value).catch((err) => setError(err.message))}
        >
          {(pages.length ? pages : [{ slug: 'home', title: 'Homepage', status: '—' }]).map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.slug} — {p.title} ({p.status || '—'})
            </option>
          ))}
        </select>
        <button type="button" style={styles.btn} disabled={busy} onClick={save}>
          Save & publish
        </button>
        <button type="button" style={styles.ghost} disabled={busy} onClick={bootstrap}>
          Ensure defaults
        </button>
        <button type="button" style={styles.danger} disabled={busy} onClick={resetAll}>
          Reset to mockup
        </button>
      </div>

      {message ? <p style={{ color: '#9BE0A8' }}>{message}</p> : null}
      {error ? <p style={{ color: '#FF8FA0' }}>{error}</p> : null}

      <div style={styles.pageMeta}>
        <Field
          label="Page title"
          value={pageTitle}
          disabled={busy}
          onChange={setPageTitle}
        />
      </div>

      <div style={styles.sections}>
        {sections.length === 0 && !busy ? (
          <p style={styles.hint}>No sections on this page yet. Use Ensure defaults.</p>
        ) : null}
        {sections.map((section, index) => (
          <section key={section.id || `${section.type}-${index}`} style={styles.sectionCard}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionHeading}>
                {TYPE_LABELS[section.type] || section.type}
              </h3>
              <label style={styles.toggle}>
                <input
                  type="checkbox"
                  checked={section.enabled !== false}
                  disabled={busy}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s, i) => (i === index ? { ...s, enabled: e.target.checked } : s))
                    )
                  }
                />
                Visible
              </label>
            </div>
            <SectionEditor
              section={section}
              disabled={busy}
              onChange={(payload) => updateSectionPayload(index, payload)}
            />
          </section>
        ))}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  intro: { color: '#A0A0A0', fontSize: 14, marginBottom: 16, maxWidth: 720, lineHeight: 1.5 },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  select: {
    background: '#121212',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 280,
  },
  btn: {
    background: 'linear-gradient(90deg,#6A00FF,#0055FF)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  ghost: {
    background: '#1A1A1A',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
  },
  danger: {
    background: '#1A1A1A',
    color: '#FF8FA0',
    border: '1px solid #3A2A2A',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
  },
  hint: { color: '#8E8E93', fontSize: 13 },
  pageMeta: { marginBottom: 16, maxWidth: 480 },
  sections: { display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 },
  sectionCard: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    borderRadius: 16,
    padding: 20,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeading: { margin: 0, fontSize: 18, fontWeight: 700 },
  toggle: { display: 'flex', alignItems: 'center', gap: 8, color: '#A0A0A0', fontSize: 13 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, flex: 1 },
  label: { fontSize: 12, color: '#8E8E93', letterSpacing: 0.3 },
  input: {
    background: '#0A0A0A',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  textarea: {
    background: '#0A0A0A',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'Poppins, Montserrat, sans-serif',
    lineHeight: 1.5,
    resize: 'vertical',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' },
  group: { marginBottom: 12 },
  groupTitle: { color: '#C8C8C8', fontSize: 13, fontWeight: 600, marginBottom: 8 },
  card: {
    background: '#0A0A0A',
    border: '1px solid #1F1F1F',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: '#A0A0A0', fontSize: 12, marginBottom: 10, letterSpacing: 0.4 },
  smallGhost: {
    background: 'transparent',
    color: '#8FB3FF',
    border: '1px solid #2A2A2A',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  smallDanger: {
    background: 'transparent',
    color: '#FF8FA0',
    border: '1px solid #3A2A2A',
    borderRadius: 8,
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 12,
    marginBottom: 12,
  },
};
