import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { OrgRole } from "../../shared/backend";
import { env } from "../config/env";
import { assertOrganizationRole } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";

export const organizationsRouter = Router();

const createOrgSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "editor", "viewer"]).default("viewer"),
});

function generateOrgSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
}

organizationsRouter.use(requireAuth);

organizationsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const { data, error } = await supabaseAdmin
      .from("organization_members")
      .select("role, organizations(id, name, slug, created_at)")
      .eq("user_id", authReq.auth.userId);

    if (error) {
      throw new HttpError(500, error.message, "ORGANIZATIONS_LIST_FAILED");
    }

    const organizations = (data ?? [])
      .map((row: any) => {
        const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
        if (!org) return null;
        return {
          role: row.role,
          id: org.id,
          name: org.name,
          slug: org.slug,
          createdAt: org.created_at,
        };
      })
      .filter(Boolean);

    res.json({ data: organizations });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createOrgSchema.parse(req.body);
    const slug = input.slug ?? `${generateOrgSlug(input.name)}-${crypto.randomBytes(2).toString("hex")}`;

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: input.name,
        slug,
        created_by: authReq.auth.userId,
      })
      .select("*")
      .single();

    if (orgError) {
      throw new HttpError(400, orgError.message, "ORGANIZATION_CREATE_FAILED");
    }

    const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
      organization_id: org.id,
      user_id: authReq.auth.userId,
      role: "owner",
      invited_by: authReq.auth.userId,
    });
    if (memberError) {
      throw new HttpError(500, memberError.message, "ORGANIZATION_MEMBER_CREATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: org.id,
      actorUserId: authReq.auth.userId,
      eventType: "organization.created",
      entityType: "organization",
      entityId: org.id,
      payload: { name: input.name, slug },
    });

    res.status(201).json({
      data: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

organizationsRouter.post("/:organizationId/invite", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = inviteSchema.parse(req.body);
    const organizationId = req.params.organizationId;
    await assertOrganizationRole(authReq.auth.userId, organizationId, "admin");

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + env.INVITE_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("organization_invites")
      .insert({
        organization_id: organizationId,
        email: input.email.toLowerCase(),
        role: input.role,
        token_hash: tokenHash,
        invited_by: authReq.auth.userId,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error) {
      throw new HttpError(400, error.message, "ORGANIZATION_INVITE_FAILED");
    }

    await writeAuditEvent({
      organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "organization.invite.created",
      entityType: "organization_invite",
      entityId: data.id,
      payload: {
        email: input.email.toLowerCase(),
        role: input.role,
      },
    });

    res.status(201).json({
      data: {
        inviteToken,
        role: input.role as OrgRole,
        expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

