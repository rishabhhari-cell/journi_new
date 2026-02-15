import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import type { Project, Task, Collaborator, Activity, TaskFormData, CollaboratorFormData } from '@/types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '@/lib/storage';
import { generateSampleProject, generateActivities } from '@/data/generators';

// ============================================================================
// Context Type Definition
// ============================================================================

interface ProjectContextType {
  project: Project;
  activities: Activity[];
  addTask: (task: TaskFormData) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  addCollaborator: (collaborator: CollaboratorFormData) => void;
  removeCollaborator: (collaboratorId: string) => void;
  updateCollaborator: (collaboratorId: string, updates: Partial<Collaborator>) => void;
  getTask: (taskId: string) => Task | undefined;
  getCollaborator: (collaboratorId: string) => Collaborator | undefined;
}

// ============================================================================
// Create Context
// ============================================================================

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface ProjectProviderProps {
  children: ReactNode;
}

// Ensure date fields are actual Date objects (localStorage may store them as strings)
function rehydrateDates(project: Project): Project {
  return {
    ...project,
    createdAt: project.createdAt ? new Date(project.createdAt) : new Date(),
    updatedAt: project.updatedAt ? new Date(project.updatedAt) : new Date(),
    tasks: project.tasks.map((task) => ({
      ...task,
      startDate: task.startDate ? new Date(task.startDate) : new Date(),
      endDate: task.endDate ? new Date(task.endDate) : new Date(),
    })),
  };
}

function rehydrateActivities(activities: Activity[]): Activity[] {
  return activities.map((a) => ({
    ...a,
    timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
  }));
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  // Load initial data from localStorage or generate sample data
  const [project, setProject] = useState<Project>(() => {
    const stored = loadFromStorage<Project | null>(STORAGE_KEYS.PROJECT, null);
    return stored ? rehydrateDates(stored) : generateSampleProject();
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const stored = loadFromStorage<Activity[] | null>('activities', null);
    return stored ? rehydrateActivities(stored) : generateActivities(project.collaborators);
  });

  // Save to localStorage whenever project changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PROJECT, project);
  }, [project]);

  useEffect(() => {
    saveToStorage('activities', activities);
  }, [activities]);

  // ========================================
  // Task Management Functions
  // ========================================

  const addTask = (taskData: TaskFormData) => {
    const newTask: Task = {
      id: nanoid(),
      ...taskData,
    };

    setProject((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
      updatedAt: new Date(),
    }));

    // Add activity
    const currentUser = project.collaborators[0];
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
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
      updatedAt: new Date(),
    }));
  };

  const deleteTask = (taskId: string) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
      updatedAt: new Date(),
    }));
  };

  const getTask = (taskId: string): Task | undefined => {
    return project.tasks.find((task) => task.id === taskId);
  };

  // ========================================
  // Collaborator Management Functions
  // ========================================

  const addCollaborator = (collaboratorData: CollaboratorFormData) => {
    const initials = collaboratorData.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const newCollaborator: Collaborator = {
      id: nanoid(),
      ...collaboratorData,
      initials,
      online: false,
    };

    setProject((prev) => ({
      ...prev,
      collaborators: [...prev.collaborators, newCollaborator],
      updatedAt: new Date(),
    }));

    // Add activity
    setActivities((prev) => [
      {
        id: nanoid(),
        userId: newCollaborator.id,
        userName: newCollaborator.name,
        userInitials: newCollaborator.initials,
        action: 'joined the project',
        type: 'milestone',
        timestamp: new Date(),
      },
      ...prev,
    ]);
  };

  const removeCollaborator = (collaboratorId: string) => {
    setProject((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== collaboratorId),
      updatedAt: new Date(),
    }));
  };

  const updateCollaborator = (collaboratorId: string, updates: Partial<Collaborator>) => {
    setProject((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) =>
        c.id === collaboratorId ? { ...c, ...updates } : c
      ),
      updatedAt: new Date(),
    }));
  };

  const getCollaborator = (collaboratorId: string): Collaborator | undefined => {
    return project.collaborators.find((c) => c.id === collaboratorId);
  };

  // ========================================
  // Context Value
  // ========================================

  const value: ProjectContextType = {
    project,
    activities,
    addTask,
    updateTask,
    deleteTask,
    addCollaborator,
    removeCollaborator,
    updateCollaborator,
    getTask,
    getCollaborator,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// ============================================================================
// Hook to use Project Context
// ============================================================================

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
