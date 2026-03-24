import { logger } from "../lib/logger";
import { supabaseAdmin } from "../lib/supabase";

export interface AuditEventInput {
  organizationId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_events").insert({
    organization_id: event.organizationId ?? null,
    actor_user_id: event.actorUserId ?? null,
    event_type: event.eventType,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    payload: event.payload ?? {},
  });

  if (error) {
    logger.warn("Failed to write audit event", {
      eventType: event.eventType,
      error: error.message,
    });
  }
}

