import fs from "node:fs";
import path from "node:path";
import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../lib/logger";

interface SendEmailInput {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  error: string | null;
}

type TemplateName = "welcome-email.html" | "password-reset-email.html" | "team-invite-email.html";

const EMAIL_SEND_MAX_ATTEMPTS = 3;
const EMAIL_SEND_RETRY_DELAYS_MS = [250, 750];
const TEMPLATE_DIR = path.join(process.cwd(), "server", "templates");
const TEMPLATE_CACHE = new Map<TemplateName, string>();

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasEmailProviderConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getGivenName(fullName?: string): string {
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName || "there";
}

function getInferredGivenName(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const raw = localPart.split(/[._-]/)[0] ?? "";
  if (!raw) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function loadTemplate(templateName: TemplateName): string {
  const cached = TEMPLATE_CACHE.get(templateName);
  if (cached) return cached;

  const filePath = path.join(TEMPLATE_DIR, templateName);
  const template = fs.readFileSync(filePath, "utf8");
  TEMPLATE_CACHE.set(templateName, template);
  return template;
}

export function renderEmailTemplate(
  templateName: TemplateName,
  variables: Record<string, string>,
): string {
  let html = loadTemplate(templateName);

  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, htmlEscape(value));
  }

  return html;
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to: [input.to],
    replyTo: env.MAIL_REPLY_TO,
    subject: input.subject ?? "",
    html: input.html ?? "",
    text: input.text,
  });

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
  }
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!hasEmailProviderConfigured()) {
    const error = "RESEND_API_KEY is not configured";
    logger.info("Email send skipped (no provider configured)", {
      to: input.to,
      subject: input.subject,
      error,
    });
    return { sent: false, error };
  }

  for (let attempt = 1; attempt <= EMAIL_SEND_MAX_ATTEMPTS; attempt += 1) {
    try {
      await sendViaResend(input);
      logger.info("Transactional email sent", {
        to: input.to,
        subject: input.subject,
        attempt,
      });
      return { sent: true, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = attempt === EMAIL_SEND_MAX_ATTEMPTS;

      if (isLastAttempt) {
        logger.error("Failed to send transactional email", {
          to: input.to,
          subject: input.subject,
          attempt,
          error: message,
        });
        return { sent: false, error: message };
      }

      logger.warn("Transactional email send attempt failed; retrying", {
        to: input.to,
        subject: input.subject,
        attempt,
        error: message,
      });

      await wait(EMAIL_SEND_RETRY_DELAYS_MS[attempt - 1] ?? 1000);
    }
  }

  return { sent: false, error: "EMAIL_SEND_ATTEMPTS_EXHAUSTED" };
}

export async function sendSignupVerificationEmail(input: {
  to: string;
  fullName: string;
  verificationUrl: string;
}): Promise<SendEmailResult> {
  const firstName = getGivenName(input.fullName);
  const subject = "Verify your email to start using Journie";
  const html = renderEmailTemplate("welcome-email.html", {
    GIVEN_NAME: firstName,
    CTA_URL: input.verificationUrl,
    CTA_LABEL: "Verify Email & Begin Journie",
    SUPPORT_EMAIL: env.SUPPORT_EMAIL,
  });
  const text = `Welcome to Journie, ${firstName}. Verify your email and get started: ${input.verificationUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`;

  return sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendWelcomeEmail(input: { to: string; fullName: string }): Promise<SendEmailResult> {
  const firstName = getGivenName(input.fullName);
  const ctaUrl = "https://www.journie.io/dashboard";
  const subject = `Welcome to Journie, ${firstName} - your research journey begins here`;
  const html = renderEmailTemplate("welcome-email.html", {
    GIVEN_NAME: firstName,
    CTA_URL: ctaUrl,
    CTA_LABEL: "Begin Your Journie",
    SUPPORT_EMAIL: env.SUPPORT_EMAIL,
  });
  const text = `Welcome to Journie, ${firstName}. Your account is ready. Start here: ${ctaUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`;

  return sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendOrganizationInviteEmail(input: {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}): Promise<SendEmailResult> {
  const subject = `${input.inviterName} invited you to ${input.organizationName}`;
  const html = renderEmailTemplate("team-invite-email.html", {
    GIVEN_NAME: getInferredGivenName(input.to),
    INVITER_NAME: input.inviterName,
    ORGANIZATION_NAME: input.organizationName,
    ROLE: input.role,
    INVITE_URL: input.inviteUrl,
    SUPPORT_EMAIL: env.SUPPORT_EMAIL,
  });
  const text = `${input.inviterName} invited you to ${input.organizationName} on Journie as ${input.role}. Accept invite: ${input.inviteUrl}. Need help? ${env.SUPPORT_EMAIL}.`;

  return sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendMentionEmail(input: {
  to: string;
  recipientName: string;
  actorName: string;
  manuscriptTitle: string;
  commentPreview: string;
  linkUrl: string;
}): Promise<SendEmailResult> {
  const subject = `${input.actorName} mentioned you in ${input.manuscriptTitle}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">You were mentioned in a comment</h2>
      <p style="margin:0 0 12px;">Hi ${htmlEscape(input.recipientName)}, <strong>${htmlEscape(input.actorName)}</strong> mentioned you in <strong>${htmlEscape(input.manuscriptTitle)}</strong>.</p>
      <blockquote style="margin:0 0 12px;border-left:3px solid #cbd5e1;padding-left:10px;color:#334155;">${htmlEscape(input.commentPreview)}</blockquote>
      <p style="margin:0 0 12px;"><a href="${htmlEscape(input.linkUrl)}" style="display:inline-block;background:#67AA8A;color:#0f172a;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Open comment</a></p>
      <p style="margin:0;">Need help? Contact <a href="mailto:${htmlEscape(env.SUPPORT_EMAIL)}">${htmlEscape(env.SUPPORT_EMAIL)}</a>.</p>
    </div>
  `;
  const text = `Hi ${input.recipientName}, ${input.actorName} mentioned you in ${input.manuscriptTitle}. ${input.commentPreview} Open: ${input.linkUrl}`;
  return sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName?: string;
  resetUrl: string;
}): Promise<SendEmailResult> {
  const firstName = getGivenName(input.fullName);
  const subject = "Reset your Journie password";
  const html = renderEmailTemplate("password-reset-email.html", {
    GIVEN_NAME: firstName,
    RESET_URL: input.resetUrl,
    SUPPORT_EMAIL: env.SUPPORT_EMAIL,
  });
  const text = `Hi ${firstName}, reset your Journie password here: ${input.resetUrl}. If you did not request this, you can ignore this email.`;

  return sendTransactionalEmail({ to: input.to, subject, html, text });
}
