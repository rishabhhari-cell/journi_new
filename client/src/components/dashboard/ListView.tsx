import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpDown, Edit2, Trash2 } from 'lucide-react';
import { format, isBefore, startOfDay } from 'date-fns';
import type { Collaborator, Task } from '@/types';

interface ListViewProps {
  tasks: Task[];
  collaborators: Collaborator[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
}

type SortField = 'name' | 'priority' | 'completionPct' | 'endDate';
type SortDirection = 'asc' | 'desc';

const priorityOrder: Record<Task['priority'], number> = {
  urgent: 0,
  medium: 1,
  low: 2,
};

const statusClasses: Record<Task['status'], string> = {
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  delayed: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  upcoming: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const statusLabel: Record<Task['status'], string> = {
  completed: 'Completed',
  progress: 'In Progress',
  pending: 'Pending',
  delayed: 'Delayed',
  upcoming: 'Upcoming',
};

const priorityStyles: Record<Task['priority'], string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const priorityLabel: Record<Task['priority'], string> = {
  urgent: '\uD83D\uDD34 Urgent',
  medium: '\uD83D\uDFE1 Medium',
  low: '\u26AA Low',
};

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAvatarLabel(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}

function nextPriority(priority: Task['priority']): Task['priority'] {
  if (priority === 'urgent') return 'medium';
  if (priority === 'medium') return 'low';
  return 'urgent';
}

export default function ListView({ tasks, collaborators, onEdit, onDelete, onUpdate }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('endDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const collaboratorMap = useMemo(
    () => new Map(collaborators.map((collaborator) => [collaborator.id, collaborator])),
    [collaborators],
  );

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'priority':
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'completionPct':
          comparison = clampPct(a.completionPct) - clampPct(b.completionPct);
          break;
        case 'endDate':
          comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortDirection, sortField, tasks]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection('asc');
  };

  const HeaderCell = ({
    label,
    field,
    className,
  }: {
    label: string;
    field?: SortField;
    className?: string;
  }) => {
    if (!field) {
      return <div className={className}>{label}</div>;
    }

    const isActive = sortField === field;

    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`group/header inline-flex items-center gap-1 text-left ${className || ''}`}
      >
        <span>{label}</span>
        <ArrowUpDown
          size={12}
          className={`${isActive ? 'opacity-100 text-foreground' : 'opacity-0 text-muted-foreground'} transition-opacity group-hover/header:opacity-100`}
        />
      </button>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 48 48"
          className="mb-3 h-12 w-12 text-muted-foreground/30"
          fill="none"
        >
          <rect x="11" y="8" width="26" height="34" rx="3" stroke="currentColor" strokeWidth="2" />
          <rect x="18" y="4" width="12" height="6" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M17 19h14M17 25h14M17 31h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground">No tasks yet</p>
        <p className="text-xs text-muted-foreground/60">Add your first task to get started</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-1 grid grid-cols-[1.5rem_1fr_7rem_8rem_10rem_11rem_5rem] items-center gap-x-4 border-b border-border pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <HeaderCell label="" className="" />
        <HeaderCell label="Task" field="name" />
        <HeaderCell label="Priority" field="priority" />
        <HeaderCell label="Assignees" />
        <HeaderCell label="Progress" field="completionPct" />
        <HeaderCell label="Due" field="endDate" />
        <HeaderCell label="" className="text-right" />
      </div>

      <AnimatePresence initial={false}>
        {sortedTasks.map((task) => {
          const pct = clampPct(task.completionPct);
          const isDone = pct === 100;
          const dueDate = new Date(task.endDate);
          const startDate = new Date(task.startDate);
          const today = startOfDay(new Date());
          const dueStart = startOfDay(dueDate);
          const msPerDay = 1000 * 60 * 60 * 24;
          const daysToDue = Math.ceil((dueStart.getTime() - today.getTime()) / msPerDay);
          const isPastDue = isBefore(dueStart, today) && !isDone;
          const isNearDue = !isPastDue && daysToDue <= 7 && !isDone;

          const dueClassName = isPastDue
            ? 'font-medium text-red-500 dark:text-red-400'
            : isNearDue
              ? 'font-medium text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground';

          const assignees = (task.assignedTo || [])
            .map((id) => collaboratorMap.get(id))
            .filter((collaborator): collaborator is Collaborator => Boolean(collaborator));

          return (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isDone ? 0.6 : 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={`group relative grid grid-cols-[1.5rem_1fr_7rem_8rem_10rem_11rem_5rem] items-center gap-x-4 rounded-lg px-2 py-2.5 transition-colors cursor-default hover:bg-accent/50 ${isDone ? 'bg-muted/30 transition-opacity duration-300' : ''}`}
            >
              <button
                type="button"
                onClick={() => {
                  if (isDone) {
                    onUpdate(task.id, { completionPct: 0, status: 'pending' });
                    return;
                  }
                  onUpdate(task.id, { completionPct: 100, status: 'completed' });
                }}
                className={`flex h-4 w-4 items-center justify-center rounded border-2 border-muted-foreground/40 transition-colors hover:border-[#9999cc] ${isDone ? 'border-emerald-500 bg-emerald-500 hover:border-emerald-500' : ''}`}
                aria-label={isDone ? `Mark ${task.name} as not completed` : `Mark ${task.name} as completed`}
              >
                {isDone && (
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-white" fill="none" aria-hidden="true">
                    <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${isDone ? 'line-through text-muted-foreground/60' : 'text-foreground'}`}>
                  {task.name}
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-2">
                  {task.description ? (
                    <p className="truncate text-xs text-muted-foreground">{task.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">No notes</p>
                  )}
                  <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusClasses[task.status]}`}>
                    {statusLabel[task.status]}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdate(task.id, { priority: nextPriority(task.priority) })}
                className={`inline-flex w-fit items-center rounded-full px-2 py-1 text-xs font-medium ${priorityStyles[task.priority]}`}
                aria-label={`Change priority for ${task.name}`}
              >
                {priorityLabel[task.priority]}
              </button>

              <div className="flex items-center">
                {assignees.length === 0 ? (
                  <span className="text-xs text-muted-foreground">-</span>
                ) : (
                  <div className="flex items-center">
                    {assignees.slice(0, 3).map((assignee, index) => (
                      <div
                        key={assignee.id}
                        className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#9999cc] text-[10px] font-bold text-white ${index > 0 ? '-ml-1.5' : ''}`}
                        title={assignee.name}
                      >
                        {getAvatarLabel(assignee.name)}
                      </div>
                    ))}
                    {assignees.length > 3 && (
                      <div className="-ml-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#9999cc] px-1 text-[10px] font-bold text-white">
                        +{assignees.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="w-7 text-right text-xs font-medium">{pct}%</span>
                <div className="h-1.5 flex-1 rounded-full bg-muted">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-[#9999cc]'}`}
                  />
                </div>
              </div>

              <div>
                <p className={`text-xs ${dueClassName}`}>{format(dueDate, 'MMM d')}</p>
                <p className="text-[10px] text-muted-foreground/60">
                  {format(startDate, 'MMM d')} -&gt; {format(dueDate, 'MMM d')}
                </p>
              </div>

              <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`Edit ${task.name}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`Delete ${task.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
