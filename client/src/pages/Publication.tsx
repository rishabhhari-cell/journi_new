import { useState } from 'react';
import {
  Plus,
  Send,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Trash2,
  ChevronDown,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import { MeshGradient } from "@paper-design/shaders-react";
import Navbar from '@/components/Navbar';
import SubmissionDialog from '@/components/publication/SubmissionDialog';
import { useSubmissions } from '@/contexts/SubmissionsContext';
import type { SubmissionStatus, Submission } from '@/types';

// Status config
const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', bg: 'bg-muted/60', dot: 'bg-muted-foreground' },
  under_review: { label: 'Under Review', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  revision: { label: 'Revision Requested', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  accepted: { label: 'Accepted', color: 'text-journi-green', bg: 'bg-journi-green/10', dot: 'bg-journi-green' },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
  published: { label: 'Published', color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
};

const ALL_STATUSES: SubmissionStatus[] = [
  'draft', 'under_review', 'revision', 'accepted', 'rejected', 'published',
];

function formatDate(date?: Date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Submission card
function SubmissionCard({ submission }: { submission: Submission }) {
  const { updateSubmissionStatus, deleteSubmission } = useSubmissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = STATUS_CONFIG[submission.status];

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-[#9999cc]/45">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {submission.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{submission.journalName}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40"
            >
              Change status <ChevronDown size={12} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                  {ALL_STATUSES.map((s) => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          updateSubmissionStatus(submission.id, s);
                          setMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent ${
                          submission.status === s ? 'font-semibold text-journi-green' : 'text-foreground'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => deleteSubmission(submission.id)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
            title="Delete submission"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{submission.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              submission.status === 'rejected'
                ? 'bg-red-400'
                : submission.status === 'accepted' || submission.status === 'published'
                  ? 'bg-journi-green'
                  : 'bg-blue-400'
            }`}
            style={{ width: `${submission.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-0">
        {submission.timeline.map((step, i) => (
          <div key={step.step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-colors ${
                  step.done
                    ? 'border-journi-green bg-journi-green text-white'
                    : step.current
                      ? 'border-blue-400 bg-blue-50 text-blue-500'
                      : 'border-border bg-background text-muted-foreground'
                }`}
              >
                {step.done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </div>
              <span className="mt-1 whitespace-nowrap text-[9px] text-muted-foreground">{step.step}</span>
            </div>
            {i < submission.timeline.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 rounded-full ${step.done ? 'bg-journi-green' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays size={12} />
          Submitted: <span className="ml-0.5 font-medium text-foreground">{formatDate(submission.submittedDate)}</span>
        </span>
        {submission.estimatedDecisionDate && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Est. decision: <span className="ml-0.5 font-medium text-foreground">{formatDate(submission.estimatedDecisionDate)}</span>
          </span>
        )}
        {submission.actualDecisionDate && (
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} />
            Decision: <span className="ml-0.5 font-medium text-foreground">{formatDate(submission.actualDecisionDate)}</span>
          </span>
        )}
      </div>
    </article>
  );
}

// Main page
export default function Publication() {
  const { submissions, stats, addSubmission } = useSubmissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');

  const filtered =
    statusFilter === 'all'
      ? submissions
      : submissions.filter((s) => s.status === statusFilter);

  return (
    <>
      <Navbar />

      <div className="min-h-screen bg-muted/20 pt-16">
        {/* Page header */}
        <div className="relative overflow-hidden px-4 py-10">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <MeshGradient
              className="absolute inset-0 h-full w-full opacity-50"
              colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#D6CFF5", "#E8E2F6"]}
              speed={0.2}
            />
          </div>

          <div className="container relative z-10 max-w-5xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  Submission Tracker
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage and monitor your manuscript submissions across journals.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-journi-green px-4 py-2.5 text-sm font-semibold text-journi-slate transition-opacity hover:opacity-90"
              >
                <Plus size={16} />
                New Submission
              </button>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  label: 'Total Submissions',
                  value: stats.total,
                  icon: <FileText size={18} className="text-muted-foreground" />,
                },
                {
                  label: 'Under Review',
                  value: stats.underReview,
                  icon: <Send size={18} className="text-blue-600" />,
                },
                {
                  label: 'Accepted',
                  value: stats.accepted,
                  icon: <CheckCircle2 size={18} className="text-journi-green" />,
                },
                {
                  label: 'Avg. Review Time',
                  value: stats.avgReviewTime > 0 ? `${stats.avgReviewTime}d` : '-',
                  icon: <TrendingUp size={18} className="text-muted-foreground" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    {stat.icon}
                  </div>
                  <p className="mt-1.5 text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="container max-w-5xl space-y-5 py-8">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', ...ALL_STATUSES] as const).map((s) => {
              const label = s === 'all' ? 'All' : STATUS_CONFIG[s].label;
              const count =
                s === 'all'
                  ? submissions.length
                  : submissions.filter((sub) => sub.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40 ${
                    statusFilter === s
                      ? 'bg-journi-green font-semibold text-journi-slate'
                      : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        statusFilter === s ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card py-20 text-center">
              <Send size={32} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-foreground">No submissions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click "New Submission" to start tracking your submissions.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-journi-green px-4 py-2 text-sm font-semibold text-journi-slate transition-opacity hover:opacity-90"
              >
                <Plus size={14} />
                Add your first submission
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filtered.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </div>
          )}
        </main>
      </div>

      <SubmissionDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={addSubmission}
      />
    </>
  );
}
