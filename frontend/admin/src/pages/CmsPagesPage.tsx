import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import RichTextEditor from '../components/RichTextEditor';
import { MediaField } from '../components/CmsMediaField';

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
              label="Log in label"
              value={p.secondaryCta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), label: v } })}
            />
            <Field
              label="Log in link"
              value={p.secondaryCta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), href: v } })}
            />
          </div>
          <div style={styles.row2}>
            <Field
              label="Primary CTA label"
              value={p.cta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ cta: { ...(p.cta || {}), label: v } })}
            />
            <Field
              label="Primary CTA link"
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
          <Field label="Eyebrow" value={p.eyebrow || ''} disabled={disabled} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Headline" value={p.headline || ''} disabled={disabled} onChange={(v) => set({ headline: v })} />
          <Field
            label="Supporting text"
            value={p.subhead || ''}
            multiline
            disabled={disabled}
            onChange={(v) => set({ subhead: v })}
          />
          <label style={styles.field}>
            <span style={styles.label}>Layout</span>
            <select
              style={styles.input}
              value={p.layout || 'split'}
              disabled={disabled}
              onChange={(e) => set({ layout: e.target.value })}
            >
              <option value="split">Split (text + phone)</option>
              <option value="centered">Centered</option>
            </select>
          </label>
          <MediaField
            label="Background image or video"
            value={p.backgroundVideo || p.backgroundImage || ''}
            disabled={disabled}
            hint="Shown behind the hero. Video loops muted."
            onChange={(url) => {
              if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
                set({ backgroundVideo: url, backgroundImage: '' });
              } else {
                set({ backgroundImage: url, backgroundVideo: '' });
              }
            }}
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
              <MediaField
                label="Story image or video"
                value={card.videoUrl || card.imageUrl || ''}
                disabled={disabled}
                onChange={(url) => {
                  const cards = [...(p.cards || [])];
                  if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
                    cards[i] = { ...card, videoUrl: url };
                  } else {
                    cards[i] = { ...card, imageUrl: url, videoUrl: '' };
                  }
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
          <Field
            label="Headline"
            value={p.headline || ''}
            disabled={disabled}
            onChange={(v) => set({ headline: v })}
          />
          <Field label="Banner text" value={p.body || ''} multiline rows={4} disabled={disabled} onChange={(v) => set({ body: v })} />
          <Field label="Anchor id" value={p.anchor || ''} disabled={disabled} onChange={(v) => set({ anchor: v })} />
          <MediaField
            label="Banner background image or video"
            value={p.backgroundVideo || p.backgroundImage || ''}
            disabled={disabled}
            onChange={(url) => {
              if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
                set({ backgroundVideo: url, backgroundImage: '' });
              } else {
                set({ backgroundImage: url, backgroundVideo: '' });
              }
            }}
          />
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

    case 'rich_text': {
      const html =
        p.html ||
        (Array.isArray(p.paragraphs) && p.paragraphs.length
          ? p.paragraphs.map((line: string) => `<p>${String(line).replace(/</g, '&lt;')}</p>`).join('')
          : '');
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <label style={styles.field}>
            <span style={styles.label}>Body (rich text — bold, italic, colours, links)</span>
            <RichTextEditor
              value={html}
              disabled={disabled}
              onChange={(next) => set({ html: next, paragraphs: [] })}
            />
          </label>
        </>
      );
    }

    case 'form':
      return (
        <>
          <Field
            label="Form heading"
            value={p.heading || ''}
            disabled={disabled}
            onChange={(v) => set({ heading: v })}
          />
          <Field
            label="Form key"
            value={p.formKey || 'default'}
            disabled={disabled}
            onChange={(v) => set({ formKey: v })}
          />
          <Field
            label="Submit button label"
            value={p.submitLabel || 'Submit'}
            disabled={disabled}
            onChange={(v) => set({ submitLabel: v })}
          />
          <Field
            label="Success message"
            value={p.successMessage || ''}
            disabled={disabled}
            onChange={(v) => set({ successMessage: v })}
          />
          {(p.fields || []).map((f: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Field {i + 1}</p>
              <div style={styles.row2}>
                <Field
                  label="Name"
                  value={f.name || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const fields = [...(p.fields || [])];
                    fields[i] = { ...f, name: v };
                    set({ fields });
                  }}
                />
                <Field
                  label="Label"
                  value={f.label || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const fields = [...(p.fields || [])];
                    fields[i] = { ...f, label: v };
                    set({ fields });
                  }}
                />
              </div>
              <div style={styles.row2}>
                <label style={styles.field}>
                  <span style={styles.label}>Type</span>
                  <select
                    style={styles.input}
                    value={f.type || 'text'}
                    disabled={disabled}
                    onChange={(e) => {
                      const fields = [...(p.fields || [])];
                      fields[i] = { ...f, type: e.target.value };
                      set({ fields });
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="textarea">Textarea</option>
                  </select>
                </label>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    disabled={disabled}
                    onChange={(e) => {
                      const fields = [...(p.fields || [])];
                      fields[i] = { ...f, required: e.target.checked };
                      set({ fields });
                    }}
                  />
                  Required
                </label>
              </div>
              <button
                type="button"
                style={styles.smallDanger}
                disabled={disabled || (p.fields || []).length <= 1}
                onClick={() => set({ fields: (p.fields || []).filter((_: any, idx: number) => idx !== i) })}
              >
                Remove field
              </button>
            </div>
          ))}
          <button
            type="button"
            style={styles.smallGhost}
            disabled={disabled}
            onClick={() =>
              set({
                fields: [
                  ...(p.fields || []),
                  { name: `field_${(p.fields || []).length + 1}`, label: 'New field', type: 'text', required: false },
                ],
              })
            }
          >
            + Add field
          </button>
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
              <MediaField
                label="Slide image or video"
                value={s.mediaUrl || s.imageUrl || ''}
                disabled={disabled}
                onChange={(url) => {
                  const slides = [...(p.slides || [])];
                  slides[i] = { ...s, mediaUrl: url, imageUrl: url };
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

    case 'choice_hero':
      return (
        <>
          <Field label="Eyebrow" value={p.eyebrow || ''} disabled={disabled} onChange={(v) => set({ eyebrow: v })} />
          <Field
            label="Headline (use \\n for line breaks)"
            value={p.headline || ''}
            multiline
            disabled={disabled}
            onChange={(v) => set({ headline: v })}
          />
          <Field
            label="Supporting text"
            value={p.subhead || ''}
            multiline
            disabled={disabled}
            onChange={(v) => set({ subhead: v })}
          />
          <MediaField
            label="Background image or looping video"
            value={p.backgroundVideo || p.backgroundImage || ''}
            disabled={disabled}
            onChange={(url) => {
              if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
                set({ backgroundVideo: url, backgroundImage: '' });
              } else {
                set({ backgroundImage: url, backgroundVideo: '' });
              }
            }}
          />
          {(p.choices || [{ title: '', body: '', href: '', emoji: '' }]).map((c: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Choice card {i + 1}</p>
              <div style={styles.row2}>
                <Field
                  label="Emoji"
                  value={c.emoji || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const choices = [...(p.choices || [])];
                    choices[i] = { ...c, emoji: v };
                    set({ choices });
                  }}
                />
                <Field
                  label="Title"
                  value={c.title || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const choices = [...(p.choices || [])];
                    choices[i] = { ...c, title: v };
                    set({ choices });
                  }}
                />
              </div>
              <Field
                label="Body"
                value={c.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const choices = [...(p.choices || [])];
                  choices[i] = { ...c, body: v };
                  set({ choices });
                }}
              />
              <div style={styles.row2}>
                <Field
                  label="CTA label"
                  value={c.cta || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const choices = [...(p.choices || [])];
                    choices[i] = { ...c, cta: v };
                    set({ choices });
                  }}
                />
                <Field
                  label="Link"
                  value={c.href || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const choices = [...(p.choices || [])];
                    choices[i] = { ...c, href: v };
                    set({ choices });
                  }}
                />
              </div>
              <MediaField
                label="Card image (optional)"
                value={c.imageUrl || ''}
                disabled={disabled}
                accept="image/*"
                onChange={(url) => {
                  const choices = [...(p.choices || [])];
                  choices[i] = { ...c, imageUrl: url };
                  set({ choices });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            style={styles.smallGhost}
            disabled={disabled}
            onClick={() =>
              set({
                choices: [...(p.choices || []), { emoji: '•', title: '', body: '', cta: '', href: '' }],
              })
            }
          >
            + Add choice
          </button>
        </>
      );

    case 'trust_strip':
      return (
        <>
          <Field label="Label" value={p.label || ''} disabled={disabled} onChange={(v) => set({ label: v })} />
          <Field
            label="Items (one per line)"
            value={(p.items || []).map((x: any) => (typeof x === 'string' ? x : x.label)).join('\n')}
            multiline
            disabled={disabled}
            onChange={(v) =>
              set({
                items: v
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
          />
        </>
      );

    case 'how_it_works':
      return (
        <>
          <Field label="Eyebrow" value={p.eyebrow || ''} disabled={disabled} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          {(p.steps || [{ number: '01', title: '', body: '' }]).map((s: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Step {i + 1}</p>
              <div style={styles.row2}>
                <Field
                  label="Number"
                  value={s.number || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const steps = [...(p.steps || [])];
                    steps[i] = { ...s, number: v };
                    set({ steps });
                  }}
                />
                <Field
                  label="Title"
                  value={s.title || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const steps = [...(p.steps || [])];
                    steps[i] = { ...s, title: v };
                    set({ steps });
                  }}
                />
              </div>
              <Field
                label="Body"
                value={s.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const steps = [...(p.steps || [])];
                  steps[i] = { ...s, body: v };
                  set({ steps });
                }}
              />
              <MediaField
                label="Step image (optional)"
                value={s.imageUrl || ''}
                disabled={disabled}
                accept="image/*"
                onChange={(url) => {
                  const steps = [...(p.steps || [])];
                  steps[i] = { ...s, imageUrl: url };
                  set({ steps });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            style={styles.smallGhost}
            disabled={disabled}
            onClick={() =>
              set({
                steps: [
                  ...(p.steps || []),
                  { number: String((p.steps || []).length + 1).padStart(2, '0'), title: '', body: '' },
                ],
              })
            }
          >
            + Add step
          </button>
        </>
      );

    case 'product_grid':
    case 'why_grid':
      return (
        <>
          <Field label="Eyebrow" value={p.eyebrow || ''} disabled={disabled} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          {(p.items || [{ title: '', body: '' }]).map((item: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Item {i + 1}</p>
              {section.type === 'product_grid' ? (
                <Field
                  label="Eyebrow / category"
                  value={item.eyebrow || item.category || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const items = [...(p.items || [])];
                    items[i] = { ...item, eyebrow: v };
                    set({ items });
                  }}
                />
              ) : null}
              <Field
                label="Icon key (car, heart, package, key, store, wallet, shield…)"
                value={item.iconKey || ''}
                disabled={disabled}
                onChange={(v) => {
                  const items = [...(p.items || [])];
                  items[i] = { ...item, iconKey: v };
                  set({ items });
                }}
              />
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
                label="Body"
                value={item.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const items = [...(p.items || [])];
                  items[i] = { ...item, body: v };
                  set({ items });
                }}
              />
              {section.type === 'product_grid' ? (
                <div style={styles.row2}>
                  <Field
                    label="CTA label"
                    value={item.cta || ''}
                    disabled={disabled}
                    onChange={(v) => {
                      const items = [...(p.items || [])];
                      items[i] = { ...item, cta: v };
                      set({ items });
                    }}
                  />
                  <Field
                    label="Link"
                    value={item.href || ''}
                    disabled={disabled}
                    onChange={(v) => {
                      const items = [...(p.items || [])];
                      items[i] = { ...item, href: v };
                      set({ items });
                    }}
                  />
                </div>
              ) : null}
              <MediaField
                label="Image (optional)"
                value={item.imageUrl || ''}
                disabled={disabled}
                accept="image/*"
                onChange={(url) => {
                  const items = [...(p.items || [])];
                  items[i] = { ...item, imageUrl: url };
                  set({ items });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            style={styles.smallGhost}
            disabled={disabled}
            onClick={() => set({ items: [...(p.items || []), { title: '', body: '', iconKey: 'car' }] })}
          >
            + Add item
          </button>
        </>
      );

    case 'testimonials':
      return (
        <>
          <Field label="Eyebrow" value={p.eyebrow || ''} disabled={disabled} onChange={(v) => set({ eyebrow: v })} />
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          {(p.items || p.quotes || [{ quote: '', name: '', role: '' }]).map((q: any, i: number) => (
            <div key={i} style={styles.card}>
              <p style={styles.cardTitle}>Quote {i + 1}</p>
              <Field
                label="Quote"
                value={q.quote || q.body || ''}
                multiline
                disabled={disabled}
                onChange={(v) => {
                  const items = [...(p.items || p.quotes || [])];
                  items[i] = { ...q, quote: v };
                  set({ items });
                }}
              />
              <div style={styles.row2}>
                <Field
                  label="Name"
                  value={q.name || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const items = [...(p.items || p.quotes || [])];
                    items[i] = { ...q, name: v };
                    set({ items });
                  }}
                />
                <Field
                  label="Role"
                  value={q.role || ''}
                  disabled={disabled}
                  onChange={(v) => {
                    const items = [...(p.items || p.quotes || [])];
                    items[i] = { ...q, role: v };
                    set({ items });
                  }}
                />
              </div>
              <MediaField
                label="Avatar image (optional)"
                value={q.avatarUrl || q.imageUrl || ''}
                disabled={disabled}
                accept="image/*"
                onChange={(url) => {
                  const items = [...(p.items || p.quotes || [])];
                  items[i] = { ...q, avatarUrl: url };
                  set({ items });
                }}
              />
            </div>
          ))}
          <button
            type="button"
            style={styles.smallGhost}
            disabled={disabled}
            onClick={() => set({ items: [...(p.items || []), { quote: '', name: '', role: '' }] })}
          >
            + Add quote
          </button>
        </>
      );

    case 'final_cta':
      return (
        <>
          <Field label="Heading" value={p.heading || ''} disabled={disabled} onChange={(v) => set({ heading: v })} />
          <Field label="Body" value={p.body || ''} multiline disabled={disabled} onChange={(v) => set({ body: v })} />
          <Field label="Note" value={p.note || ''} disabled={disabled} onChange={(v) => set({ note: v })} />
          <MediaField
            label="Background image or video"
            value={p.backgroundVideo || p.backgroundImage || ''}
            disabled={disabled}
            onChange={(url) => {
              if (/\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/videos/')) {
                set({ backgroundVideo: url, backgroundImage: '' });
              } else {
                set({ backgroundImage: url, backgroundVideo: '' });
              }
            }}
          />
          <div style={styles.row2}>
            <Field
              label="Primary CTA label"
              value={p.primaryCta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ primaryCta: { ...(p.primaryCta || {}), label: v } })}
            />
            <Field
              label="Primary CTA link"
              value={p.primaryCta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ primaryCta: { ...(p.primaryCta || {}), href: v } })}
            />
          </div>
          <div style={styles.row2}>
            <Field
              label="Secondary CTA label"
              value={p.secondaryCta?.label || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), label: v } })}
            />
            <Field
              label="Secondary CTA link"
              value={p.secondaryCta?.href || ''}
              disabled={disabled}
              onChange={(v) => set({ secondaryCta: { ...(p.secondaryCta || {}), href: v } })}
            />
          </div>
          <LinkRows
            items={p.storeButtons || []}
            disabled={disabled}
            title="Store badges (optional)"
            onChange={(storeButtons) => set({ storeButtons })}
          />
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
  choice_hero: 'Choice hero',
  trust_strip: 'Trust strip',
  how_it_works: 'How it works',
  product_grid: 'Product grid',
  why_grid: 'Why grid',
  testimonials: 'Testimonials',
  final_cta: 'Final CTA',
  four_ways: 'Four ways',
  stories: 'Stories',
  cta_banner: 'CTA banner',
  download: 'Download',
  feature_cards: 'Feature cards',
  help_hub: 'Help hub',
  rich_text: 'Rich text',
  form: 'Form',
  legal: 'Legal',
  footer: 'Footer',
  onboarding_slides: 'Onboarding',
};

/** Admin CMS — rich text, custom pages, menu placement, forms. Saved to Postgres on Save. */
export default function CmsPagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [slug, setSlug] = useState('home');
  const [pageTitle, setPageTitle] = useState('');
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [sections, setSections] = useState<Section[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newMenu, setNewMenu] = useState('none');
  const [newIncludeForm, setNewIncludeForm] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);

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
    setMeta(data?.meta || {});
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

  const loadSubmissions = async () => {
    try {
      const res = await axios.get(`${API}/admin/cms/form-submissions?limit=30`, { headers: headers() });
      setSubmissions(res.data.data || []);
    } catch {
      setSubmissions([]);
    }
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
      await loadSubmissions();
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
          meta: {
            ...meta,
            menuPlacement: meta.menuPlacement || 'none',
            menuLabel: meta.menuLabel || pageTitle || slug,
            path: meta.path || (meta.custom ? `/pages/${slug}` : meta.path),
          },
          sections: sections.map((s, i) => ({
            type: s.type,
            sortOrder: s.sortOrder ?? i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        },
        { headers: headers() }
      );
      setMessage(`Saved & published “${slug}” to the database`);
      await loadList();
      await loadPage(slug);
      await loadSubmissions();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const createPage = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(
        `${API}/admin/cms/pages`,
        {
          title: newTitle,
          slug: newSlug || newTitle,
          menuPlacement: newMenu,
          menuLabel: newTitle,
          includeForm: newIncludeForm,
        },
        { headers: headers() }
      );
      const created = res.data.data;
      setShowCreate(false);
      setNewTitle('');
      setNewSlug('');
      setNewMenu('none');
      setNewIncludeForm(false);
      setMessage(`Created “${created.slug}” — live at /pages/${created.slug}`);
      await loadList();
      await loadPage(created.slug);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const addSection = (type: string) => {
    if (type === 'rich_text') {
      setSections((prev) => [
        ...prev,
        {
          type: 'rich_text',
          sortOrder: prev.length,
          enabled: true,
          payload: { heading: pageTitle || 'Section', html: '<p></p>', paragraphs: [] },
        },
      ]);
    }
    if (type === 'form') {
      setSections((prev) => [
        ...prev,
        {
          type: 'form',
          sortOrder: prev.length,
          enabled: true,
          payload: {
            heading: 'Form',
            formKey: 'default',
            submitLabel: 'Submit',
            successMessage: 'Thanks!',
            fields: [
              { name: 'name', label: 'Name', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'email', required: true },
              { name: 'message', label: 'Message', type: 'textarea', required: true },
            ],
          },
        },
      ]);
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
        All public marketing copy, images, videos, banners, and forms are edited here and saved to
        the database. Upload media on any section that supports it — changes go live on Save &
        publish.
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
        <button type="button" style={styles.ghost} disabled={busy} onClick={() => setShowCreate(true)}>
          + New page
        </button>
        <button type="button" style={styles.ghost} disabled={busy} onClick={bootstrap}>
          Ensure defaults
        </button>
        <button type="button" style={styles.danger} disabled={busy} onClick={resetAll}>
          Reset to mockup
        </button>
      </div>

      {showCreate ? (
        <div style={styles.createBox}>
          <p style={styles.groupTitle}>Create custom page</p>
          <div style={styles.row2}>
            <Field label="Title" value={newTitle} onChange={setNewTitle} disabled={busy} />
            <Field
              label="Slug (URL /pages/…)"
              value={newSlug}
              onChange={setNewSlug}
              disabled={busy}
            />
          </div>
          <label style={styles.field}>
            <span style={styles.label}>Show under menu</span>
            <select
              style={styles.input}
              value={newMenu}
              disabled={busy}
              onChange={(e) => setNewMenu(e.target.value)}
            >
              <option value="none">Nowhere (direct URL only)</option>
              <option value="header">Header navigation</option>
              <option value="footer-company">Footer · Company</option>
              <option value="footer-services">Footer · Services</option>
              <option value="footer-support">Footer · Support</option>
            </select>
          </label>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={newIncludeForm}
              disabled={busy}
              onChange={(e) => setNewIncludeForm(e.target.checked)}
            />
            Include a contact form section
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" style={styles.btn} disabled={busy || !newTitle} onClick={createPage}>
              Create & publish
            </button>
            <button type="button" style={styles.ghost} disabled={busy} onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

      <div style={styles.pageMeta}>
        <Field label="Page title" value={pageTitle} disabled={busy} onChange={setPageTitle} />
        <label style={styles.field}>
          <span style={styles.label}>Menu placement</span>
          <select
            style={styles.input}
            value={meta.menuPlacement || 'none'}
            disabled={busy || slug === 'global'}
            onChange={(e) =>
              setMeta((m) => ({
                ...m,
                menuPlacement: e.target.value,
                menuLabel: m.menuLabel || pageTitle,
                path: m.path || `/pages/${slug}`,
                custom: m.custom ?? true,
              }))
            }
          >
            <option value="none">Nowhere</option>
            <option value="header">Header navigation</option>
            <option value="footer-company">Footer · Company</option>
            <option value="footer-services">Footer · Services</option>
            <option value="footer-support">Footer · Support</option>
          </select>
        </label>
        <Field
          label="Menu label"
          value={meta.menuLabel || ''}
          disabled={busy || slug === 'global'}
          onChange={(v) => setMeta((m) => ({ ...m, menuLabel: v }))}
        />
        {meta.custom || slug.startsWith('pages') ? (
          <p style={styles.hint}>Public URL: /pages/{slug}</p>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" style={styles.smallGhost} disabled={busy} onClick={() => addSection('rich_text')}>
          + Rich text section
        </button>
        <button type="button" style={styles.smallGhost} disabled={busy} onClick={() => addSection('form')}>
          + Form section
        </button>
      </div>

      <div style={styles.sections}>
        {sections.length === 0 && !busy ? (
          <p style={styles.hint}>No sections on this page yet. Use Ensure defaults or add a section.</p>
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

      {submissions.length ? (
        <div style={{ marginTop: 32 }}>
          <p style={styles.groupTitle}>Recent form submissions</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={styles.th}>When</th>
                  <th style={styles.th}>Page</th>
                  <th style={styles.th}>Data</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((row) => (
                  <tr key={row.id}>
                    <td style={styles.td}>{new Date(row.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{row.page_slug}</td>
                    <td style={styles.td}>
                      <code style={{ fontSize: 11 }}>{JSON.stringify(row.payload)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  intro: { color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, maxWidth: 720, lineHeight: 1.5 },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  select: {
    background: 'var(--surface-elevated)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    minWidth: 280,
  },
  btn: {
    background: 'linear-gradient(90deg,var(--electric-violet),var(--motion-blue))',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: 999,
    padding: '10px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  ghost: {
    background: 'var(--surface-elevated)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
  },
  danger: {
    background: 'var(--surface-elevated)',
    color: 'var(--error)',
    border: '1px solid var(--surface-elevated)',
    borderRadius: 999,
    padding: '10px 18px',
    cursor: 'pointer',
  },
  hint: { color: 'var(--text-secondary)', fontSize: 13 },
  pageMeta: { marginBottom: 16, maxWidth: 720, display: 'grid', gap: 12 },
  createBox: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    maxWidth: 720,
  },
  th: { textAlign: 'left' as const, padding: '8px 6px', borderBottom: '1px solid var(--border)' },
  td: { padding: '8px 6px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const },
  sections: { display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 },
  sectionCard: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
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
  toggle: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 13 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, flex: 1 },
  label: { fontSize: 12, color: 'var(--text-secondary)', letterSpacing: 0.3 },
  input: {
    background: 'var(--surface)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  textarea: {
    background: 'var(--surface)',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'Poppins, Montserrat, sans-serif',
    lineHeight: 1.5,
    resize: 'vertical',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' },
  group: { marginBottom: 12 },
  groupTitle: { color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 8 },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--surface-elevated)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { color: 'var(--text-secondary)', fontSize: 12, marginBottom: 10, letterSpacing: 0.4 },
  smallGhost: {
    background: 'transparent',
    color: 'var(--motion-blue)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  smallDanger: {
    background: 'transparent',
    color: 'var(--error)',
    border: '1px solid var(--surface-elevated)',
    borderRadius: 8,
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 12,
    marginBottom: 12,
  },
};
