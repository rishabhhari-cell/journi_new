import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, FolderArchive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

type DigestFrequency = 'immediate' | 'daily' | 'weekly' | 'off';

interface NotificationSettings {
  dueDateReminders: boolean;
  mentionsAndComments: boolean;
  submissionMilestones: boolean;
  taskDigest: DigestFrequency;
}

const defaultNotificationSettings: NotificationSettings = {
  dueDateReminders: true,
  mentionsAndComments: true,
  submissionMilestones: true,
  taskDigest: 'daily',
};

function getNotificationStorageKey(userId?: string) {
  return `journi_notification_settings_${userId || 'guest'}`;
}

function loadNotificationSettings(userId?: string): NotificationSettings {
  try {
    const raw = localStorage.getItem(getNotificationStorageKey(userId));
    if (!raw) return defaultNotificationSettings;
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      dueDateReminders: parsed.dueDateReminders ?? defaultNotificationSettings.dueDateReminders,
      mentionsAndComments: parsed.mentionsAndComments ?? defaultNotificationSettings.mentionsAndComments,
      submissionMilestones: parsed.submissionMilestones ?? defaultNotificationSettings.submissionMilestones,
      taskDigest: parsed.taskDigest ?? defaultNotificationSettings.taskDigest,
    };
  } catch {
    return defaultNotificationSettings;
  }
}

interface ProjectSettingsPanelProps {
  className?: string;
}

export default function ProjectSettingsPanel({ className = '' }: ProjectSettingsPanelProps) {
  const {
    projects,
    activeProject,
    setActiveProjectId,
    renameProject,
    archiveProject,
    hardDeleteProject,
  } = useProject();
  const { user } = useAuth();

  const [selectedProjectId, setSelectedProjectId] = useState(activeProject?.id ?? '');
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const [projectName, setProjectName] = useState(selectedProject?.title ?? '');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadNotificationSettings(user?.id),
  );

  useEffect(() => {
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(activeProject?.id ?? projects[0]?.id ?? '');
    }
  }, [activeProject?.id, projects, selectedProjectId]);

  useEffect(() => {
    setProjectName(selectedProject?.title ?? '');
    setDeleteConfirmText('');
  }, [selectedProject?.id, selectedProject?.title]);

  useEffect(() => {
    setNotifications(loadNotificationSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem(getNotificationStorageKey(user?.id), JSON.stringify(notifications));
  }, [notifications, user?.id]);

  const canHardDelete = projects.length > 1;
  const confirmMatchesProject = Boolean(
    selectedProject && deleteConfirmText.trim() === selectedProject.title,
  );

  const handleProjectSelection = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveProjectId(projectId);
  };

  const handleRenameProject = async () => {
    if (!selectedProject) return;
    const trimmed = projectName.trim();
    if (trimmed.length < 2) {
      toast.error('Project name must be at least 2 characters.');
      return;
    }
    if (trimmed === selectedProject.title) {
      toast.success('No project name changes to save.');
      return;
    }

    setIsSavingName(true);
    const ok = await renameProject(selectedProject.id, trimmed);
    setIsSavingName(false);

    if (!ok) {
      toast.error('Could not rename project. Please try again.');
      return;
    }
    toast.success('Project renamed.');
  };

  const handleArchiveProject = async () => {
    if (!selectedProject) return;
    if (selectedProject.status === 'archived') {
      toast.success('Project is already archived.');
      return;
    }
    setIsArchiving(true);
    const ok = await archiveProject(selectedProject.id);
    setIsArchiving(false);

    if (!ok) {
      toast.error('Could not archive project.');
      return;
    }
    toast.success('Project archived.');
  };

  const handleHardDeleteProject = async () => {
    if (!selectedProject) return;
    if (!canHardDelete) {
      toast.error('At least one project must remain.');
      return;
    }
    if (!confirmMatchesProject) {
      toast.error('Type the exact project name to confirm deletion.');
      return;
    }

    setIsDeleting(true);
    const deletedName = selectedProject.title;
    const ok = await hardDeleteProject(selectedProject.id);
    setIsDeleting(false);

    if (!ok) {
      toast.error('Could not delete project.');
      return;
    }
    toast.success(`Deleted "${deletedName}".`);
  };

  const updateNotifications = (updates: Partial<NotificationSettings>) =>
    setNotifications((prev) => ({ ...prev, ...updates }));

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground">Project settings</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage any project from one place.
        </p>

        {projects.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No projects available yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectSelection(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#9999cc]/40"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}{project.status === 'archived' ? ' (Archived)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Project name
              </label>
              <div className="flex gap-2">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#9999cc]/40"
                  placeholder="Project name"
                />
                <button
                  type="button"
                  onClick={handleRenameProject}
                  disabled={isSavingName || !selectedProject}
                  className="rounded-lg bg-[#9999cc] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {isSavingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleArchiveProject}
                disabled={isArchiving || !selectedProject}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
              >
                <FolderArchive size={15} />
                {isArchiving ? 'Archiving...' : 'Archive project'}
              </button>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Status: <span className="font-medium text-foreground">{selectedProject?.status ?? 'Unknown'}</span>
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 dark:border-red-900/40 dark:bg-red-950/30">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400">Hard delete project</p>
                  <p className="text-xs text-red-700/90 dark:text-red-400/90">
                    This permanently deletes the project and cannot be undone.
                  </p>
                  <input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={selectedProject ? `Type "${selectedProject.title}"` : 'Type project name'}
                    className="w-full rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-red-300 dark:border-red-900/40 dark:bg-background"
                    disabled={!selectedProject || !canHardDelete}
                  />
                  <button
                    type="button"
                    onClick={handleHardDeleteProject}
                    disabled={!selectedProject || !canHardDelete || !confirmMatchesProject || isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    {isDeleting ? 'Deleting...' : 'Hard delete'}
                  </button>
                  {!canHardDelete && (
                    <p className="text-[11px] text-red-700/90 dark:text-red-400/90">
                      You can't delete your only remaining project.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
          <BellRing size={15} className="text-[#9999cc]" />
          Notifications
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure due-date reminders, comments, and publication updates.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="text-foreground">Due date reminders</span>
            <input
              type="checkbox"
              checked={notifications.dueDateReminders}
              onChange={(e) => updateNotifications({ dueDateReminders: e.target.checked })}
              className="h-4 w-4 accent-[#9999cc]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="text-foreground">Mentions and comments</span>
            <input
              type="checkbox"
              checked={notifications.mentionsAndComments}
              onChange={(e) => updateNotifications({ mentionsAndComments: e.target.checked })}
              className="h-4 w-4 accent-[#9999cc]"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <span className="text-foreground">Submission milestones</span>
            <input
              type="checkbox"
              checked={notifications.submissionMilestones}
              onChange={(e) => updateNotifications({ submissionMilestones: e.target.checked })}
              className="h-4 w-4 accent-[#9999cc]"
            />
          </label>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Digest frequency</label>
            <select
              value={notifications.taskDigest}
              onChange={(e) => updateNotifications({ taskDigest: e.target.value as DigestFrequency })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#9999cc]/40"
            >
              <option value="immediate">Immediate</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 size={12} />
          Notification preferences are saved for this account on this device.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-bold text-foreground">More settings</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Team & roles</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Role defaults and invite permissions.</p>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-xs font-semibold text-foreground">Data controls</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Exports and retention options.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
