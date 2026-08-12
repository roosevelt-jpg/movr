/**
 * Department mailboxes + signatures for outbound Movr email.
 * Welcome emails always use `ceo` (Roosevelt Adom).
 */

export type EmailDepartmentKey =
  | 'ceo'
  | 'support'
  | 'security'
  | 'ops'
  | 'drivers'
  | 'merchants'
  | 'product';

export type EmailDepartment = {
  key: EmailDepartmentKey;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  /** Plain-text signature block appended to every message from this department. */
  signatureText: string;
  /** HTML signature (same content). */
  signatureHtml: string;
};

const brandFooter =
  'Movr · Fair fares. Zero commission on rides.\nhttps://mymovr.io';

function sigText(lines: string[]) {
  return [...lines, '', brandFooter].join('\n');
}

function sigHtml(lines: string[]) {
  const body = lines.map((l) => (l ? `<div>${escapeHtml(l)}</div>` : '<br/>')).join('');
  return `${body}<br/><div style="color:#6b7280;font-size:12px;line-height:1.5">Movr · Fair fares. Zero commission on rides.<br/><a href="https://mymovr.io" style="color:#6A00FF">mymovr.io</a></div>`;
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DEPARTMENTS: Record<EmailDepartmentKey, EmailDepartment> = {
  ceo: {
    key: 'ceo',
    fromEmail: process.env.EMAIL_FROM_CEO || 'ceo@mymovr.io',
    fromName: process.env.EMAIL_FROM_CEO_NAME || 'Roosevelt Adom, CEO · Movr',
    replyTo: process.env.EMAIL_REPLY_CEO || 'ceo@mymovr.io',
    signatureText: sigText([
      'Warmly,',
      'Roosevelt Adom',
      'Founder & CEO, Movr',
    ]),
    signatureHtml: sigHtml([
      'Warmly,',
      'Roosevelt Adom',
      'Founder & CEO, Movr',
    ]),
  },
  support: {
    key: 'support',
    fromEmail: process.env.EMAIL_FROM_SUPPORT || 'support@mymovr.io',
    fromName: process.env.EMAIL_FROM_SUPPORT_NAME || 'Movr Support',
    replyTo: process.env.EMAIL_REPLY_SUPPORT || 'support@mymovr.io',
    signatureText: sigText(['Thanks,', 'The Movr Support Team']),
    signatureHtml: sigHtml(['Thanks,', 'The Movr Support Team']),
  },
  security: {
    key: 'security',
    fromEmail: process.env.EMAIL_FROM_SECURITY || 'security@mymovr.io',
    fromName: process.env.EMAIL_FROM_SECURITY_NAME || 'Movr Security',
    replyTo: process.env.EMAIL_REPLY_SECURITY || 'security@mymovr.io',
    signatureText: sigText(['— Movr Security Operations']),
    signatureHtml: sigHtml(['— Movr Security Operations']),
  },
  ops: {
    key: 'ops',
    fromEmail: process.env.EMAIL_FROM_OPS || 'ops@mymovr.io',
    fromName: process.env.EMAIL_FROM_OPS_NAME || 'Movr Operations',
    replyTo: process.env.EMAIL_REPLY_OPS || 'ops@mymovr.io',
    signatureText: sigText(['Best,', 'Movr Operations']),
    signatureHtml: sigHtml(['Best,', 'Movr Operations']),
  },
  drivers: {
    key: 'drivers',
    fromEmail: process.env.EMAIL_FROM_DRIVERS || 'drivers@mymovr.io',
    fromName: process.env.EMAIL_FROM_DRIVERS_NAME || 'Movr Driver Success',
    replyTo: process.env.EMAIL_REPLY_DRIVERS || 'drivers@mymovr.io',
    signatureText: sigText(['Drive safe,', 'Movr Driver Success']),
    signatureHtml: sigHtml(['Drive safe,', 'Movr Driver Success']),
  },
  merchants: {
    key: 'merchants',
    fromEmail: process.env.EMAIL_FROM_MERCHANTS || 'merchants@mymovr.io',
    fromName: process.env.EMAIL_FROM_MERCHANTS_NAME || 'Movr Merchant Partners',
    replyTo: process.env.EMAIL_REPLY_MERCHANTS || 'merchants@mymovr.io',
    signatureText: sigText(['Partners,', 'Movr Merchant Team']),
    signatureHtml: sigHtml(['Partners,', 'Movr Merchant Team']),
  },
  product: {
    key: 'product',
    fromEmail: process.env.EMAIL_FROM_PRODUCT || 'hello@mymovr.io',
    fromName: process.env.EMAIL_FROM_PRODUCT_NAME || 'Movr',
    replyTo: process.env.EMAIL_REPLY_PRODUCT || 'hello@mymovr.io',
    signatureText: sigText(['Cheers,', 'The Movr Team']),
    signatureHtml: sigHtml(['Cheers,', 'The Movr Team']),
  },
};

export function getEmailDepartment(key: EmailDepartmentKey): EmailDepartment {
  return DEPARTMENTS[key] || DEPARTMENTS.support;
}

export function listEmailDepartments(): EmailDepartment[] {
  return Object.values(DEPARTMENTS);
}

export { escapeHtml };
