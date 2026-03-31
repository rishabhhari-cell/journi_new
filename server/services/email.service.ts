import { env } from "../config/env";
import { logger } from "../lib/logger";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function hasEmailProviderConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [input.to],
      reply_to: env.MAIL_REPLY_TO,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend API error (${response.status}): ${payload}`);
  }
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<void> {
  if (!hasEmailProviderConfigured()) {
    logger.info("Email send skipped (no provider configured)", {
      to: input.to,
      subject: input.subject,
    });
    return;
  }

  try {
    await sendViaResend(input);
  } catch (error) {
    logger.error("Failed to send transactional email", {
      to: input.to,
      subject: input.subject,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendWelcomeEmail(input: { to: string; fullName: string }) {
  const subject = "Welcome to Journi";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Welcome to Journi, ${input.fullName}.</h2>
      <p style="margin:0 0 12px;">Your account is ready. You can now plan projects, collaborate with your team, and prepare submissions in one place.</p>
      <p style="margin:0;">If you need help, email <a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a>.</p>
    </div>
  `;
  const text = `Welcome to Journi, ${input.fullName}. Your account is ready. Need help? Email ${env.SUPPORT_EMAIL}.`;
  await sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendOrganizationInviteEmail(input: {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}) {
  const subject = `You're invited to ${input.organizationName} on Journi`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">You've been invited to Journi</h2>
      <p style="margin:0 0 12px;"><strong>${input.inviterName}</strong> invited you to join <strong>${input.organizationName}</strong> as <strong>${input.role}</strong>.</p>
      <p style="margin:0 0 12px;"><a href="${input.inviteUrl}" style="display:inline-block;background:#67AA8A;color:#0f172a;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Accept invite</a></p>
      <p style="margin:0;">If the button does not work, open this link: ${input.inviteUrl}</p>
    </div>
  `;
  const text = `${input.inviterName} invited you to ${input.organizationName} on Journi as ${input.role}. Accept invite: ${input.inviteUrl}`;
  await sendTransactionalEmail({ to: input.to, subject, html, text });
}

export async function sendMentionEmail(input: {
  to: string;
  recipientName: string;
  actorName: string;
  manuscriptTitle: string;
  commentPreview: string;
  linkUrl: string;
}) {
  const subject = `${input.actorName} mentioned you in ${input.manuscriptTitle}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">You were mentioned in a comment</h2>
      <p style="margin:0 0 12px;">Hi ${input.recipientName}, <strong>${input.actorName}</strong> mentioned you in <strong>${input.manuscriptTitle}</strong>.</p>
      <blockquote style="margin:0 0 12px;border-left:3px solid #cbd5e1;padding-left:10px;color:#334155;">${input.commentPreview}</blockquote>
      <p style="margin:0 0 12px;"><a href="${input.linkUrl}" style="display:inline-block;background:#67AA8A;color:#0f172a;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Open comment</a></p>
      <p style="margin:0;">Need help? Contact <a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a>.</p>
    </div>
  `;
  const text = `Hi ${input.recipientName}, ${input.actorName} mentioned you in ${input.manuscriptTitle}. ${input.commentPreview} Open: ${input.linkUrl}`;
  await sendTransactionalEmail({ to: input.to, subject, html, text });
}
