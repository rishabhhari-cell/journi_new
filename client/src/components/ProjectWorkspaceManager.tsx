import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useProject } from "@/contexts/ProjectContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  WorkspaceContent,
  WorkspaceTrigger,
  Workspaces,
  type Workspace,
} from "@/components/ui/workspaces";
import { cn } from "@/lib/utils";
import { getScienceWorkspaceVisual } from "@/lib/workspace-visuals";

interface ProjectWorkspace extends Workspace {
  logo?: string;
  visualKey?: string;
}

function WorkspaceScienceAvatar({
  workspace,
  compact = false,
}: {
  workspace: ProjectWorkspace;
  compact?: boolean;
}) {
  const stableVisualKey = workspace.visualKey || workspace.id;
  const visual = getScienceWorkspaceVisual(stableVisualKey);
  const Icon = visual.icon;

  return (
    <Avatar className={cn("rounded-md", compact ? "h-6 w-6" : "h-7 w-7")}>
      {workspace.logo ? (
        <AvatarImage src={workspace.logo} alt={workspace.name} />
      ) : null}
      <AvatarFallback className={cn("rounded-md", visual.bgClass)}>
        <Icon className={cn(compact ? "size-3.5" : "size-4", visual.iconClass)} />
      </AvatarFallback>
    </Avatar>
  );
}

export default function ProjectWorkspaceManager() {
  const { projects, activeProject, setActiveProjectId, createProject, isLoadingProjects } = useProject();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (isLoadingProjects) return null;
  if (projects.length === 0) return null;

  const workspaces: ProjectWorkspace[] = projects.map((project) => ({
    id: project.id,
    name: project.title,
    visualKey: project.title.trim().toLowerCase(),
    logo: typeof (project as { logo?: unknown }).logo === "string"
      ? ((project as { logo?: string }).logo ?? undefined)
      : undefined,
  }));

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    void createProject(trimmedName);
    setNewName("");
    setCreating(false);
    setOpen(false);
    navigate("/dashboard");
  };

  return (
    <Workspaces<ProjectWorkspace>
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setCreating(false);
          setNewName("");
        }
      }}
      workspaces={workspaces}
      selectedWorkspaceId={activeProject.id}
      onWorkspaceChange={(workspace) => {
        setActiveProjectId(workspace.id);
        setCreating(false);
      }}
    >
      <WorkspaceTrigger
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent/80 transition-colors text-sm font-medium text-foreground max-w-[220px]"
        aria-label={`Switch workspace: ${activeProject.title}`}
        renderTrigger={(workspace, isOpen) => (
          <>
            <WorkspaceScienceAvatar workspace={workspace as ProjectWorkspace} compact />
            <span className="truncate">{workspace.name}</span>
            <ChevronsUpDownIcon
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </>
        )}
      />
      <WorkspaceContent
        className="w-64 p-0"
        align="start"
        title="My Workspaces"
        renderWorkspace={(workspace, isSelected) => (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <WorkspaceScienceAvatar workspace={workspace as ProjectWorkspace} compact />
            <span className="truncate text-sm">{workspace.name}</span>
            {isSelected && <CheckIcon className="ml-auto h-4 w-4 text-journi-green" />}
          </div>
        )}
      >
        {creating ? (
          <form onSubmit={handleCreate} className="px-2 py-1 flex gap-2">
            <label htmlFor="workspace-name" className="sr-only">Workspace name</label>
            <input
              id="workspace-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Workspace name..."
              className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-journi-green"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-journi-green text-journi-slate text-xs font-semibold rounded-md hover:opacity-90"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
          >
            <Plus size={14} />
            New Workspace
          </button>
        )}
      </WorkspaceContent>
    </Workspaces>
  );
}
