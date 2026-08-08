import React from 'react';
import { Link } from 'react-router-dom';

/** Shown when a public CMS page is missing or unpublished. */
export function CmsUnavailable({
  title = 'Content unavailable',
  message = 'This page has no published content yet. Edit it in the admin CMS.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex-1 bg-surface text-text-primary flex flex-col items-center justify-center py-24 px-6 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-text-secondary max-w-md">{message}</p>
      <Link to="/" className="mt-6 mkt-btn-primary inline-flex">
        Back to home
      </Link>
    </div>
  );
}
