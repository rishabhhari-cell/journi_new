import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { ApiSession, ApiUser, OrganizationMembershipDTO } from "../../shared/backend";
import { env } from "../config/env";
import { assertAnyOrganizationRole } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { createUserScopedSupabase, supabaseAdmin, supabasePublic } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";

export const authRouter = Router();

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  organizationName: z.string().min(2).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const oauthSchema = z.object({
  provider: z.enum(["google", "github", "gitlab", "azure", "bitbucket", "discord", "notion"]),
  redirectTo: z.string().url().optional(),
});

const acceptInviteSchema = z.object({
  token: z.string().min(12),
});

function toInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function mapSession(session: any): ApiSession | null {
  if (!session) return null;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
  };
}

function mapUser(user: any, fullName?: string | null): ApiUser {
  const nameFromUser = fullName ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "User";
  const provider = user.app_metadata?.provider === "google" ? "google" : "local";
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: nameFromUser,
    initials: toInitials(nameFromUser),
    provider,
  };
}

async function upsertProfile(params: { userId: string; fullName: string; email: string }) {
  await supabaseAdmin.from("profiles").upsert(
    {
      id: params.userId,
      full_name: params.fullName,
      email: params.email,
      initials: toInitials(params.fullName),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

authRouter.post("/signup", async (req, res, next) => {
  try {
    const input = signUpSchema.parse(req.body);

    const { data, error } = await supabasePublic.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
        },
      },
    });

    if (error) {
      throw new HttpError(400, error.message, "SIGNUP_FAILED");
    }
    if (!data.user) {
      throw new HttpError(500, "Sign-up did not return a user", "SIGNUP_NO_USER");
    }

    await upsertProfile({
      userId: data.user.id,
      fullName: input.fullName,
      email: input.email,
    });

    if (input.organizationName) {
      const slug = input.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);

      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name: input.organizationName,
          slug: `${slug}-${crypto.randomBytes(2).toString("hex")}`,
          created_by: data.user.id,
        })
        .select("id")
        .single();

      if (!orgError && org) {
        await supabaseAdmin.from("organization_members").upsert({
          organization_id: org.id,
          user_id: data.user.id,
          role: "owner",
          invited_by: data.user.id,
        });
      }
    }

    await writeAuditEvent({
      actorUserId: data.user.id,
      eventType: "auth.signup",
      entityType: "user",
      entityId: data.user.id,
    });

    res.status(201).json({
      user: mapUser(data.user, input.fullName),
      session: mapSession(data.session),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signin", async (req, res, next) => {
  try {
    const input = signInSchema.parse(req.body);
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user) {
      throw new HttpError(401, error?.message ?? "Invalid credentials", "SIGNIN_FAILED");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();

    await writeAuditEvent({
      actorUserId: data.user.id,
      eventType: "auth.signin",
      entityType: "user",
      entityId: data.user.id,
    });

    res.json({
      user: mapUser(data.user, profile?.full_name ?? null),
      session: mapSession(data.session),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/oauth", async (req, res, next) => {
  try {
    const input = oauthSchema.parse(req.body);
    const redirectTo = input.redirectTo ?? `${env.CLIENT_BASE_URL}/`;
    const { data, error } = await supabasePublic.auth.signInWithOAuth({
      provider: input.provider,
      options: { redirectTo },
    });

    if (error || !data.url) {
      throw new HttpError(400, error?.message ?? "OAuth init failed", "OAUTH_INIT_FAILED");
    }

    res.json({ url: data.url });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const input = refreshSchema.parse(req.body);
    const { data, error } = await supabasePublic.auth.refreshSession({
      refresh_token: input.refreshToken,
    });

    if (error) {
      throw new HttpError(401, error.message, "REFRESH_FAILED");
    }

    res.json({
      user: data.user ? mapUser(data.user) : null,
      session: mapSession(data.session),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signout", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const userClient = createUserScopedSupabase(authReq.auth.accessToken);
    await userClient.auth.signOut();

    await writeAuditEvent({
      actorUserId: authReq.auth.userId,
      eventType: "auth.signout",
      entityType: "user",
      entityId: authReq.auth.userId,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const userId = authReq.auth.userId;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, initials, email")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      throw new HttpError(500, profileError.message, "PROFILE_FETCH_FAILED");
    }

    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role, organizations(id, name, slug, created_at)")
      .eq("user_id", userId);
    if (membershipsError) {
      throw new HttpError(500, membershipsError.message, "MEMBERSHIP_FETCH_FAILED");
    }

    const membershipDtos: OrganizationMembershipDTO[] = (memberships ?? [])
      .map((membership: any) => {
        const org = Array.isArray(membership.organizations)
          ? membership.organizations[0]
          : membership.organizations;
        if (!org) return null;
        return {
          organizationId: membership.organization_id,
          role: membership.role,
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            createdAt: org.created_at,
          },
        };
      })
      .filter(Boolean) as OrganizationMembershipDTO[];

    const fullName = profile?.full_name ?? "User";
    const user: ApiUser = {
      id: userId,
      email: profile?.email ?? authReq.auth.email,
      fullName,
      initials: profile?.initials ?? toInitials(fullName),
      provider: "local",
    };

    res.json({
      user,
      memberships: membershipDtos,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/invites/accept", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = acceptInviteSchema.parse(req.body);
    const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex");

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("organization_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("accepted_at", null)
      .maybeSingle();

    if (inviteError) {
      throw new HttpError(500, inviteError.message, "INVITE_FETCH_FAILED");
    }
    if (!invite) {
      throw new HttpError(404, "Invite not found or already used", "INVITE_NOT_FOUND");
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      throw new HttpError(400, "Invite token has expired", "INVITE_EXPIRED");
    }

    await supabaseAdmin.from("organization_members").upsert({
      organization_id: invite.organization_id,
      user_id: authReq.auth.userId,
      role: invite.role,
      invited_by: invite.invited_by,
    });

    await supabaseAdmin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: authReq.auth.userId })
      .eq("id", invite.id);

    await writeAuditEvent({
      organizationId: invite.organization_id,
      actorUserId: authReq.auth.userId,
      eventType: "organization.invite.accepted",
      entityType: "organization_invite",
      entityId: invite.id,
    });

    res.json({ ok: true, organizationId: invite.organization_id, role: invite.role });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/admin/health", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

