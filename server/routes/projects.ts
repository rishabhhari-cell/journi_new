import { Router } from "express";
import { z } from "zod";
import { assertOrganizationRole, assertProjectEditable, getProjectAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";

export const projectsRouter = Router();

const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(2),
  description: z.string().default(""),
  status: z.enum(["active", "completed", "archived"]).default("active"),
  dueDate: z.string().datetime().optional(),
});

const patchProjectSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const patchTasksSchema = z.object({
  tasks: z.array(z.record(z.string(), z.unknown())),
});

const patchCollaboratorsSchema = z.object({
  collaborators: z.array(z.record(z.string(), z.unknown())),
});

const querySchema = z.object({
  organizationId: z.string().uuid(),
});

projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const query = querySchema.parse(req.query);
    await assertOrganizationRole(authReq.auth.userId, query.organizationId, "viewer");

    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*, project_members(user_id, role, can_edit, can_comment)")
      .eq("organization_id", query.organizationId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new HttpError(500, error.message, "PROJECT_LIST_FAILED");
    }

    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createProjectSchema.parse(req.body);
    await assertOrganizationRole(authReq.auth.userId, input.organizationId, "editor");

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert({
        organization_id: input.organizationId,
        title: input.title,
        description: input.description,
        status: input.status,
        due_date: input.dueDate ?? null,
        created_by: authReq.auth.userId,
      })
      .select("*")
      .single();

    if (projectError || !project) {
      throw new HttpError(400, projectError?.message ?? "Failed to create project", "PROJECT_CREATE_FAILED");
    }

    await supabaseAdmin.from("project_members").upsert({
      project_id: project.id,
      user_id: authReq.auth.userId,
      role: "owner",
      can_edit: true,
      can_comment: true,
    });

    await writeAuditEvent({
      organizationId: input.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "project.created",
      entityType: "project",
      entityId: project.id,
      payload: { title: input.title },
    });

    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:projectId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = patchProjectSchema.parse(req.body);
    const projectId = req.params.projectId;
    const access = await assertProjectEditable(authReq.auth.userId, projectId);

    const { data, error } = await supabaseAdmin
      .from("projects")
      .update({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Project update failed", "PROJECT_UPDATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "project.updated",
      entityType: "project",
      entityId: projectId,
      payload: input,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectsRouter.get("/:projectId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const access = await getProjectAccess(authReq.auth.userId, req.params.projectId);
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*, project_members(*), manuscripts(id, title, type, status, updated_at)")
      .eq("id", access.projectId)
      .single();
    if (error) {
      throw new HttpError(500, error.message, "PROJECT_FETCH_FAILED");
    }
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:projectId/tasks", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const { tasks } = patchTasksSchema.parse(req.body);
    await assertProjectEditable(authReq.auth.userId, req.params.projectId);

    const { error } = await supabaseAdmin
      .from("projects")
      .update({ tasks_json: tasks, updated_at: new Date().toISOString() })
      .eq("id", req.params.projectId);

    if (error) throw new HttpError(400, error.message, "PROJECT_TASKS_UPDATE_FAILED");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

projectsRouter.patch("/:projectId/collaborators", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const { collaborators } = patchCollaboratorsSchema.parse(req.body);
    await assertProjectEditable(authReq.auth.userId, req.params.projectId);

    const { error } = await supabaseAdmin
      .from("projects")
      .update({ collaborators_json: collaborators, updated_at: new Date().toISOString() })
      .eq("id", req.params.projectId);

    if (error) throw new HttpError(400, error.message, "PROJECT_COLLABORATORS_UPDATE_FAILED");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

projectsRouter.delete("/:projectId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const projectId = req.params.projectId;
    const access = await assertProjectEditable(authReq.auth.userId, projectId);

    const { error } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
    if (error) {
      throw new HttpError(400, error.message, "PROJECT_DELETE_FAILED");
    }

    await writeAuditEvent({
      organizationId: access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "project.deleted",
      entityType: "project",
      entityId: projectId,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});


