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
import { sendWelcomeEmail } from "../services/email.service";

export const authRouter = Router();

/** Look up the email domain against institution_domains and auto-enroll if matched. */
async function autoEnrollInstitutionMember(userId: string, email: string): Promise<void> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return;

  const { data } = await supabaseAdmin
    .from("institution_domains")
    .select("organization_id, default_role")
    .eq("domain", domain)
    .maybeSingle();

  if (!data) return;

  await supabaseAdmin.from("organization_members").upsert(
    {
      organization_id: data.organization_id,
      user_id: userId,
      role: data.default_role,
      invited_by: null,
    },
    { onConflict: "organization_id,user_id", ignoreDuplicates: true },
  );
}

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8),
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

/** Fetch memberships for a user, auto-creating a personal workspace if none exist. */
async function fetchMembershipsWithAutoOrg(
  userId: string,
  fullName: string,
): Promise<OrganizationMembershipDTO[]> {
  const { data: memberships } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, created_at)")
    .eq("user_id", userId);

  let dtos: OrganizationMembershipDTO[] = (memberships ?? [])
    .map((m: any) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      if (!org) return null;
      return {
        organizationId: m.organization_id,
        role: m.role,
        organization: { id: org.id, name: org.name, slug: org.slug, createdAt: org.created_at },
      };
    })
    .filter(Boolean) as OrganizationMembershipDTO[];

  if (dtos.length === 0) {
    const wsName = `${fullName}'s Workspace`;
    const slug =
      wsName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) +
      "-" +
      crypto.randomBytes(2).toString("hex");

    const { data: newOrg } = await supabaseAdmin
      .from("organizations")
      .insert({ name: wsName, slug, created_by: userId })
      .select("id, name, slug, created_at")
      .single();

    if (newOrg) {
      await supabaseAdmin.from("organization_members").upsert({
        organization_id: newOrg.id,
        user_id: userId,
        role: "owner",
        invited_by: userId,
      });
      dtos = [
        {
          organizationId: newOrg.id,
          role: "owner",
          organization: { id: newOrg.id, name: newOrg.name, slug: newOrg.slug, createdAt: newOrg.created_at },
        },
      ];
    }
  }

  return dtos;
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

async function fetchInitialProjects(organizationId: string | undefined) {
  if (!organizationId) return [];
  const { data } = await supabaseAdmin
    .from("projects")
    .select("*, project_members(user_id, role, can_edit, can_comment)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  return data ?? [];
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

    // Auto-enroll into institution org if email domain is registered
    await autoEnrollInstitutionMember(data.user.id, input.email);

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

    // Fetch memberships inline (includes auto-created workspace + any institution enrollment).
    // Run memberships + audit in parallel; projects depend on memberships so they run after.
    const [membershipDtos] = await Promise.all([
      fetchMembershipsWithAutoOrg(data.user.id, input.fullName),
      writeAuditEvent({
        actorUserId: data.user.id,
        eventType: "auth.signup",
        entityType: "user",
        entityId: data.user.id,
      }),
    ]);
    const initialProjects = await fetchInitialProjects(membershipDtos[0]?.organizationId);

    void sendWelcomeEmail({
      to: input.email,
      fullName: input.fullName,
    });

    res.status(201).json({
      user: mapUser(data.user, input.fullName),
      session: mapSession(data.session),
      memberships: membershipDtos,
      projects: initialProjects,
      requiresEmailVerification: !data.session,
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

    // Run profile fetch + audit in parallel (profile provides fullName for workspace naming)
    const [{ data: profile }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle(),
      writeAuditEvent({
        actorUserId: data.user.id,
        eventType: "auth.signin",
        entityType: "user",
        entityId: data.user.id,
      }),
    ]);

    const fullName = profile?.full_name ?? null;

    // Fetch memberships (may auto-create workspace for new users), then projects
    const membershipDtos = await fetchMembershipsWithAutoOrg(
      data.user.id,
      fullName ?? data.user.email ?? "User",
    );
    const initialProjects = await fetchInitialProjects(membershipDtos[0]?.organizationId);

    res.json({
      user: mapUser(data.user, fullName),
      session: mapSession(data.session),
      memberships: membershipDtos,
      projects: initialProjects,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/oauth", async (req, res, next) => {
  try {
    const input = oauthSchema.parse(req.body);
    const redirectTo = input.redirectTo ?? `${env.CLIENT_BASE_URL}/`;

    // PKCE flow: generate a random code_verifier, derive the code_challenge via
    // S256, and include both in the authorize URL. The frontend must store the
    // verifier (sessionStorage) and exchange it at /auth/v1/token after redirect.
    const codeVerifier = crypto.randomBytes(64).toString("base64url");
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    const authorizeUrl = new URL(`${env.SUPABASE_URL}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", input.provider);
    authorizeUrl.searchParams.set("redirect_to", redirectTo);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("response_type", "code");

    res.json({ url: authorizeUrl.toString(), codeVerifier });
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

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const input = forgotPasswordSchema.parse(req.body);
    const redirectTo = env.RESET_PASSWORD_REDIRECT_URL ?? `${env.CLIENT_BASE_URL}/reset-password`;

    const { error } = await supabasePublic.auth.resetPasswordForEmail(input.email, {
      redirectTo,
    });

    if (error) {
      throw new HttpError(400, error.message, "FORGOT_PASSWORD_FAILED");
    }

    // Generic success response - do not disclose whether email exists.
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/update-password", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = updatePasswordSchema.parse(req.body);
    const userClient = createUserScopedSupabase(authReq.auth.accessToken);

    const { error } = await userClient.auth.updateUser({ password: input.password });
    if (error) {
      throw new HttpError(400, error.message, "UPDATE_PASSWORD_FAILED");
    }

    await writeAuditEvent({
      actorUserId: authReq.auth.userId,
      eventType: "auth.password.updated",
      entityType: "user",
      entityId: authReq.auth.userId,
    });

    res.json({ ok: true });
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

    // Fetch profile + auth user in parallel
    const [profileResult, authUserResult] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, initials, email").eq("id", userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(userId),
    ]);
    if (profileResult.error) {
      throw new HttpError(500, profileResult.error.message, "PROFILE_FETCH_FAILED");
    }
    let profile = profileResult.data;
    const rawAuthUser = authUserResult.data?.user;

    // First-time OAuth user — no profile row yet; auto-create it from Google metadata.
    if (!profile) {
      const oauthName =
        rawAuthUser?.user_metadata?.full_name ??
        rawAuthUser?.user_metadata?.name ??
        (rawAuthUser?.email ?? authReq.auth.email).split("@")[0] ??
        "User";
      const oauthEmail = rawAuthUser?.email ?? authReq.auth.email;
      await upsertProfile({ userId, fullName: oauthName, email: oauthEmail });
      await autoEnrollInstitutionMember(userId, oauthEmail);
      profile = { full_name: oauthName, initials: toInitials(oauthName), email: oauthEmail };
    }

    const fullName = profile?.full_name ?? "User";
    const membershipDtos = await fetchMembershipsWithAutoOrg(userId, fullName);

    const providerStr = rawAuthUser?.app_metadata?.provider;
    const provider: ApiUser["provider"] = providerStr === "google" ? "google" : "local";
    const user: ApiUser = {
      id: userId,
      email: profile?.email ?? authReq.auth.email,
      fullName,
      initials: profile?.initials ?? toInitials(fullName),
      provider,
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

    const inviteEmail = String(invite.email ?? "").trim().toLowerCase();
    const authedEmail = String(authReq.auth.email ?? "").trim().toLowerCase();
    if (!inviteEmail || !authedEmail || inviteEmail !== authedEmail) {
      throw new HttpError(403, "Invite email does not match authenticated user", "INVITE_EMAIL_MISMATCH");
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

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100),
});

authRouter.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = updateProfileSchema.parse(req.body);
    await upsertProfile({
      userId: authReq.auth.userId,
      fullName: input.fullName,
      email: authReq.auth.email,
    });
    const { data: rawUser } = await supabaseAdmin.auth.admin.getUserById(authReq.auth.userId);
    const providerStr = rawUser?.user?.app_metadata?.provider;
    const provider: ApiUser["provider"] = providerStr === "google" ? "google" : "local";
    const user: ApiUser = {
      id: authReq.auth.userId,
      email: authReq.auth.email,
      fullName: input.fullName,
      initials: toInitials(input.fullName),
      provider,
    };
    res.json({ user });
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

const institutionDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .transform((d) => d.toLowerCase().replace(/^@/, "")),
  organizationId: z.string().uuid(),
  defaultRole: z.enum(["viewer", "editor", "admin"]).default("viewer"),
});

// POST /auth/admin/institution-domains — register an email domain → org mapping
authRouter.post("/admin/institution-domains", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    const input = institutionDomainSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from("institution_domains")
      .upsert(
        {
          domain: input.domain,
          organization_id: input.organizationId,
          default_role: input.defaultRole,
          created_by: authReq.auth.userId,
        },
        { onConflict: "domain" },
      )
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Failed to register domain", "DOMAIN_REGISTER_FAILED");
    }

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

// DELETE /auth/admin/institution-domains/:domain — remove a domain mapping
authRouter.delete("/admin/institution-domains/:domain", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    const domain = req.params.domain.toLowerCase();

    const { error } = await supabaseAdmin
      .from("institution_domains")
      .delete()
      .eq("domain", domain);

    if (error) {
      throw new HttpError(400, error.message, "DOMAIN_DELETE_FAILED");
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// GET /auth/admin/institution-domains — list all registered domains
authRouter.get("/admin/institution-domains", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");

    const { data, error } = await supabaseAdmin
      .from("institution_domains")
      .select("id, domain, organization_id, default_role, created_at, organizations(name)")
      .order("domain");

    if (error) throw new HttpError(500, error.message, "DOMAINS_LIST_FAILED");
    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

