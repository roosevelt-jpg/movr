import nodemailer from 'nodemailer';
import winston from 'winston';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import {
  EmailDepartmentKey,
  escapeHtml,
  getEmailDepartment,
} from '../config/email-departments';

export type SendEmailInput = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  /** Department controls From + signature. Default: support. */
  department?: EmailDepartmentKey;
  /** When false, skip appending the department signature (already inlined). */
  appendSignature?: boolean;
};

/**
 * Shared outbound email via SendGrid SMTP (hub credentials or SENDGRID_API_KEY).
 * Every send uses a department mailbox + signature unless disabled.
 */
export class EmailService {
  private db: DatabaseService;
  private integrations: IntegrationsService;
  private logger: winston.Logger;
  private transporter: any = null;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.integrations = new IntegrationsService(this.db);
    this.logger = winston.createLogger({
      defaultMeta: { service: 'email' },
      transports: [new winston.transports.Console()],
    });
  }

  private async resolveApiKey(): Promise<string | null> {
    const fromHub = await this.integrations
      .resolveSecret('sendgrid', ['api_key', 'secret_key'], ['SENDGRID_API_KEY'])
      .catch(() => null);
    return fromHub || process.env.SENDGRID_API_KEY || null;
  }

  private async getTransporter() {
    if (this.transporter) return this.transporter;
    const apiKey = await this.resolveApiKey();
    if (!apiKey) return null;
    this.transporter = nodemailer.createTransport({
      service: 'SendGrid',
      auth: { user: 'apikey', pass: apiKey },
    });
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<{ sent: boolean; skipped?: string }> {
    const to = String(input.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return { sent: false, skipped: 'invalid_recipient' };
    }

    const dept = getEmailDepartment(input.department || 'support');
    const append = input.appendSignature !== false;
    const text = append ? `${input.textBody.trim()}\n\n${dept.signatureText}` : input.textBody;
    const html = append
      ? `${input.htmlBody}<br/><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>${dept.signatureHtml}`
      : input.htmlBody;

    const transporter = await this.getTransporter();
    if (!transporter) {
      this.logger.warn('Email skipped — SendGrid not configured', {
        to,
        subject: input.subject,
        department: dept.key,
      });
      return { sent: false, skipped: 'sendgrid_not_configured' };
    }

    try {
      await transporter.sendMail({
        from: `"${dept.fromName}" <${dept.fromEmail}>`,
        replyTo: dept.replyTo || dept.fromEmail,
        to,
        subject: input.subject,
        text,
        html,
      });
      this.logger.info('Email sent', { to, subject: input.subject, department: dept.key });
      return { sent: true };
    } catch (error: any) {
      this.logger.error('Email send failed', {
        to,
        subject: input.subject,
        error: error?.message || String(error),
      });
      return { sent: false, skipped: error?.message || 'send_failed' };
    }
  }

  /** Welcome email — always signed by CEO Roosevelt Adom. */
  async sendWelcome(opts: {
    to: string;
    firstName?: string | null;
    userType?: string | null;
  }) {
    const name = String(opts.firstName || '').trim() || 'there';
    const role =
      opts.userType === 'driver'
        ? 'driver'
        : opts.userType === 'merchant'
          ? 'merchant partner'
          : 'rider';

    const subject = 'Welcome to Movr';
    const textBody = [
      `Hi ${name},`,
      '',
      `Welcome to Movr — I'm glad you're here.`,
      '',
      `We've built Movr so ${role}s like you get a fairer deal: transparent pricing, zero commission on ride fares, and tools that respect your time.`,
      '',
      `Please verify your email and phone so we can keep your account secure and reach you on WhatsApp when it matters.`,
      '',
      `If you ever need me or the team, just reply to this email.`,
    ].join('\n');

    const htmlBody = `
      <div style="font-family:Poppins,Arial,sans-serif;color:#111;line-height:1.55;max-width:560px">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Welcome to <strong>Movr</strong> — I'm glad you're here.</p>
        <p>We've built Movr so ${escapeHtml(role)}s like you get a fairer deal: transparent pricing, zero commission on ride fares, and tools that respect your time.</p>
        <p>Please verify your email and phone so we can keep your account secure and reach you on WhatsApp when it matters.</p>
        <p>If you ever need me or the team, just reply to this email.</p>
      </div>`;

    return this.send({
      to: opts.to,
      subject,
      textBody,
      htmlBody,
      department: 'ceo',
    });
  }

  async sendEmailVerification(opts: { to: string; firstName?: string | null; code: string }) {
    const name = String(opts.firstName || '').trim() || 'there';
    const subject = `${opts.code} is your Movr verification code`;
    const textBody = [
      `Hi ${name},`,
      '',
      `Your Movr account verification code is: ${opts.code}`,
      '',
      `This code expires in 10 minutes. If you didn't create a Movr account, you can ignore this email.`,
    ].join('\n');
    const htmlBody = `
      <div style="font-family:Poppins,Arial,sans-serif;color:#111;line-height:1.55;max-width:560px">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Your Movr account verification code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${escapeHtml(opts.code)}</p>
        <p style="color:#6b7280;font-size:13px">Expires in 10 minutes. If you didn't create a Movr account, ignore this email.</p>
      </div>`;

    return this.send({
      to: opts.to,
      subject,
      textBody,
      htmlBody,
      department: 'support',
    });
  }

  async sendPasswordReset(opts: { to: string; code: string }) {
    const subject = `${opts.code} is your Movr password reset code`;
    const textBody = [
      `Your Movr password reset code is: ${opts.code}`,
      '',
      `This code expires in 10 minutes. If you didn't request a reset, ignore this email.`,
    ].join('\n');
    const htmlBody = `
      <div style="font-family:Poppins,Arial,sans-serif;color:#111;line-height:1.55;max-width:560px">
        <p>Your Movr password reset code is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${escapeHtml(opts.code)}</p>
        <p style="color:#6b7280;font-size:13px">Expires in 10 minutes.</p>
      </div>`;
    return this.send({
      to: opts.to,
      subject,
      textBody,
      htmlBody,
      department: 'security',
    });
  }

  async sendAdminInvite(opts: { to: string; acceptUrl: string; roles: string[] }) {
    const subject = "You're invited to Movr Admin";
    const roles = (opts.roles || []).join(', ') || 'admin';
    const textBody = [
      `You've been invited to the Movr Admin console.`,
      '',
      `Roles: ${roles}`,
      '',
      `Accept your invite: ${opts.acceptUrl}`,
      '',
      `This link expires soon. If you weren't expecting this, contact security@movr.app.`,
    ].join('\n');
    const htmlBody = `
      <div style="font-family:Poppins,Arial,sans-serif;color:#111;line-height:1.55;max-width:560px">
        <p>You've been invited to the <strong>Movr Admin</strong> console.</p>
        <p><strong>Roles:</strong> ${escapeHtml(roles)}</p>
        <p><a href="${escapeHtml(opts.acceptUrl)}" style="display:inline-block;background:linear-gradient(135deg,#3F7048,#6A00FF,#0055FF);color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:700">Accept invite</a></p>
        <p style="color:#6b7280;font-size:13px">If the button doesn't work, open:<br/>${escapeHtml(opts.acceptUrl)}</p>
      </div>`;
    return this.send({
      to: opts.to,
      subject,
      textBody,
      htmlBody,
      department: 'ops',
    });
  }
}

let singleton: EmailService | null = null;
export function getEmailService(db?: DatabaseService) {
  if (!singleton) singleton = new EmailService(db);
  return singleton;
}
