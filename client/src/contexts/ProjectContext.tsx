import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Project, Task, Collaborator, Activity, TaskFormData, CollaboratorFormData } from '@/types';
import { generateSampleProject, generateSampleProject2, generateActivities } from '@/data/generators';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProjects,
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  type ApiProject,
} from '@/lib/api/backend';

const PROJECTS_KEY = 'journi_projects';
const ACTIVE_PROJECT_KEY = 'journi_active_project_id';
const ACTIVITIES_KEY = 'journi_activities';
const OVERLAYS_KEY = 'journi_project_overlays';

interface ProjectOverlay {
  tasks: Task[];
  collaborators: Collaborator[];
}

interface ProjectContextType {
  projects: Project[];
  activeProject: Project;
  activities: Activity[];
  setActiveProjectId: (id: string) => void;
  createProject: (title: string, description?: string) => Project;
  deleteProject: (id: string) => void;
  addTask: (task: TaskFormData) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  addCollaborator: (collaborator: CollaboratorFormData) => void;
  removeCollaborator: (collaboratorId: string) => void;
  updateCollaborator: (collaboratorId: string, updates: Partial<Collaborator>) => void;
  getTask: (taskId: string) => Task | undefined;
  getCollaborator: (collaboratorId: string) => Collaborator | undefined;
  project: Project;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Deterministic fake ORCID for sample collaborators that predate the ORCID field
function backfillOrcid(c: Collaborator): Collaborator {
  if (c.orcidId) return c;
  // Use a simple hash of the id to decide ~75% get one, and to generate stable digits
  const hash = c.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (hash % 4 === 0) return c; // ~25% have none
  const seg = (n: number) => String(1000 + (Math.abs(n) % 9000)).padStart(4, '0');
  return { ...c, orcidId: `${seg(hash)}-${seg(hash * 7)}-${seg(hash * 13)}-${seg(hash * 19)}` };
}

function rehydrateProject(p: Project): Project {
  return {
    ...p,
    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
    tasks: (p.tasks || []).map((t) => ({
      ...t,
      startDate: t.startDate ? new Date(t.startDate) : new Date(),
      endDate: t.endDate ? new Date(t.endDate) : new Date(),
    })),
    collaborators: (p.collaborators || []).map(backfillOrcid),
  };
}

function rehydrateActivities(acts: Activity[]): Activity[] {
  return acts.map((a) => ({ ...a, timestamp: a.timestamp ? new Date(a.timestamp) : new Date() }));
}

function createFallbackProject(): Project {
  return generateSampleProject();
}

function loadOverlays(): Record<string, ProjectOverlay> {
  try {
    const raw = localStorage.getItem(OVERLAYS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ProjectOverlay>;
    const next: Record<string, ProjectOverlay> = {};
    for (const [projectId, overlay] of Object.entries(parsed)) {
      next[projectId] = {
        tasks: (overlay.tasks ?? []).map((task) => ({
          ...task,
          startDate: task.startDate ? new Date(task.startDate) : new Date(),
          endDate: task.endDate ? new Date(task.endDate) : new Date(),
        })),
        collaborators: overlay.collaborators ?? [],
      };
    }
    return next;
  } catch {
    return {};
  }
}

function saveOverlays(projects: Project[]) {
  const payload: Record<string, ProjectOverlay> = {};
  for (const project of projects) {
    payload[project.id] = {
      tasks: project.tasks,
      collaborators: project.collaborators,
    };
  }
  localStorage.setItem(OVERLAYS_KEY, JSON.stringify(payload));
}

function mapApiProjectToUi(apiProject: ApiProject, overlays: Record<string, ProjectOverlay>): Project {
  const overlay = overlays[apiProject.id];
  const generatedCollaborators: Collaborator[] = (apiProject.project_members ?? []).map((member) => ({
    id: member.user_id,
    name: `Member ${member.user_id.slice(0, 6)}`,
    email: `${member.user_id.slice(0, 8)}@unknown.local`,
    role: 'contributor',
    initials: member.user_id.slice(0, 2).toUpperCase(),
    online: false,
  }));

  return {
    id: apiProject.id,
    title: apiProject.title,
    description: apiProject.description ?? '',
    status: apiProject.status,
    createdAt: new Date(apiProject.created_at),
    updatedAt: new Date(apiProject.updated_at),
    dueDate: apiProject.due_date ? new Date(apiProject.due_date) : undefined,
    tasks: overlay?.tasks ?? [],
    collaborators: overlay?.collaborators ?? generatedCollaborators,
  };
}

function initProjects(): { projects: Project[]; activeId: string } {
  try {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (stored) {
      const parsed: Project[] = JSON.parse(stored);
      if (parsed.length > 0) {
        const projects = parsed.map(rehydrateProject);
        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY) || projects[0].id;
        return { projects, activeId };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  const p1 = generateSampleProject();
  const p2 = generateSampleProject2();
  return { projects: [p1, p2], activeId: p1.id };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, isTrial, activeOrganizationId } = useAuth();
  const backendMode = Boolean(user && !isTrial && activeOrganizationId);

  const fallbackProject = useMemo(() => createFallbackProject(), []);
  const [{ projects, activeId }, setState] = useState(initProjects);

  const [activities, setActivities] = useState<Activity[]>(() => {
    try {
      const stored = localStorage.getItem(ACTIVITIES_KEY);
      if (stored) return rehydrateActivities(JSON.parse(stored));
    } catch {
      // ignore corrupted storage
    }
    const initial = initProjects();
    const active = initial.projects.find((p) => p.id === initial.activeId) || initial.projects[0];
    return generateActivities(active.collaborators);
  });

  const setProjects = useCallback((updated: Project[], newActiveId?: string) => {
    const nextProjects = updated.length > 0 ? updated : [fallbackProject];
    const preferredActiveId = newActiveId ?? activeId;
    const resolvedActiveId = nextProjects.some((project) => project.id === preferredActiveId)
      ? preferredActiveId
      : nextProjects[0].id;

    setState({ projects: nextProjects, activeId: resolvedActiveId });
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
    localStorage.setItem(ACTIVE_PROJECT_KEY, resolvedActiveId);
    saveOverlays(nextProjects);
  }, [activeId, fallbackProject]);

  // Persist once on mount to save any backfilled fields (e.g. ORCID migration)
  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    saveOverlays(projects);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    let cancelled = false;
    if (!backendMode || !activeOrganizationId) {
      return;
    }

    (async () => {
      try {
        const response = await fetchProjects(activeOrganizationId);
        if (cancelled) return;

        const overlays = loadOverlays();
        let mapped = response.data.map((project) => mapApiProjectToUi(project, overlays));

        if (mapped.length === 0) {
          const created = await createProjectApi({
            organizationId: activeOrganizationId,
            title: 'My First Project',
            description: '',
          });
          mapped = [mapApiProjectToUi(created.data, overlays)];
        }

        const preferredActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY) || mapped[0].id;
        setProjects(mapped, preferredActiveId);
      } catch {
        // Keep local state if backend fetch fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [backendMode, activeOrganizationId, setProjects]);

  const activeProject =
    projects.find((p) => p.id === activeId) ||
    projects[0] ||
    fallbackProject;

  const setActiveProjectId = (id: string) => {
    setState((prev) => ({ ...prev, activeId: id }));
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  };

  const createProject = (title: string, description = ''): Project => {
    const optimisticProject: Project = {
      id: nanoid(),
      title,
      description,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [],
      collaborators: [],
    };

    setProjects([...projects, optimisticProject], optimisticProject.id);

    if (backendMode && activeOrganizationId) {
      void (async () => {
        try {
          const created = await createProjectApi({
            organizationId: activeOrganizationId,
            title,
            description,
          });
          const overlays = loadOverlays();
          const mapped = mapApiProjectToUi(created.data, overlays);
          setProjects(
            projects
              .filter((project) => project.id !== optimisticProject.id)
              .concat({ ...mapped, tasks: optimisticProject.tasks, collaborators: optimisticProject.collaborators }),
            mapped.id,
          );
        } catch {
          // Keep optimistic project locally if backend creation fails.
        }
      })();
    }

    return optimisticProject;
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((p) => p.id !== id);
    const newActiveId = id === activeId ? updated[0].id : activeId;
    setProjects(updated, newActiveId);

    if (backendMode) {
      void deleteProjectApi(id).catch(() => {
        // Keep optimistic deletion if backend call fails.
      });
    }
  };

  const updateActive = (updater: (p: Project) => Project) => {
    const updated = projects.map((project) =>
      project.id === activeProject.id ? updater(project) : project,
    );
    setProjects(updated, activeProject.id);
  };

  const addTask = (taskData: TaskFormData) => {
    const newTask: Task = { id: nanoid(), ...taskData };
    updateActive((project) => ({
      ...project,
      tasks: [...project.tasks, newTask],
      updatedAt: new Date(),
    }));
    const currentUser = activeProject.collaborators[0];
    if (currentUser) {
      setActivities((prev) => [
        {
          id: nanoid(),
          userId: currentUser.id,
          userName: currentUser.name,
          userInitials: currentUser.initials,
          action: `created task "${taskData.name}"`,
          type: 'task',
          timestamp: new Date(),
        },
        ...prev,
      ]);
    }
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    updateActive((project) => ({
      ...project,
      tasks: project.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
      updatedAt: new Date(),
    }));
  };

  const deleteTask = (taskId: string) => {
    updateActive((project) => ({
      ...project,
      tasks: project.tasks.filter((task) => task.id !== taskId),
      updatedAt: new Date(),
    }));
  };

  const getTask = (taskId: string) => activeProject.tasks.find((task) => task.id === taskId);

  const addCollaborator = (data: CollaboratorFormData) => {
    const initials = data.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    const collaborator: Collaborator = { id: nanoid(), ...data, initials, online: false };
    updateActive((project) => ({
      ...project,
      collaborators: [...project.collaborators, collaborator],
      updatedAt: new Date(),
    }));
    setActivities((prev) => [
      {
        id: nanoid(),
        userId: collaborator.id,
        userName: collaborator.name,
        userInitials: collaborator.initials,
        action: 'joined the project',
        type: 'milestone',
        timestamp: new Date(),
      },
      ...prev,
    ]);
  };

  const removeCollaborator = (collaboratorId: string) => {
    updateActive((project) => ({
      ...project,
      collaborators: project.collaborators.filter((collaborator) => collaborator.id !== collaboratorId),
      updatedAt: new Date(),
    }));
  };

  const updateCollaborator = (collaboratorId: string, updates: Partial<Collaborator>) => {
    updateActive((project) => ({
      ...project,
      collaborators: project.collaborators.map((collaborator) =>
        collaborator.id === collaboratorId ? { ...collaborator, ...updates } : collaborator,
      ),
      updatedAt: new Date(),
    }));
  };

  const getCollaborator = (collaboratorId: string) =>
    activeProject.collaborators.find((collaborator) => collaborator.id === collaboratorId);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activities,
        setActiveProjectId,
        createProject,
        deleteProject,
        addTask,
        updateTask,
        deleteTask,
        addCollaborator,
        removeCollaborator,
        updateCollaborator,
        getTask,
        getCollaborator,
        project: activeProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
}
