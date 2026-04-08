import { env } from "../config/env";
import { logger } from "../lib/logger";
import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  template?: {
    id: string;
    variables: Record<string, string | number>;
  };
}

function hasEmailProviderConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const resend = new Resend(env.RESEND_API_KEY);
  const basePayload = {
    from: env.MAIL_FROM,
    to: [input.to],
    replyTo: env.MAIL_REPLY_TO,
  };

  const payload = input.template
    ? {
        ...basePayload,
        subject: input.subject,
        template: {
          id: input.template.id,
          variables: input.template.variables,
        },
      }
    : {
        ...basePayload,
        subject: input.subject ?? "",
        html: input.html ?? "",
        text: input.text,
      };

  const { error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(`Resend API error: ${error.message}`);
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

export async function sendWelcomeEmail(input: { to: string; fullName: string; verificationUrl?: string }) {
  const firstName = input.fullName.trim().split(/\s+/)[0] || "there";
  const ctaUrl = input.verificationUrl ?? "https://www.journie.io/dashboard";
  const ctaLabel = input.verificationUrl
    ? "Verify Email &amp; Begin Journie &rarr;"
    : "Begin Your Journie &rarr;";
  const subject = `Welcome to Journie, ${firstName} - your research journey begins here`;

  if (env.RESEND_WELCOME_TEMPLATE_ID) {
    await sendTransactionalEmail({
      to: input.to,
      subject,
      template: {
        id: env.RESEND_WELCOME_TEMPLATE_ID,
        variables: {
          GIVEN_NAME: firstName,
          CTA_URL: ctaUrl,
          CTA_LABEL: ctaLabel,
          SUPPORT_EMAIL: env.SUPPORT_EMAIL,
        },
      },
      text: input.verificationUrl
        ? `Welcome to Journie, ${firstName}. Verify your email and get started: ${ctaUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`
        : `Welcome to Journie, ${firstName}. Your account is ready. Start here: ${ctaUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`,
    });
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f0ede6; font-family:"Plus Jakarta Sans",Arial,sans-serif; }
  .wrap { padding:2rem 1rem; background:#f0ede6; }
  .shell { max-width:600px; margin:0 auto; background:#fff; border-radius:4px; overflow:hidden; border:1px solid #ddd; }
  .header { background:#fff; padding:2.5rem 2.5rem 1.5rem; text-align:center; border-bottom:1px solid #e8e4dc; }
  .logo-img { display:block; margin:0 auto; width:180px; max-width:100%; height:auto; }
  .body { padding:2.5rem 3rem 2rem; color:#2c2c2a; }
  .greeting { font-family:"Plus Jakarta Sans",Arial,sans-serif; font-size:1.35rem; font-weight:800; color:#1a6b1a; margin-bottom:1.4rem; }
  .p { font-family:"Plus Jakarta Sans",Arial,sans-serif; font-size:0.97rem; line-height:1.75; color:#3a3a38; margin-bottom:1.3rem; }
  .cta { text-align:center; margin:2rem 0 1.5rem; }
  .btn { display:inline-block; background:#1a6b1a; color:#fff; font-family:"Plus Jakarta Sans",Arial,sans-serif; font-size:0.82rem; letter-spacing:0.1em; text-transform:uppercase; padding:0.85rem 2.5rem; text-decoration:none; border-radius:2px; font-weight:600; }
  .sign { margin-top:1.5rem; padding-top:1.5rem; border-top:1px solid #e8e4dc; font-family:"Plus Jakarta Sans",Arial,sans-serif; font-size:0.95rem; color:#3a3a38; line-height:1.7; }
  .sign-name { font-weight:800; color:#1a6b1a; margin-top:0.8rem; }
  .footer { background:#1a6b1a; padding:1.5rem 2.5rem; text-align:center; }
  .footer-logo-img { display:block; margin:0 auto 0.4rem; width:120px; max-width:100%; height:auto; }
  .footer-tag { font-family:"Plus Jakarta Sans",Arial,sans-serif; font-size:0.72rem; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.65); margin-bottom:0.8rem; }
  .footer-links { font-size:0.72rem; font-family:"Plus Jakarta Sans",Arial,sans-serif; color:rgba(255,255,255,0.55); }
  .footer-links a { color:rgba(255,255,255,0.7); margin:0 0.5rem; text-decoration:none; }
</style>
</head>
<body>
<div class="wrap">
<div class="shell">
  <div class="header">
    <img src="https://www.journie.io/logos/journie_logo.jpg" alt="Journie logo" class="logo-img" />
  </div>

  <div class="body" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">
    <p class="greeting" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">Dear ${firstName},</p>
    <p class="p" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">Welcome to Journie, and congratulations on taking a meaningful step forward in your research career! We are genuinely thrilled to have you with us.</p>
    <p class="p" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;">We built Journie because we know first-hand how much time researchers waste navigating the administrative maze of scientific publishing: the reformatting, the resubmissions, the endless searching for the right conference or journal. That time belongs to your science - and we intend to give it back.</p>
    <div class="cta"><a href="${ctaUrl}" class="btn">${ctaLabel}</a></div>
    <div class="sign">
      <p>Should you have any questions, we are always here to help. We look forward to seeing where your research takes you.</p>
      <p class="sign-name">Yuri &amp; Rish<br><span style="font-weight:400;font-size:0.88rem;color:#666;">Co-Founders, Journie</span></p>
    </div>
  </div>

  <div class="footer">
    <img src="https://www.journie.io/logos/journie_invert.jpg" alt="Journie logo" class="footer-logo-img" />
    <div class="footer-tag">Your research, simplified.</div>
    <div class="footer-links">
      <a href="#">Unsubscribe</a> &middot; <a href="#">Privacy Policy</a> &middot; <a href="https://www.journie.io">journie.io</a>
    </div>
  </div>
</div>
</div>
</body>
</html>
  `;
  const text = input.verificationUrl
    ? `Welcome to Journie, ${firstName}. Verify your email and get started: ${ctaUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`
    : `Welcome to Journie, ${firstName}. Your account is ready. Start here: ${ctaUrl}. Need help? Email ${env.SUPPORT_EMAIL}.`;
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

  if (env.RESEND_ORG_INVITE_TEMPLATE_ID) {
    await sendTransactionalEmail({
      to: input.to,
      subject,
      template: {
        id: env.RESEND_ORG_INVITE_TEMPLATE_ID,
        variables: {
          INVITER_NAME: input.inviterName,
          ORGANIZATION_NAME: input.organizationName,
          ROLE: input.role,
          INVITE_URL: input.inviteUrl,
          SUPPORT_EMAIL: env.SUPPORT_EMAIL,
        },
      },
      text: `${input.inviterName} invited you to ${input.organizationName} on Journi as ${input.role}. Accept invite: ${input.inviteUrl}`,
    });
    return;
  }

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

  if (env.RESEND_MENTION_TEMPLATE_ID) {
    await sendTransactionalEmail({
      to: input.to,
      subject,
      template: {
        id: env.RESEND_MENTION_TEMPLATE_ID,
        variables: {
          RECIPIENT_NAME: input.recipientName,
          ACTOR_NAME: input.actorName,
          MANUSCRIPT_TITLE: input.manuscriptTitle,
          COMMENT_PREVIEW: input.commentPreview,
          LINK_URL: input.linkUrl,
          SUPPORT_EMAIL: env.SUPPORT_EMAIL,
        },
      },
      text: `Hi ${input.recipientName}, ${input.actorName} mentioned you in ${input.manuscriptTitle}. ${input.commentPreview} Open: ${input.linkUrl}`,
    });
    return;
  }

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

export async function sendPasswordResetEmail(input: {
  to: string;
  fullName?: string;
  resetUrl: string;
}) {
  const firstName = input.fullName?.trim().split(/\s+/)[0] || "there";
  const subject = "Reset your Journie password";

  if (env.RESEND_PASSWORD_RESET_TEMPLATE_ID) {
    await sendTransactionalEmail({
      to: input.to,
      subject,
      template: {
        id: env.RESEND_PASSWORD_RESET_TEMPLATE_ID,
        variables: {
          GIVEN_NAME: firstName,
          RESET_URL: input.resetUrl,
          SUPPORT_EMAIL: env.SUPPORT_EMAIL,
        },
      },
      text: `Hi ${firstName}, reset your Journie password here: ${input.resetUrl}. If you did not request this, you can ignore this email.`,
    });
    return;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Reset your password</h2>
      <p style="margin:0 0 12px;">Hi ${firstName}, we received a request to reset your Journie password.</p>
      <p style="margin:0 0 12px;"><a href="${input.resetUrl}" style="display:inline-block;background:#67AA8A;color:#0f172a;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a></p>
      <p style="margin:0 0 12px;">If you did not request this, you can safely ignore this email.</p>
      <p style="margin:0;">Need help? Contact <a href="mailto:${env.SUPPORT_EMAIL}">${env.SUPPORT_EMAIL}</a>.</p>
    </div>
  `;
  const text = `Hi ${firstName}, reset your Journie password here: ${input.resetUrl}. If you did not request this, you can ignore this email.`;
  await sendTransactionalEmail({ to: input.to, subject, html, text });
}

