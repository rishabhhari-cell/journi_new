import { createContext, useContext, useState, useEffect, useRef, ReactNode, useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import type { Project, Task, Collaborator, Activity, TaskFormData, CollaboratorFormData, ProjectMetadata } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProjects,
  createProject as createProjectApi,
  patchProject,
  deleteProject as deleteProjectApi,
  patchProjectTasks,
  patchProjectCollaborators,
  type ApiProject,
} from '@/lib/api/backend';

const ACTIVE_PROJECT_KEY = 'journi_active_project_id';
const ACTIVITIES_KEY = 'journi_activities';

function inferCompletionPct(task: Partial<Task>): number {
  if (typeof task.completionPct === 'number') {
    return Math.max(0, Math.min(100, Math.round(task.completionPct)));
  }
  if (task.status === 'completed') return 100;
  if (task.status === 'progress') return 50;
  return 0;
}

function normalizeTask(task: Partial<Task>): Task {
  return {
    id: task.id || nanoid(),
    name: task.name || 'Untitled Task',
    startDate: task.startDate ? new Date(task.startDate) : new Date(),
    endDate: task.endDate ? new Date(task.endDate) : new Date(),
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    completionPct: inferCompletionPct(task),
    assignedTo: task.assignedTo || [],
    description: task.description || '',
    dependencies: task.dependencies || [],
  };
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
  renameProject: (projectId: string, title: string) => Promise<boolean>;
  archiveProject: (projectId: string) => Promise<boolean>;
  hardDeleteProject: (projectId: string) => Promise<boolean>;
  addTask: (task: TaskFormData) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  addCollaborator: (collaborator: CollaboratorFormData) => void;
  removeCollaborator: (collaboratorId: string) => void;
  updateCollaborator: (collaboratorId: string, updates: Partial<Collaborator>) => void;
  getTask: (taskId: string) => Task | undefined;
  getCollaborator: (collaboratorId: string) => Collaborator | undefined;
  updateProjectMetadata: (patch: Partial<ProjectMetadata>) => Promise<void>;
  project: Project;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);


function rehydrateActivities(acts: Activity[]): Activity[] {
  return acts.map((a) => ({ ...a, timestamp: a.timestamp ? new Date(a.timestamp) : new Date() }));
}

function createFallbackProject(): Project {
  const now = new Date();
  return {
    id: 'empty-project',
    title: 'Untitled Project',
    description: '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    tasks: [],
    collaborators: [],
  };
}

function rehydrateTasks(raw: unknown[]): Task[] {
  return raw.map((t) => normalizeTask(t as Partial<Task>));
}

function mapApiProjectToUi(apiProject: ApiProject): Project {
  // Read tasks and collaborators from backend JSONB columns when available
  const tasks: Task[] = apiProject.tasks_json ? rehydrateTasks(apiProject.tasks_json) : [];
  const collaborators: Collaborator[] = apiProject.collaborators_json
    ? (apiProject.collaborators_json as Collaborator[])
    : [];

  const rawMeta = apiProject.metadata ?? {};
  const metadata: ProjectMetadata | undefined =
    Array.isArray(rawMeta.authors) || Array.isArray(rawMeta.institutions)
      ? {
          authors: Array.isArray(rawMeta.authors) ? (rawMeta.authors as string[]) : [],
          institutions: Array.isArray(rawMeta.institutions) ? (rawMeta.institutions as string[]) : [],
        }
      : undefined;

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
    metadata,
  };
}

function initProjects(): { projects: Project[]; activeId: string } {
  // Never read stale project data from localStorage — always fetch fresh from the backend.
  // Only remember which project was last active so the selection survives a refresh.
  const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY) ?? '';
  return { projects: [], activeId };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, activeOrganizationId } = useAuth();
  const backendMode = Boolean(user && activeOrganizationId);

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

  const [allActivities, setAllActivities] = useState<Activity[]>(() => {
    try {
      const stored = localStorage.getItem(ACTIVITIES_KEY);
      if (stored) return rehydrateActivities(JSON.parse(stored));
    } catch {
      // ignore corrupted storage
    }
    return [];
  });


  const activities = useMemo(
    () => allActivities.filter((activity) => activity.metadata?.projectId === activeId),
    [allActivities, activeId],
  );

  const setProjects = useCallback((updated: Project[], newActiveId?: string) => {
    const nextProjects = updated;
    const preferredActiveId = newActiveId ?? activeId;
    const resolvedActiveId =
      nextProjects.length === 0
        ? ''
        : nextProjects.some((project) => project.id === preferredActiveId)
          ? preferredActiveId
          : nextProjects[0].id;

    setState({ projects: nextProjects, activeId: resolvedActiveId });
    if (nextProjects.length === 0) {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_PROJECT_KEY, resolvedActiveId);
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(allActivities));
  }, [allActivities]);

  useEffect(() => {
    let cancelled = false;
    if (!backendMode || !activeOrganizationId) {
      setIsLoadingProjects(false);
      return;
    }

    setIsLoadingProjects(true);

    (async () => {
      try {
        const response = await fetchProjects(activeOrganizationId);
        if (cancelled) return;

        const mapped = response.data.map((project) => mapApiProjectToUi(project));

        if (mapped.length === 0) {
          // New user — show onboarding wizard instead of auto-creating
          setShowOnboarding(true);
          localStorage.removeItem(ACTIVITIES_KEY);
          setState({ projects: [], activeId: '' });
          setAllActivities([]);
          return;
        }

        const preferred = localStorage.getItem(ACTIVE_PROJECT_KEY) || mapped[0].id;
        const resolved = mapped.some((p) => p.id === preferred) ? preferred : mapped[0].id;
        setState({ projects: mapped, activeId: resolved });
        localStorage.setItem(ACTIVE_PROJECT_KEY, resolved);
      } catch {
        // Keep in-memory state if backend fetch fails — do not show stale localStorage data.
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
      localStorage.setItem(ACTIVE_PROJECT_KEY, optimisticProject.id);
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

            localStorage.setItem(ACTIVE_PROJECT_KEY, nextActiveId);
            return { projects: nextProjects, activeId: nextActiveId };
          });
        })
        .catch(() => {
          // Keep optimistic project locally if backend creation fails
        });
    }

    return optimisticProject;
  }, [backendMode, activeOrganizationId]);

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const updated = projects.filter((p) => p.id !== id);
    const newActiveId = id === activeId ? updated[0].id : activeId;
    setProjects(updated, newActiveId);

    if (backendMode) {
      void deleteProjectApi(id).catch(() => {});
    }
  };

  const renameProject = async (projectId: string, title: string): Promise<boolean> => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) return false;

    const existingProject = projects.find((project) => project.id === projectId);
    if (!existingProject) return false;

    const previousProjects = projects;
    const previousActiveId = activeId;
    const updatedProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, title: trimmedTitle, updatedAt: new Date() }
        : project,
    );
    setProjects(updatedProjects, previousActiveId);

    if (!backendMode) return true;

    try {
      await patchProject(projectId, { title: trimmedTitle });
      return true;
    } catch {
      setProjects(previousProjects, previousActiveId);
      return false;
    }
  };

  const archiveProject = async (projectId: string): Promise<boolean> => {
    const existingProject = projects.find((project) => project.id === projectId);
    if (!existingProject) return false;
    if (existingProject.status === 'archived') return true;

    const previousProjects = projects;
    const previousActiveId = activeId;
    const updatedProjects = projects.map((project) =>
      project.id === projectId
        ? { ...project, status: 'archived' as const, updatedAt: new Date() }
        : project,
    );
    setProjects(updatedProjects, previousActiveId);

    if (!backendMode) return true;

    try {
      await patchProject(projectId, { status: 'archived' });
      return true;
    } catch {
      setProjects(previousProjects, previousActiveId);
      return false;
    }
  };

  const hardDeleteProject = async (projectId: string): Promise<boolean> => {
    if (projects.length <= 1) return false;
    const existingProject = projects.find((project) => project.id === projectId);
    if (!existingProject) return false;

    const previousProjects = projects;
    const previousActiveId = activeId;
    const updatedProjects = projects.filter((project) => project.id !== projectId);
    const nextActiveId = projectId === previousActiveId ? updatedProjects[0]?.id : previousActiveId;
    setProjects(updatedProjects, nextActiveId);

    if (!backendMode) return true;

    try {
      await deleteProjectApi(projectId);
      return true;
    } catch {
      setProjects(previousProjects, previousActiveId);
      return false;
    }
  };

  const updateActive = (updater: (p: Project) => Project) => {
    const updated = projects.map((project) =>
      project.id === activeProject.id ? updater(project) : project,
    );
    setProjects(updated, activeProject.id);
  };

  const updateProjectMetadata = useCallback(async (patch: Partial<ProjectMetadata>): Promise<void> => {
    const current = activeProject.metadata ?? { authors: [], institutions: [] };
    const merged: ProjectMetadata = {
      authors: patch.authors ?? current.authors,
      institutions: patch.institutions ?? current.institutions,
    };
    // Optimistic update
    updateActive((p) => ({ ...p, metadata: merged, updatedAt: new Date() }));
    if (backendMode && activeProject.id) {
      try {
        await patchProject(activeProject.id, { metadata: merged as unknown as Record<string, unknown> });
      } catch {
        console.error('[ProjectContext] Failed to persist project metadata');
      }
    }
  }, [activeProject.id, activeProject.metadata, backendMode, updateActive]);

  const addTask = (taskData: TaskFormData) => {
    const newTask: Task = { id: nanoid(), ...taskData };
    const newTasks = [...activeProject.tasks, newTask];
    updateActive((project) => ({ ...project, tasks: newTasks, updatedAt: new Date() }));
    scheduleTaskSave(activeProject.id, newTasks);

    const currentUser = activeProject.collaborators[0];
    if (currentUser) {
      setAllActivities((prev) => [
        {
          id: nanoid(),
          userId: currentUser.id,
          userName: currentUser.name,
          userInitials: currentUser.initials,
          action: `created task "${taskData.name}"`,
          type: 'task',
          timestamp: new Date(),
          metadata: { projectId: activeProject.id },
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

    setAllActivities((prev) => [
      {
        id: nanoid(),
        userId: collaborator.id,
        userName: collaborator.name,
        userInitials: collaborator.initials,
        action: 'joined the project',
        type: 'milestone',
        timestamp: new Date(),
        metadata: { projectId: activeProject.id },
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
        renameProject,
        archiveProject,
        hardDeleteProject,
        addTask,
        updateTask,
        deleteTask,
        addCollaborator,
        removeCollaborator,
        updateCollaborator,
        getTask,
        getCollaborator,
        updateProjectMetadata,
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
