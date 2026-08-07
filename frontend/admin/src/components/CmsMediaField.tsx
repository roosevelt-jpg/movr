import React, { useState } from 'react';
import { mediaUrl, uploadCatalogImage } from '../lib/media';

/** Upload image or video for CMS sections — stores under backend/assets. */
export function MediaField({
  label,
  value,
  onChange,
  disabled,
  accept = 'image/*,video/mp4,video/webm,video/quicktime',
  hint,
}: {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  accept?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(value || '') || (value || '').includes('/videos/');

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
        {label}
      </label>
      {hint ? (
        <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-secondary)' }}>{hint}</p>
      ) : null}
      <input
        type="file"
        accept={accept}
        disabled={disabled || busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          setErr('');
          try {
            const token = localStorage.getItem('movr_admin_token') || '';
            const url = await uploadCatalogImage(file, token);
            onChange(url);
          } catch (ex: any) {
            setErr(ex.message || 'Upload failed');
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy ? <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</p> : null}
      {err ? <p style={{ fontSize: 12, color: 'var(--error)' }}>{err}</p> : null}
      {value ? (
        <div style={{ marginTop: 8 }}>
          {isVideo ? (
            <video
              src={mediaUrl(value)}
              controls
              muted
              style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 10, background: '#000' }}
            />
          ) : (
            <img
              src={mediaUrl(value)}
              alt=""
              style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 10, objectFit: 'cover' }}
            />
          )}
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-all' }}>
            {value}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            style={{
              marginTop: 6,
              fontSize: 12,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              borderRadius: 999,
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            Remove media
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CtaPair({
  labelPrefix,
  value,
  onChange,
  disabled,
  Field,
}: {
  labelPrefix: string;
  value?: { label?: string; href?: string };
  onChange: (next: { label: string; href: string }) => void;
  disabled?: boolean;
  Field: React.FC<{
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  }>;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <Field
        label={`${labelPrefix} label`}
        value={value?.label || ''}
        disabled={disabled}
        onChange={(v) => onChange({ label: v, href: value?.href || '' })}
      />
      <Field
        label={`${labelPrefix} link`}
        value={value?.href || ''}
        disabled={disabled}
        onChange={(v) => onChange({ label: value?.label || '', href: v })}
      />
    </div>
  );
}
