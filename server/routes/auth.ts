import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { ApiSession, ApiUser, OrganizationMembershipDTO } from "../../shared/backend";
import { env } from "../config/env";
import { assertAnyOrganizationRole } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { createUserScopedSupabase, supabaseAdmin, supabasePublic } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../services/email.service";

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

const resendVerificationSchema = z.object({
  email: z.string().email(),
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
function mapMembershipRows(rows: any[]): OrganizationMembershipDTO[] {
  return (rows ?? [])
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
}

async function autoCreateOrg(userId: string, fullName: string): Promise<OrganizationMembershipDTO[]> {
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

  if (!newOrg) return [];

  await supabaseAdmin.from("organization_members").upsert({
    organization_id: newOrg.id,
    user_id: userId,
    role: "owner",
    invited_by: userId,
  });

  return [
    {
      organizationId: newOrg.id,
      role: "owner",
      organization: { id: newOrg.id, name: newOrg.name, slug: newOrg.slug, createdAt: newOrg.created_at },
    },
  ];
}

async function fetchMembershipsWithAutoOrg(
  userId: string,
  fullName: string,
): Promise<OrganizationMembershipDTO[]> {
  const { data: rows } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, created_at)")
    .eq("user_id", userId);

  const dtos = mapMembershipRows(rows ?? []);
  if (dtos.length === 0) return autoCreateOrg(userId, fullName);
  return dtos;
}

async function upsertProfile(params: { userId: string; fullName: string; email: string }) {
  await supabaseAdmin.from("profiles").upsert(
    {
      id: params.userId,
      full_name: params.fullName,
      email: normalizeEmail(params.email),
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

async function hasWelcomeEmailBeenSent(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("audit_events")
    .select("id")
    .eq("actor_user_id", userId)
    .eq("event_type", "email.welcome.sent")
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("Failed to query welcome-email audit event", {
      userId,
      error: error.message,
    });
    return false;
  }

  return Boolean(data?.id);
}

async function maybeSendWelcomeEmail(input: {
  userId: string;
  to: string;
  fullName: string;
  verificationUrl?: string;
}): Promise<boolean> {
  if (!input.to) return false;

  const alreadySent = await hasWelcomeEmailBeenSent(input.userId);
  if (alreadySent) return false;

  const sent = await sendWelcomeEmail({
    to: input.to,
    fullName: input.fullName,
    verificationUrl: input.verificationUrl,
  });
  if (!sent) return false;

  await writeAuditEvent({
    actorUserId: input.userId,
    eventType: "email.welcome.sent",
    entityType: "user",
    entityId: input.userId,
    payload: {
      email: input.to,
      mode: input.verificationUrl ? "verification" : "welcome",
    },
  });

  return true;
}

async function resendPendingSignupEmail(email: string): Promise<boolean> {
  const { error } = await supabasePublic.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${env.CLIENT_BASE_URL}/`,
    },
  });

  if (error) {
    logger.warn("Failed to resend Supabase signup confirmation email", {
      email,
      error: error.message,
    });
    return false;
  }

  return true;
}

function queueSignupVerificationRetry(input: { email: string; userId: string; delayMs?: number }) {
  const delayMs = input.delayMs ?? 65_000;

  setTimeout(() => {
    void (async () => {
      const sent = await resendPendingSignupEmail(input.email);

      await writeAuditEvent({
        actorUserId: input.userId,
        eventType: sent ? "email.signup_verification.resent" : "email.signup_verification.failed",
        entityType: "user",
        entityId: input.userId,
        payload: {
          email: input.email,
          source: "delayed_retry",
        },
      });
    })();
  }, delayMs);
}

async function findExistingUserByEmail(email: string): Promise<{ fullName: string; user: any | null }> {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .ilike("email", email)
    .maybeSingle();

  if (profileError) {
    logger.warn("Failed to look up existing profile by email", {
      email,
      error: profileError.message,
    });
    return {
      fullName: email.split("@")[0] ?? "User",
      user: null,
    };
  }

  if (!profile?.id) {
    return {
      fullName: email.split("@")[0] ?? "User",
      user: null,
    };
  }

  const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (authUserError) {
    logger.warn("Failed to load existing auth user by profile email", {
      email,
      userId: profile.id,
      error: authUserError.message,
    });
  }

  return {
    fullName: profile.full_name ?? email.split("@")[0] ?? "User",
    user: authUserResult?.user ?? null,
  };
}

function isAlreadyRegisteredError(message: string | undefined): boolean {
  return /already registered/i.test(message ?? "");
}

async function sendSignupVerificationEmail(input: {
  userId: string;
  email: string;
  fullName: string;
  verificationUrl: string;
}): Promise<{ sent: boolean; retryScheduled: boolean }> {
  const customSent = await maybeSendWelcomeEmail({
    userId: input.userId,
    to: input.email,
    fullName: input.fullName,
    verificationUrl: input.verificationUrl,
  });

  if (customSent) {
    return { sent: true, retryScheduled: false };
  }

  queueSignupVerificationRetry({
    email: input.email,
    userId: input.userId,
  });

  await writeAuditEvent({
    actorUserId: input.userId,
    eventType: "email.signup_verification.failed",
    entityType: "user",
    entityId: input.userId,
    payload: {
      email: input.email,
      source: "initial_signup_send",
      retryScheduled: true,
    },
  });

  return { sent: false, retryScheduled: true };
}

authRouter.post("/signup", async (req, res, next) => {
  try {
    const parsedInput = signUpSchema.parse(req.body);
    const input = {
      ...parsedInput,
      email: normalizeEmail(parsedInput.email),
      fullName: parsedInput.fullName.trim(),
      organizationName: parsedInput.organizationName?.trim(),
    };

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email: input.email,
      password: input.password,
      options: {
        redirectTo: `${env.CLIENT_BASE_URL}/`,
        data: {
          full_name: input.fullName,
        },
      },
    });

    if (error) {
      if (isAlreadyRegisteredError(error.message)) {
        const existing = await findExistingUserByEmail(input.email);
        const existingUser = existing.user;
        const alreadyVerified = Boolean(existingUser?.email_confirmed_at || existingUser?.confirmed_at);

        if (alreadyVerified) {
          throw new HttpError(409, "An account with this email already exists. Please sign in instead.", "USER_ALREADY_EXISTS");
        }

        const verificationEmailSent = await resendPendingSignupEmail(input.email);

        res.status(200).json({
          user: existingUser
            ? mapUser(existingUser, existing.fullName)
            : {
                id: "",
                email: input.email,
                fullName: existing.fullName,
                initials: toInitials(existing.fullName),
                provider: "local" as const,
              },
          session: null,
          memberships: [],
          projects: [],
          requiresEmailVerification: true,
          verificationEmailSent,
          existingAccount: true,
        });
        return;
      }

      throw new HttpError(400, error.message, "SIGNUP_FAILED");
    }
    if (!data.user) {
      throw new HttpError(500, "Sign-up did not return a user", "SIGNUP_NO_USER");
    }
    if (!data.properties?.action_link) {
      throw new HttpError(500, "Sign-up verification link was not generated", "SIGNUP_NO_VERIFICATION_LINK");
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

    const verificationResult = await sendSignupVerificationEmail({
      userId: data.user.id,
      email: input.email,
      fullName: input.fullName,
      verificationUrl: data.properties.action_link,
    });

    res.status(201).json({
      user: mapUser(data.user, input.fullName),
      session: null,
      memberships: membershipDtos,
      projects: initialProjects,
      requiresEmailVerification: true,
      verificationEmailSent: verificationResult.sent,
      verificationRetryScheduled: verificationResult.retryScheduled,
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

    // Run profile + membership SELECT + audit in parallel (saves one sequential round-trip)
    const [{ data: profile }, { data: membershipRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle(),
      supabaseAdmin
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, slug, created_at)")
        .eq("user_id", data.user.id),
      writeAuditEvent({
        actorUserId: data.user.id,
        eventType: "auth.signin",
        entityType: "user",
        entityId: data.user.id,
      }),
    ]);

    const fullName = profile?.full_name ?? null;

    // Process membership rows; auto-create workspace only if user has none (rare for returning users)
    let membershipDtos = mapMembershipRows(membershipRows ?? []);
    if (membershipDtos.length === 0) {
      membershipDtos = await autoCreateOrg(data.user.id, fullName ?? data.user.email ?? "User");
    }

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

authRouter.post("/oauth/callback", async (req, res, next) => {
  try {
    const { code, codeVerifier } = z
      .object({ code: z.string().min(1), codeVerifier: z.string().min(1) })
      .parse(req.body);

    // Exchange PKCE code + verifier directly with Supabase's token endpoint
    const tokenRes = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({})) as Record<string, unknown>;
      throw new HttpError(400, String(err.message ?? "OAuth code exchange failed"), "OAUTH_EXCHANGE_FAILED");
    }

    const tokenData = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      user?: { id?: string };
    };

    const session: ApiSession = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at ?? null,
    };

    res.json({ session });
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

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: input.email,
      options: {
        redirectTo,
      },
    });

    // Keep response generic so we don't reveal whether the email exists.
    if (!error && data?.properties?.action_link) {
      const fullName =
        data.user?.user_metadata?.full_name ??
        data.user?.user_metadata?.name ??
        undefined;

      void (async () => {
        const sent = await sendPasswordResetEmail({
          to: input.email,
          fullName,
          resetUrl: data.properties.action_link,
        });

        if (!sent || !data.user?.id) return;

        await writeAuditEvent({
          actorUserId: data.user.id,
          eventType: "email.password_reset.sent",
          entityType: "user",
          entityId: data.user.id,
          payload: {
            email: input.email,
          },
        });
      })();
    }

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

    await maybeSendWelcomeEmail({
      userId,
      to: user.email,
      fullName,
    });

    res.json({
      user,
      memberships: membershipDtos,
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/signup/resend-verification", async (req, res, next) => {
  try {
    const input = resendVerificationSchema.parse(req.body);
    const email = normalizeEmail(input.email);
    const existing = await findExistingUserByEmail(email);
    const authUser = existing.user;
    const alreadyVerified = Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at);

    if (alreadyVerified) {
      res.json({ ok: true, sent: false, alreadyVerified: true });
      return;
    }

    const sent = await resendPendingSignupEmail(email);

    if (sent && authUser?.id) {
      await writeAuditEvent({
        actorUserId: authUser.id,
        eventType: "email.signup_verification.resent",
        entityType: "user",
        entityId: authUser.id,
        payload: {
          email,
        },
      });
    }

    res.json({ ok: true, sent, alreadyVerified: false });
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

// GET /auth/admin/email-debug — inspect email config + recent email/auth audit events
authRouter.get("/admin/email-debug", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    const query = emailDebugQuerySchema.parse(req.query);

    const config = {
      resendApiKeyConfigured: Boolean(env.RESEND_API_KEY),
      mailFrom: env.MAIL_FROM,
      mailReplyTo: env.MAIL_REPLY_TO,
      supportEmail: env.SUPPORT_EMAIL,
      templateIds: {
        welcome: env.RESEND_WELCOME_TEMPLATE_ID ?? null,
        organizationInvite: env.RESEND_ORG_INVITE_TEMPLATE_ID ?? null,
        mention: env.RESEND_MENTION_TEMPLATE_ID ?? null,
        passwordReset: env.RESEND_PASSWORD_RESET_TEMPLATE_ID ?? null,
      },
      resetPasswordRedirectUrl: env.RESET_PASSWORD_REDIRECT_URL ?? `${env.CLIENT_BASE_URL}/reset-password`,
    };

    const { data: rows, error } = await supabaseAdmin
      .from("audit_events")
      .select("id, created_at, event_type, actor_user_id, entity_type, entity_id, payload")
      .order("created_at", { ascending: false })
      .limit(Math.max(query.limit * 3, 60));

    if (error) {
      throw new HttpError(500, error.message, "EMAIL_DEBUG_FETCH_FAILED");
    }

    const filtered = (rows ?? [])
      .filter((row: any) => {
        const eventType = String(row.event_type ?? "");
        return eventType.startsWith("email.") || eventType.startsWith("auth.");
      })
      .slice(0, query.limit);

    const actorIds = Array.from(
      new Set(
        filtered
          .map((row: any) => row.actor_user_id)
          .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    let profileMap = new Map<string, { fullName: string | null; email: string | null }>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);
      profileMap = new Map(
        (profiles ?? []).map((profile: any) => [
          profile.id,
          { fullName: profile.full_name ?? null, email: profile.email ?? null },
        ]),
      );
    }

    const recentEvents = filtered.map((row: any) => {
      const actor = row.actor_user_id ? profileMap.get(row.actor_user_id) : null;
      return {
        id: row.id,
        createdAt: row.created_at,
        eventType: row.event_type,
        actorUserId: row.actor_user_id ?? null,
        actorFullName: actor?.fullName ?? null,
        actorEmail: actor?.email ?? null,
        entityType: row.entity_type ?? null,
        entityId: row.entity_id ?? null,
        payload: row.payload ?? {},
      };
    });

    const warnings: string[] = [];
    if (!config.resendApiKeyConfigured) warnings.push("RESEND_API_KEY is not configured.");
    if (!config.templateIds.welcome) warnings.push("RESEND_WELCOME_TEMPLATE_ID is not configured.");
    if (!config.templateIds.organizationInvite) warnings.push("RESEND_ORG_INVITE_TEMPLATE_ID is not configured.");
    if (!config.templateIds.passwordReset) warnings.push("RESEND_PASSWORD_RESET_TEMPLATE_ID is not configured.");
    if (recentEvents.length === 0) warnings.push("No recent auth/email audit events found.");
    if (!recentEvents.some((event) => event.eventType.startsWith("email."))) {
      warnings.push("No recent email.* events found. Emails may not be triggering or may be failing before audit write.");
    }

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      config,
      warnings,
      recentEvents,
    });
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

const emailDebugQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
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

