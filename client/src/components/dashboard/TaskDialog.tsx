/**
 * Task Dialog Component
 * Form for adding and editing tasks with date pickers, status, and assignees
 */
import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Users } from 'lucide-react';
import type { Task, TaskFormData, Collaborator, TaskStatus } from '@/types';
import { format } from 'date-fns';

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: TaskFormData) => void;
  task?: Task; // If provided, we're editing; otherwise, creating
  collaborators: Collaborator[];
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'progress', label: 'In Progress' },
  { value: 'pending', label: 'Pending' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'upcoming', label: 'Upcoming' },
];

export default function TaskDialog({
  isOpen,
  onClose,
  onSubmit,
  task,
  collaborators,
}: TaskDialogProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    status: 'pending',
    assignedTo: [],
    description: '',
  });

  // Populate form when editing existing task
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        status: task.status,
        assignedTo: task.assignedTo || [],
        description: task.description || '',
      });
    } else {
      // Reset form for new task
      setFormData({
        name: '',
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        assignedTo: [],
        description: '',
      });
    }
  }, [task, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert('Please enter a task name');
      return;
    }

    if (formData.startDate >= formData.endDate) {
      alert('End date must be after start date');
      return;
    }

    onSubmit(formData);
    onClose();
  };

  const handleAssigneeToggle = (collaboratorId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedTo: prev.assignedTo?.includes(collaboratorId)
        ? prev.assignedTo.filter((id) => id !== collaboratorId)
        : [...(prev.assignedTo || []), collaboratorId],
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">
              {task ? 'Edit Task' : 'New Task'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Task Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Task Name <span className="text-status-delayed">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Literature Review"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                autoFocus
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={format(formData.startDate, 'yyyy-MM-dd')}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: new Date(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={format(formData.endDate, 'yyyy-MM-dd')}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: new Date(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as TaskStatus })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign To
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                {collaborators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No collaborators available</p>
                ) : (
                  collaborators.map((collab) => (
                    <label
                      key={collab.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-accent p-2 rounded-md transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedTo?.includes(collab.id) || false}
                        onChange={() => handleAssigneeToggle(collab.id)}
                        className="w-4 h-4 rounded border-border text-journi-green focus:ring-journi-green"
                      />
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-journi-green/20 flex items-center justify-center text-[10px] font-bold text-journi-green">
                          {collab.initials}
                        </div>
                        <span className="text-sm text-foreground">{collab.name}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add task details..."
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                {task ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
