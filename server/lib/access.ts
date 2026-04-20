import { env } from "../config/env";
import type { OrgRole } from "../../shared/backend";
import { HttpError } from "./http-error";
import { supabaseAdmin } from "./supabase";

const roleRank: Record<OrgRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function roleMeetsRequirement(role: OrgRole, minimum: OrgRole): boolean {
  return roleRank[role] >= roleRank[minimum];
}

function normalizeRole(role: string | null | undefined): OrgRole | null {
  if (!role) return null;
  if (role === "viewer" || role === "editor" || role === "admin" || role === "owner") {
    return role;
  }
  return null;
}

function getInternalAdminEmails(): Set<string> {
  return new Set(
    (env.INTERNAL_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0),
  );
}

export async function getOrganizationRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to read organization membership", "ORG_MEMBERSHIP_READ_FAILED");
  }

  return normalizeRole(data?.role);
}

export async function assertOrganizationRole(
  userId: string,
  organizationId: string,
  minimum: OrgRole,
): Promise<OrgRole> {
  const role = await getOrganizationRole(userId, organizationId);
  if (!role) {
    throw new HttpError(403, "You are not a member of this organization", "ORG_ACCESS_DENIED");
  }
  if (!roleMeetsRequirement(role, minimum)) {
    throw new HttpError(403, `Requires ${minimum} access`, "ORG_ROLE_INSUFFICIENT");
  }
  return role;
}

export async function assertAnyOrganizationRole(userId: string, minimum: OrgRole): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    throw new HttpError(500, "Failed to read organization memberships", "ORG_MEMBERSHIP_LIST_FAILED");
  }

  const hasAccess = (data ?? []).some((row: { role: string | null }) => {
    const role = normalizeRole(row.role);
    return role ? roleMeetsRequirement(role, minimum) : false;
  });

  if (!hasAccess) {
    throw new HttpError(403, `Requires ${minimum} role in at least one organization`, "ORG_ROLE_INSUFFICIENT");
  }
}

export async function assertInternalAdmin(userId: string): Promise<void> {
  const allowedEmails = getInternalAdminEmails();
  if (allowedEmails.size === 0) {
    throw new HttpError(403, "Internal admin access is not configured", "INTERNAL_ADMIN_NOT_CONFIGURED");
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    throw new HttpError(500, "Failed to read authenticated user", "AUTH_USER_READ_FAILED");
  }

  const email = data.user?.email?.trim().toLowerCase();
  if (!email || !allowedEmails.has(email)) {
    throw new HttpError(403, "Internal admin access denied", "INTERNAL_ADMIN_ACCESS_DENIED");
  }
}

export interface ProjectAccessContext {
  projectId: string;
  organizationId: string;
  orgRole: OrgRole | null;
  projectRole: OrgRole | null;
  canEdit: boolean;
  canComment: boolean;
}

function strongestRole(a: OrgRole | null, b: OrgRole | null): OrgRole | null {
  if (!a) return b;
  if (!b) return a;
  return roleRank[a] >= roleRank[b] ? a : b;
}

export async function getProjectAccess(userId: string, projectId: string): Promise<ProjectAccessContext> {
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new HttpError(500, "Failed to read project", "PROJECT_READ_FAILED");
  }
  if (!project) {
    throw new HttpError(404, "Project not found", "PROJECT_NOT_FOUND");
  }

  const orgRole = await getOrganizationRole(userId, project.organization_id);

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("project_members")
    .select("role, can_edit, can_comment")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    throw new HttpError(500, "Failed to read project membership", "PROJECT_MEMBERSHIP_READ_FAILED");
  }

  const projectRole = normalizeRole(membership?.role);
  const effectiveRole = strongestRole(orgRole, projectRole);

  if (!effectiveRole) {
    throw new HttpError(403, "You do not have access to this project", "PROJECT_ACCESS_DENIED");
  }

  const canEdit =
    roleMeetsRequirement(effectiveRole, "editor") || Boolean(membership?.can_edit);
  const canComment = canEdit || roleMeetsRequirement(effectiveRole, "viewer") || Boolean(membership?.can_comment);

  return {
    projectId: project.id,
    organizationId: project.organization_id,
    orgRole,
    projectRole,
    canEdit,
    canComment,
  };
}

export async function assertProjectEditable(userId: string, projectId: string): Promise<ProjectAccessContext> {
  const access = await getProjectAccess(userId, projectId);
  if (!access.canEdit) {
    throw new HttpError(403, "Project edit access is required", "PROJECT_EDIT_FORBIDDEN");
  }
  return access;
}

export async function assertManuscriptAccess(
  userId: string,
  manuscriptId: string,
  requireEdit = false,
): Promise<{ manuscriptId: string; projectId: string; access: ProjectAccessContext }> {
  const { data, error } = await supabaseAdmin
    .from("manuscripts")
    .select("id, project_id")
    .eq("id", manuscriptId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to read manuscript", "MANUSCRIPT_READ_FAILED");
  }
  if (!data) {
    throw new HttpError(404, "Manuscript not found", "MANUSCRIPT_NOT_FOUND");
  }

  const access = requireEdit
    ? await assertProjectEditable(userId, data.project_id)
    : await getProjectAccess(userId, data.project_id);

  if (!requireEdit && !access.canComment) {
    throw new HttpError(403, "Manuscript access denied", "MANUSCRIPT_ACCESS_DENIED");
  }

  return {
    manuscriptId: data.id,
    projectId: data.project_id,
    access,
  };
}
