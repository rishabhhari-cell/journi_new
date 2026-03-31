import { supabaseAdmin } from "../lib/supabase";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { sendMentionEmail } from "./email.service";

const userMentionPattern = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

function parseMentionedUserIds(content: string): string[] {
  const userIds = new Set<string>();
  const regex = new RegExp(userMentionPattern.source, userMentionPattern.flags);
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    userIds.add(match[2]);
    match = regex.exec(content);
  }
  return Array.from(userIds);
}

export async function createMentionNotifications(input: {
  organizationId: string;
  manuscriptId: string;
  actorUserId: string;
  content: string;
}) {
  const mentions = parseMentionedUserIds(input.content).filter((id) => id !== input.actorUserId);
  if (mentions.length === 0) return;

  const rows = mentions.map((userId) => ({
    organization_id: input.organizationId,
    user_id: userId,
    type: "mention",
    title: "You were mentioned in a comment",
    body: "A collaborator mentioned you in a manuscript comment.",
    link_url: `/collaboration?manuscriptId=${input.manuscriptId}`,
    metadata: {
      manuscriptId: input.manuscriptId,
      actorUserId: input.actorUserId,
    },
  }));

  const { error } = await supabaseAdmin.from("notifications").insert(rows);
  if (error) {
    logger.warn("Failed to create mention notifications", { error: error.message });
  }

  const [profilesResult, actorResult, manuscriptResult] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, email").in("id", mentions),
    supabaseAdmin.from("profiles").select("full_name, email").eq("id", input.actorUserId).maybeSingle(),
    supabaseAdmin.from("manuscripts").select("title").eq("id", input.manuscriptId).maybeSingle(),
  ]);

  if (profilesResult.error) {
    logger.warn("Failed to fetch mention recipients for email", { error: profilesResult.error.message });
    return;
  }

  const actorName =
    actorResult.data?.full_name?.trim() ||
    actorResult.data?.email?.trim() ||
    "A collaborator";
  const manuscriptTitle = manuscriptResult.data?.title || "your manuscript";
  const commentPreview = input.content.length > 220 ? `${input.content.slice(0, 220)}...` : input.content;
  const linkUrl = `${env.CLIENT_BASE_URL}/collaboration?manuscriptId=${input.manuscriptId}`;

  for (const recipient of profilesResult.data ?? []) {
    if (!recipient.email) continue;
    void sendMentionEmail({
      to: recipient.email,
      recipientName: recipient.full_name || recipient.email,
      actorName,
      manuscriptTitle,
      commentPreview,
      linkUrl,
    });
  }
}
