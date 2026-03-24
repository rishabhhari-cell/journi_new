/**
 * Collaborator Manager Component
 * Manages team members - add, remove, update roles
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Mail, UserCheck, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import type { Collaborator, CollaboratorFormData, CollaboratorRole } from '@/types';

interface CollaboratorManagerProps {
  collaborators: Collaborator[];
  onAddCollaborator: (collaborator: CollaboratorFormData) => void;
  onRemoveCollaborator: (collaboratorId: string) => void;
  onUpdateCollaborator: (collaboratorId: string, updates: Partial<Collaborator>) => void;
}

const roleOptions: { value: CollaboratorRole; label: string; description: string }[] = [
  { value: 'lead_author', label: 'Lead Author', description: 'Primary researcher and writer' },
  { value: 'co_author', label: 'Co-Author', description: 'Contributing author' },
  { value: 'supervisor', label: 'Supervisor', description: 'Project advisor' },
  { value: 'contributor', label: 'Contributor', description: 'Supporting role' },
];

export default function CollaboratorManager({
  collaborators,
  onAddCollaborator,
  onRemoveCollaborator,
  onUpdateCollaborator,
}: CollaboratorManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CollaboratorFormData>({
    name: '',
    email: '',
    role: 'contributor',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert('Please enter a name');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      alert('Please enter a valid email');
      return;
    }

    onAddCollaborator(formData);

    // Reset form
    setFormData({
      name: '',
      email: '',
      role: 'contributor',
    });
    setShowAddForm(false);
  };

  const handleRoleChange = (collaboratorId: string, newRole: CollaboratorRole) => {
    onUpdateCollaborator(collaboratorId, { role: newRole });
    setEditingId(null);
  };

  const getRoleInfo = (role: CollaboratorRole) => {
    return roleOptions.find((opt) => opt.value === role);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Team Members</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {collaborators.length} {collaborators.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-journi-green text-journi-slate text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Add Member
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          onSubmit={handleSubmit}
          className="bg-accent/50 rounded-lg border border-border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Add New Member</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Name <span className="text-status-delayed">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Dr. Jane Smith"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Email <span className="text-status-delayed">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane.smith@university.edu"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Role</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value as CollaboratorRole })
              }
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 bg-journi-green text-journi-slate rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Add Member
            </button>
          </div>
        </motion.form>
      )}

      {/* Collaborators List */}
      <div className="space-y-2">
        {collaborators.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No team members yet. Add your first collaborator!
          </div>
        ) : (
          collaborators.map((collab, i) => {
            const roleInfo = getRoleInfo(collab.role);

            return (
              <motion.div
                key={collab.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-journi-green/30 transition-colors group"
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-journi-green shrink-0 ${
                    collab.online ? 'bg-journi-green/20 ring-2 ring-journi-green/30' : 'bg-journi-green/15'
                  }`}
                >
                  {collab.initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {collab.name}
                    </p>
                    {collab.online && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-journi-green/15 text-journi-green text-[10px] font-medium">
                        <span className="w-1 h-1 rounded-full bg-journi-green" />
                        Online
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Mail size={12} className="text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{collab.email}</p>
                  </div>
                </div>

                {/* Role Selector */}
                <div className="relative">
                  {editingId === collab.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={collab.role}
                        onChange={(e) =>
                          handleRoleChange(collab.id, e.target.value as CollaboratorRole)
                        }
                        className="px-2 py-1 bg-background border border-border rounded text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                        autoFocus
                        onBlur={() => setEditingId(null)}
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingId(collab.id)}
                      className="px-2 py-1 rounded-md bg-accent text-xs font-medium text-foreground hover:bg-accent/80 transition-colors"
                      title="Click to change role"
                    >
                      {roleInfo?.label}
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${collab.name} from the team?`)) {
                        onRemoveCollaborator(collab.id);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-status-delayed/10 text-muted-foreground hover:text-status-delayed transition-colors"
                    title="Remove member"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
