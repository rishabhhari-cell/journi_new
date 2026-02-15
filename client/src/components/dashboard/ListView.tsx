/**
 * List View Component
 * Displays tasks in a sortable table format
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, Calendar, Users, ArrowUpDown } from 'lucide-react';
import type { Task, Collaborator } from '@/types';
import { format } from 'date-fns';
import { getDaysDifference } from '@/lib/date-utils';

interface ListViewProps {
  tasks: Task[];
  collaborators: Collaborator[];
  onTaskClick: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
}

const statusConfig = {
  completed: { color: 'bg-status-completed', label: 'Completed', textColor: 'text-status-completed' },
  progress: { color: 'bg-status-progress', label: 'In Progress', textColor: 'text-status-progress' },
  pending: { color: 'bg-status-pending', label: 'Pending', textColor: 'text-status-pending' },
  delayed: { color: 'bg-status-delayed', label: 'Delayed', textColor: 'text-status-delayed' },
  upcoming: { color: 'bg-status-upcoming', label: 'Upcoming', textColor: 'text-status-upcoming' },
};

type SortField = 'name' | 'startDate' | 'endDate' | 'status' | 'duration';
type SortDirection = 'asc' | 'desc';

export default function ListView({ tasks, collaborators, onTaskClick, onTaskDelete }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Helper to get collaborator names
  const getAssigneeNames = (assignedTo?: string[]) => {
    if (!assignedTo || assignedTo.length === 0) return 'Unassigned';
    return assignedTo
      .map((id) => collaborators.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted tasks
  const sortedTasks = [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'startDate':
        comparison = a.startDate.getTime() - b.startDate.getTime();
        break;
      case 'endDate':
        comparison = a.endDate.getTime() - b.endDate.getTime();
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      case 'duration':
        const durationA = getDaysDifference(a.startDate, a.endDate);
        const durationB = getDaysDifference(b.startDate, b.endDate);
        comparison = durationA - durationB;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-journi-green transition-colors"
    >
      {children}
      <ArrowUpDown
        size={14}
        className={sortField === field ? 'text-journi-green' : 'text-muted-foreground'}
      />
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              <SortButton field="name">Task Name</SortButton>
            </th>
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              <SortButton field="status">Status</SortButton>
            </th>
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              <SortButton field="startDate">Start Date</SortButton>
            </th>
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              <SortButton field="endDate">End Date</SortButton>
            </th>
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              <SortButton field="duration">Duration</SortButton>
            </th>
            <th className="text-left py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              Assigned To
            </th>
            <th className="text-right py-3 px-4 text-xs font-bold text-foreground uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-sm text-muted-foreground">
                No tasks yet. Create your first task to get started!
              </td>
            </tr>
          ) : (
            sortedTasks.map((task, i) => {
              const config = statusConfig[task.status];
              const duration = getDaysDifference(task.startDate, task.endDate);

              return (
                <motion.tr
                  key={task.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="border-b border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => onTaskClick(task.id)}
                >
                  {/* Task Name */}
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.name}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}/15 ${config.textColor}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
                      {config.label}
                    </span>
                  </td>

                  {/* Start Date */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Calendar size={14} className="text-muted-foreground" />
                      {format(task.startDate, 'MMM d, yyyy')}
                    </div>
                  </td>

                  {/* End Date */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Calendar size={14} className="text-muted-foreground" />
                      {format(task.endDate, 'MMM d, yyyy')}
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="py-3 px-4">
                    <span className="text-sm text-foreground">
                      {duration} {duration === 1 ? 'day' : 'days'}
                    </span>
                  </td>

                  {/* Assigned To */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} className="text-muted-foreground" />
                      <span className="text-sm text-foreground">
                        {getAssigneeNames(task.assignedTo)}
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskClick(task.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-journi-green/10 text-muted-foreground hover:text-journi-green transition-colors"
                        title="Edit task"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete task "${task.name}"?`)) {
                            onTaskDelete(task.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-status-delayed/10 text-muted-foreground hover:text-status-delayed transition-colors"
                        title="Delete task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
