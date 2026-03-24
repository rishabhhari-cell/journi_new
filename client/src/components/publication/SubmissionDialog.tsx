/**
 * SubmissionDialog Component
 * Form for creating new publication submissions
 */
import { useState, useEffect } from 'react';
import { X, Send, BookOpen, Calendar } from 'lucide-react';
import type { SubmissionFormData, SubmissionStatus } from '@/types';

interface SubmissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (submission: SubmissionFormData) => void;
}

const SAMPLE_JOURNALS = [
  'Frontiers in Reproductive Medicine',
  'International Journal of Oncology',
  'Neuroscience Advances',
  'Journal of Molecular Biology',
  'Biomedical Engineering Review',
  'Clinical Research & Trials',
];

const STATUSES: { value: SubmissionStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'revision', label: 'Revision Requested' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

export default function SubmissionDialog({ isOpen, onClose, onSubmit }: SubmissionDialogProps) {
  const [formData, setFormData] = useState<SubmissionFormData>({
    title: '',
    journal: '',
    status: 'draft',
    submittedDate: new Date(),
  });

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        journal: '',
        status: 'draft',
        submittedDate: new Date(),
      });
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!(formData.title ?? '').trim()) {
      alert('Please enter a title');
      return;
    }
    if (!(formData.journal ?? '').trim()) {
      alert('Please select or enter a journal name');
      return;
    }

    onSubmit(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-journi-green/15 flex items-center justify-center">
                <Send size={20} className="text-journi-green" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">New Submission</h2>
                <p className="text-xs text-muted-foreground">Track your publication submission</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Manuscript Title <span className="text-status-delayed">*</span>
              </label>
              <input
                type="text"
                value={formData.title ?? ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Novel IVF Protocol Efficacy Study"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              />
            </div>

            {/* Journal */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Journal <span className="text-status-delayed">*</span>
              </label>
              <div className="relative">
                <BookOpen
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  list="journals"
                  value={formData.journal ?? ''}
                  onChange={(e) => setFormData({ ...formData, journal: e.target.value })}
                  placeholder="Select or type journal name"
                  className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
                <datalist id="journals">
                  {SAMPLE_JOURNALS.map((journal) => (
                    <option key={journal} value={journal} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status <span className="text-status-delayed">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as SubmissionStatus })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submitted Date */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Submission Date
              </label>
              <div className="relative">
                <Calendar
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="date"
                  value={formData.submittedDate?.toISOString().split('T')[0] ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, submittedDate: new Date(e.target.value) })
                  }
                  className="w-full pl-10 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                />
              </div>
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
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Send size={14} />
                Create Submission
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
