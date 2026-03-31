import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, FolderOpen } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  /** 'sidebar' = full width block used in Dashboard sidebar; 'compact' = small inline pill */
  variant?: 'sidebar' | 'compact';
  onSwitch?: () => void;
}

export default function ProjectSwitcher({ variant = 'sidebar', onSwitch }: Props) {
  const { projects, activeProject, setActiveProjectId, createProject, isLoadingProjects } = useProject();
  const { isTrial } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleSwitch = (id: string) => {
    setActiveProjectId(id);
    setOpen(false);
    onSwitch?.();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    void createProject(name);
    setNewName('');
    setCreating(false);
    setOpen(false);
    navigate('/dashboard');
    onSwitch?.();
  };

  // Don't render during backend loading — avoids showing fallback "Tetraplan" project
  if (isLoadingProjects && !isTrial) return null;

  if (variant === 'compact') {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent/80 transition-colors text-sm font-medium text-foreground max-w-[180px]"
          aria-label={`Switch project: ${activeProject.title}`}
          aria-expanded={open}
        >
          <FolderOpen size={13} className="text-journi-green shrink-0" />
          <span className="truncate">{activeProject.title}</span>
          <ChevronDown size={12} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <Dropdown projects={projects} activeId={activeProject.id} onSwitch={handleSwitch} creating={creating} setCreating={setCreating} newName={newName} setNewName={setNewName} onCreate={handleCreate} inputRef={inputRef} align="left" />}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 group"
        aria-label={`Switch project: ${activeProject.title}`}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider truncate text-left">
            {activeProject.title}
          </h2>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <Dropdown projects={projects} activeId={activeProject.id} onSwitch={handleSwitch} creating={creating} setCreating={setCreating} newName={newName} setNewName={setNewName} onCreate={handleCreate} inputRef={inputRef} align="left" />}
    </div>
  );
}

function Dropdown({
  projects, activeId, onSwitch, creating, setCreating, newName, setNewName, onCreate, inputRef, align,
}: {
  projects: any[];
  activeId: string;
  onSwitch: (id: string) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  onCreate: (e: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  align: 'left' | 'right';
}) {
  return (
    <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg py-1.5 z-50`}>
      <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">My Projects</p>
      <div className="max-h-48 overflow-y-auto">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => onSwitch(p.id)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <span className="flex-1 text-left truncate">{p.title}</span>
            {p.id === activeId && <Check size={14} className="text-journi-green shrink-0" />}
          </button>
        ))}
      </div>
      <div className="border-t border-border mt-1 pt-1">
        {creating ? (
          <form onSubmit={onCreate} className="px-3 py-2 flex gap-2">
            <label htmlFor="new-project-name" className="sr-only">Project name</label>
            <input
              id="new-project-name"
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name…"
              className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-journi-green"
              autoComplete="off"
            />
            <button type="submit" className="px-2 py-1 bg-journi-green text-journi-slate text-xs font-semibold rounded-md hover:opacity-90">
              Create
            </button>
          </form>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Plus size={14} />
            New Project
          </button>
        )}
      </div>
    </div>
  );
}
