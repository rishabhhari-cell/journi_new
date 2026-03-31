import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Project, Task, Collaborator, Activity, TaskFormData, CollaboratorFormData } from '@/types';
import { generateSampleProject, generateSampleProject2, generateActivities } from '@/data/generators';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProjects,
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  patchProjectTasks,
  patchProjectCollaborators,
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
  showOnboarding: boolean;
  isLoadingProjects: boolean;
  dismissOnboarding: () => void;
  setActiveProjectId: (id: string) => void;
  createProject: (title: string, description?: string, dueDate?: string) => Promise<Project>;
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
  const hash = c.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (hash % 4 === 0) return c;
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

// localStorage overlays — used only for trial users
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
    payload[project.id] = { tasks: project.tasks, collaborators: project.collaborators };
  }
  localStorage.setItem(OVERLAYS_KEY, JSON.stringify(payload));
}

function rehydrateTasks(raw: unknown[]): Task[] {
  return raw.map((t) => {
    const task = t as Task;
    return {
      ...task,
      startDate: task.startDate ? new Date(task.startDate) : new Date(),
      endDate: task.endDate ? new Date(task.endDate) : new Date(),
    };
  });
}

function mapApiProjectToUi(apiProject: ApiProject): Project {
  // Read tasks and collaborators from backend JSONB columns when available
  const tasks: Task[] = apiProject.tasks_json ? rehydrateTasks(apiProject.tasks_json) : [];
  const collaborators: Collaborator[] = apiProject.collaborators_json
    ? (apiProject.collaborators_json as Collaborator[])
    : [];

  return {
    id: apiProject.id,
    title: apiProject.title,
    description: apiProject.description ?? '',
    status: apiProject.status,
    createdAt: new Date(apiProject.created_at),
    updatedAt: new Date(apiProject.updated_at),
    dueDate: apiProject.due_date ? new Date(apiProject.due_date) : undefined,
    tasks,
    collaborators,
  };
}

function hasRealSession(): boolean {
  try {
    const userRaw = localStorage.getItem('journi_auth_user');
    if (!userRaw) return false;
    const user = JSON.parse(userRaw);
    // Trial/guest users don't count as real
    return user && user.id !== 'guest';
  } catch {
    return false;
  }
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
  // Real authenticated users start empty — backend fetch will supply their projects
  if (hasRealSession()) {
    return { projects: [], activeId: '' };
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(() => {
    if (!backendMode) return false;
    // If we just signed in and have preloaded data, we won't need to load over the network.
    if (localStorage.getItem('journi_preloaded_api_projects')) return false;
    return true;
  });

  const taskSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (isTrial) saveOverlays(nextProjects);
  }, [activeId, fallbackProject, isTrial]);

  // Persist once on mount to save any backfilled fields (e.g. ORCID migration)
  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    if (isTrial) saveOverlays(projects);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
  }, [activities]);

  useEffect(() => {
    let cancelled = false;
    if (!backendMode || !activeOrganizationId) {
      setIsLoadingProjects(false);
      return;
    }

    // Immediately clear any stale sample/trial data so it never flashes on screen
    setState((prev) => {
      if (prev.projects.length > 0 && !localStorage.getItem('journi_preloaded_api_projects')) {
        return { projects: [], activeId: '' };
      }
      return prev;
    });
    setIsLoadingProjects(true);

    (async () => {
      try {
        // --- FAST PATH: Eagerly load pre-fetched projects from Auth Context ---
        const preloadedRaw = localStorage.getItem('journi_preloaded_api_projects');
        if (preloadedRaw) {
          localStorage.removeItem('journi_preloaded_api_projects');
          const parsed = JSON.parse(preloadedRaw) as ApiProject[];
          const mapped = parsed.map(mapApiProjectToUi);

          if (mapped.length === 0) {
            setShowOnboarding(true);
            localStorage.removeItem(PROJECTS_KEY);
            localStorage.removeItem(ACTIVITIES_KEY);
            setState({ projects: [], activeId: '' });
            setActivities([]);
          } else {
            const preferred = localStorage.getItem(ACTIVE_PROJECT_KEY) || mapped[0].id;
            const resolved = mapped.some((p) => p.id === preferred) ? preferred : mapped[0].id;
            setState({ projects: mapped, activeId: resolved });
            localStorage.setItem(PROJECTS_KEY, JSON.stringify(mapped));
            localStorage.setItem(ACTIVE_PROJECT_KEY, resolved);
          }
          if (!cancelled) setIsLoadingProjects(false);
          return;
        }

        // --- SLOW PATH: Standard Network Fetch ---
        const response = await fetchProjects(activeOrganizationId);
        if (cancelled) return;

        const mapped = response.data.map((project) => mapApiProjectToUi(project));

        if (mapped.length === 0) {
          // New user — show onboarding wizard instead of auto-creating
          setShowOnboarding(true);
          localStorage.removeItem(PROJECTS_KEY);
          localStorage.removeItem(ACTIVITIES_KEY);
          setState({ projects: [], activeId: '' });
          setActivities([]);
          return;
        }

        const preferred = localStorage.getItem(ACTIVE_PROJECT_KEY) || mapped[0].id;
        const resolved = mapped.some((p) => p.id === preferred) ? preferred : mapped[0].id;
        setState({ projects: mapped, activeId: resolved });
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(mapped));
        localStorage.setItem(ACTIVE_PROJECT_KEY, resolved);
      } catch {
        // Keep local state if backend fetch fails.
      } finally {
        if (!cancelled) setIsLoadingProjects(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendMode, activeOrganizationId]);

  const activeProject =
    projects.find((p) => p.id === activeId) ||
    projects[0] ||
    fallbackProject;

  const activeProjectRef = useRef(activeProject);
  activeProjectRef.current = activeProject;

  const dismissOnboarding = useCallback(() => setShowOnboarding(false), []);

  const setActiveProjectId = (id: string) => {
    setState((prev) => ({ ...prev, activeId: id }));
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  };

  // Debounced task save to backend
  const scheduleTaskSave = useCallback((projectId: string, tasks: Task[]) => {
    if (!backendMode) return;
    if (taskSaveTimerRef.current) clearTimeout(taskSaveTimerRef.current);
    taskSaveTimerRef.current = setTimeout(() => {
      void patchProjectTasks(projectId, tasks as unknown[]).catch(() => {});
    }, 800);
  }, [backendMode]);

  // Immediate collaborator save to backend
  const saveCollaborators = useCallback((projectId: string, collaborators: Collaborator[]) => {
    if (!backendMode) return;
    void patchProjectCollaborators(projectId, collaborators as unknown[]).catch(() => {});
  }, [backendMode]);

  const createProject = useCallback(async (title: string, description = '', dueDate?: string): Promise<Project> => {
    const optimisticProject: Project = {
      id: nanoid(),
      title,
      description,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tasks: [],
      collaborators: [],
    };

    // Use functional state update to avoid stale closures
    setState((prev) => {
      const nextProjects = [...prev.projects, optimisticProject];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
      localStorage.setItem(ACTIVE_PROJECT_KEY, optimisticProject.id);
      if (isTrial) saveOverlays(nextProjects);
      return { projects: nextProjects, activeId: optimisticProject.id };
    });

    if (backendMode && activeOrganizationId) {
      // FIRE AND FORGET
      createProjectApi({
        organizationId: activeOrganizationId,
        title,
        description,
        dueDate,
      })
        .then((created) => {
          const mapped = mapApiProjectToUi(created.data);
          setState((prev) => {
            const nextProjects = prev.projects.map((p) =>
              p.id === optimisticProject.id
                ? { ...mapped, tasks: p.tasks, collaborators: p.collaborators }
                : p
            );
            const nextActiveId = prev.activeId === optimisticProject.id ? mapped.id : prev.activeId;

            localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
            localStorage.setItem(ACTIVE_PROJECT_KEY, nextActiveId);
            if (isTrial) saveOverlays(nextProjects);
            return { projects: nextProjects, activeId: nextActiveId };
          });
        })
        .catch(() => {
          // Keep optimistic project locally if backend creation fails
        });
    }

    return optimisticProject;
  }, [backendMode, activeOrganizationId, isTrial]);

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((p) => p.id !== id);
    const newActiveId = id === activeId ? updated[0].id : activeId;
    setProjects(updated, newActiveId);

    if (backendMode) {
      void deleteProjectApi(id).catch(() => {});
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
    const newTasks = [...activeProject.tasks, newTask];
    updateActive((project) => ({ ...project, tasks: newTasks, updatedAt: new Date() }));
    scheduleTaskSave(activeProject.id, newTasks);

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
    const newTasks = activeProject.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    updateActive((project) => ({ ...project, tasks: newTasks, updatedAt: new Date() }));
    scheduleTaskSave(activeProject.id, newTasks);
  };

  const deleteTask = (taskId: string) => {
    const newTasks = activeProject.tasks.filter((task) => task.id !== taskId);
    updateActive((project) => ({ ...project, tasks: newTasks, updatedAt: new Date() }));
    scheduleTaskSave(activeProject.id, newTasks);
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
    const newCollaborators = [...activeProject.collaborators, collaborator];
    updateActive((project) => ({ ...project, collaborators: newCollaborators, updatedAt: new Date() }));
    saveCollaborators(activeProject.id, newCollaborators);

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
    const newCollaborators = activeProject.collaborators.filter((c) => c.id !== collaboratorId);
    updateActive((project) => ({ ...project, collaborators: newCollaborators, updatedAt: new Date() }));
    saveCollaborators(activeProject.id, newCollaborators);
  };

  const updateCollaborator = (collaboratorId: string, updates: Partial<Collaborator>) => {
    const newCollaborators = activeProject.collaborators.map((c) =>
      c.id === collaboratorId ? { ...c, ...updates } : c,
    );
    updateActive((project) => ({ ...project, collaborators: newCollaborators, updatedAt: new Date() }));
    saveCollaborators(activeProject.id, newCollaborators);
  };

  const getCollaborator = (collaboratorId: string) =>
    activeProject.collaborators.find((c) => c.id === collaboratorId);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activities,
        showOnboarding,
        isLoadingProjects,
        dismissOnboarding,
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
