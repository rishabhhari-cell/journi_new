/**
 * StatusEditor Component
 * Inline editor for submission status with dropdown
 */
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { SubmissionStatus } from '@/types';

interface StatusEditorProps {
  submissionId: string;
  currentStatus: SubmissionStatus;
  onStatusChange: (submissionId: string, newStatus: SubmissionStatus) => void;
}

const STATUS_OPTIONS: { value: SubmissionStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-status-upcoming text-white' },
  { value: 'under_review', label: 'Under Review', color: 'bg-status-progress text-white' },
  { value: 'revision', label: 'Revision', color: 'bg-status-pending text-white' },
  { value: 'accepted', label: 'Accepted', color: 'bg-status-completed text-white' },
  { value: 'rejected', label: 'Rejected', color: 'bg-status-delayed text-white' },
  { value: 'published', label: 'Published', color: 'bg-journi-green text-white' },
];

export default function StatusEditor({
  submissionId,
  currentStatus,
  onStatusChange,
}: StatusEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = STATUS_OPTIONS.find((opt) => opt.value === currentStatus);

  const handleStatusSelect = (newStatus: SubmissionStatus) => {
    onStatusChange(submissionId, newStatus);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      {/* Current Status Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentOption?.color
        } ${isOpen ? 'ring-2 ring-journi-green/50' : ''}`}
      >
        {currentOption?.label}
        <ChevronDown
          size={12}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown Menu */}
          <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-20 min-w-[160px] overflow-hidden">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusSelect(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  option.value === currentStatus
                    ? 'bg-journi-green/10 text-journi-green font-medium'
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${option.color.replace('text-white', '')}`}
                  />
                  {option.label}
                </span>
                {option.value === currentStatus && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
