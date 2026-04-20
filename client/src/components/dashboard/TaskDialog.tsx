import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import type { Collaborator, Task, TaskFormData, TaskPriority, TaskStatus } from '@/types';

interface TaskDialogProps {
  onClose: () => void;
  onSubmit: (task: TaskFormData) => void;
  task?: Task;
  collaborators: Collaborator[];
}

const priorityOptions: Array<{ value: TaskPriority; label: string; selected: string }> = [
  { value: 'urgent', label: '\uD83D\uDD34 Urgent', selected: 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700/50 dark:text-red-400' },
  { value: 'medium', label: '\uD83D\uDFE1 Medium', selected: 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-400' },
  { value: 'low', label: '\u26AA Low', selected: 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400' },
];

function deriveStatus(previousStatus: TaskStatus, completionPct: number): TaskStatus {
  if (completionPct >= 100) return 'completed';
  if (previousStatus === 'completed') {
    return completionPct > 0 ? 'progress' : 'pending';
  }
  if (completionPct > 0 && previousStatus === 'pending') return 'progress';
  if (completionPct === 0 && previousStatus === 'progress') return 'pending';
  return previousStatus;
}

function initialFormData(task?: Task): TaskFormData {
  if (task) {
    return {
      name: task.name,
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
      status: task.status,
      priority: task.priority,
      completionPct: task.completionPct,
      assignedTo: task.assignedTo || [],
      description: task.description || '',
      dependencies: task.dependencies || [],
    };
  }

  return {
    name: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'pending',
    priority: 'medium',
    completionPct: 0,
    assignedTo: [],
    description: '',
    dependencies: [],
  };
}

export default function TaskDialog({ onClose, onSubmit, task, collaborators }: TaskDialogProps) {
  const [formData, setFormData] = useState<TaskFormData>(() => initialFormData(task));
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData(initialFormData(task));
    setError('');
  }, [task]);

  const setCompletion = (value: number) => {
    setFormData((prev) => {
      const completionPct = Math.max(0, Math.min(100, value));
      return {
        ...prev,
        completionPct,
        status: deriveStatus(prev.status, completionPct),
      };
    });
  };

  const handleAssigneeToggle = (collaboratorId: string) => {
    setFormData((prev) => {
      const assigned = prev.assignedTo || [];
      return {
        ...prev,
        assignedTo: assigned.includes(collaboratorId)
          ? assigned.filter((id) => id !== collaboratorId)
          : [...assigned, collaboratorId],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Task name is required');
      return;
    }

    if (formData.startDate > formData.endDate) {
      setError('Due date must be on or after start date');
      return;
    }

    onSubmit({
      ...formData,
      status: deriveStatus(formData.status, formData.completionPct),
    });
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/10 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 right-0 top-16 z-50 w-full max-w-[420px] border-l border-border bg-card shadow-2xl"
      >
        <form onSubmit={handleSubmit} className="flex h-full flex-col bg-card px-6 py-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="truncate text-base font-semibold text-foreground">
              {task ? task.name : 'New Task'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close task panel"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto pb-5 pr-1 pt-5">
            <div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Task name..."
                className="w-full border-0 border-b border-input bg-transparent py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#9999cc] focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</p>
              <div className="flex gap-2">
                {priorityOptions.map((option) => {
                  const selected = formData.priority === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, priority: option.value }))}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selected ? option.selected : 'bg-background border-border text-muted-foreground dark:bg-background dark:border-border dark:text-muted-foreground'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</p>
                <span className="rounded bg-[#9999cc]/10 px-2 py-0.5 text-xs font-semibold text-[#9999cc] dark:bg-[#9999cc]/20 dark:text-[#c9c9f2]">
                  {formData.completionPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={formData.completionPct}
                onChange={(e) => setCompletion(Number(e.target.value))}
                className="w-full accent-[#9999cc]"
              />
              <div className="mt-2 flex items-center gap-1">
                {[0, 25, 50, 75, 100].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCompletion(value)}
                    className="rounded border border-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assign to</p>
              <div className="grid grid-cols-3 gap-2">
                {collaborators.map((collaborator) => {
                  const isSelected = formData.assignedTo?.includes(collaborator.id) || false;
                  return (
                    <button
                      key={collaborator.id}
                      type="button"
                      onClick={() => handleAssigneeToggle(collaborator.id)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${isSelected ? 'bg-[#9999cc]/10 border-[#9999cc]/40 text-[#9999cc] dark:bg-[#9999cc]/20 dark:border-[#9999cc]/50 dark:text-[#c9c9f2] font-medium' : 'bg-background border-border text-muted-foreground hover:bg-accent'}`}
                      title={collaborator.name}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9999cc] text-[10px] font-bold text-white">
                        {collaborator.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="truncate">{collaborator.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Start</p>
                <input
                  type="date"
                  value={format(formData.startDate, 'yyyy-MM-dd')}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: new Date(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#9999cc]"
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Due</p>
                <input
                  type="date"
                  value={format(formData.endDate, 'yyyy-MM-dd')}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: new Date(e.target.value) }))}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#9999cc]"
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Notes</p>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add notes..."
                className="w-full resize-none border-0 border-b border-input bg-transparent py-1 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#9999cc] focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#9999cc] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      </motion.aside>
    </>
  );
}
