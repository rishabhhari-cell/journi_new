import { useState } from 'react';
import {
  Plus,
  Send,
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

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  draft:        { label: 'Draft',             color: 'text-muted-foreground', bg: 'bg-muted/60',         dot: 'bg-muted-foreground' },
  under_review: { label: 'Under Review',      color: 'text-blue-600',         bg: 'bg-blue-50',          dot: 'bg-blue-500' },
  revision:     { label: 'Revision Requested',color: 'text-amber-600',        bg: 'bg-amber-50',         dot: 'bg-amber-500' },
  accepted:     { label: 'Accepted',          color: 'text-journi-green',     bg: 'bg-journi-green/10',  dot: 'bg-journi-green' },
  rejected:     { label: 'Rejected',          color: 'text-red-600',          bg: 'bg-red-50',           dot: 'bg-red-500' },
  published:    { label: 'Published',         color: 'text-purple-600',       bg: 'bg-purple-50',        dot: 'bg-purple-500' },
};

const ALL_STATUSES: SubmissionStatus[] = [
  'draft', 'under_review', 'revision', 'accepted', 'rejected', 'published',
];

function formatDate(date?: Date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Submission Card ────────────────────────────────────────────────────────────

function SubmissionCard({ submission }: { submission: Submission }) {
  const { updateSubmissionStatus, deleteSubmission } = useSubmissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = STATUS_CONFIG[submission.status];

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm hover:border-[#9999cc]/45 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* Left: title + journal */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-foreground leading-snug line-clamp-2">
            {submission.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{submission.journalName}</p>
        </div>

        {/* Right: status changer + delete */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40"
            >
              Change status <ChevronDown size={12} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-card border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                  {ALL_STATUSES.map((s) => {
                    const sc = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          updateSubmissionStatus(submission.id, s);
                          setMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-accent ${
                          submission.status === s ? 'text-journi-green font-semibold' : 'text-foreground'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
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
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete submission"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progress</span>
          <span>{submission.progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              submission.status === 'rejected' ? 'bg-red-400' :
              submission.status === 'accepted' || submission.status === 'published' ? 'bg-journi-green' :
              'bg-blue-400'
            }`}
            style={{ width: `${submission.progress}%` }}
          />
        </div>
      </div>

      {/* Timeline steps */}
      <div className="mt-4 flex items-center gap-0">
        {submission.timeline.map((step, i) => (
          <div key={step.step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-colors ${
                step.done
                  ? 'border-journi-green bg-journi-green text-white'
                  : step.current
                  ? 'border-blue-400 bg-blue-50 text-blue-500'
                  : 'border-border bg-background text-muted-foreground'
              }`}>
                {step.done ? '✓' : i + 1}
              </div>
              <span className="mt-1 text-[9px] text-muted-foreground whitespace-nowrap">{step.step}</span>
            </div>
            {i < submission.timeline.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full ${step.done ? 'bg-journi-green' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays size={12} />
          Submitted: <span className="font-medium text-foreground ml-0.5">{formatDate(submission.submittedDate)}</span>
        </span>
        {submission.estimatedDecisionDate && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Est. decision: <span className="font-medium text-foreground ml-0.5">{formatDate(submission.estimatedDecisionDate)}</span>
          </span>
        )}
        {submission.actualDecisionDate && (
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} />
            Decision: <span className="font-medium text-foreground ml-0.5">{formatDate(submission.actualDecisionDate)}</span>
          </span>
        )}
      </div>
    </article>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

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
        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-10">
          <div className="container max-w-5xl">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  Submission Tracker
                </h1>
                <p className="mt-1 text-sm text-white/60">
                  Manage and monitor your manuscript submissions across journals.
                </p>
              </div>
              <button
                onClick={() => setDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
              >
                <Plus size={16} />
                New Submission
              </button>
            </div>

            {/* Stats row */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Submissions',
                  value: stats.total,
                  icon: <FileText size={18} className="text-white/60" />,
                },
                {
                  label: 'Under Review',
                  value: stats.underReview,
                  icon: <Send size={18} className="text-blue-400" />,
                },
                {
                  label: 'Accepted',
                  value: stats.accepted,
                  icon: <CheckCircle2 size={18} className="text-journi-green" />,
                },
                {
                  label: 'Avg. Review Time',
                  value: stats.avgReviewTime > 0 ? `${stats.avgReviewTime}d` : '—',
                  icon: <TrendingUp size={18} className="text-white/60" />,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/50">{stat.label}</p>
                    {stat.icon}
                  </div>
                  <p className="mt-1.5 text-2xl font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <main className="container max-w-5xl py-8 relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <MeshGradient
              className="absolute inset-0 w-full h-full opacity-50"
              colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#D6CFF5", "#E8E2F6"]}
              speed={0.2}
            />
          </div>

          <div className="relative z-10 space-y-5">
          {/* Filter tabs */}
          <div className="flex items-center gap-2 flex-wrap">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journi-green/40 ${
                    statusFilter === s
                      ? 'bg-journi-green text-journi-slate font-semibold'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      statusFilter === s ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Submission list */}
          {filtered.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card">
              <Send size={32} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium text-foreground">No submissions yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click "New Submission" to start tracking your submissions.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus size={14} />
                Add your first submission
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((submission) => (
                <SubmissionCard key={submission.id} submission={submission} />
              ))}
            </div>
          )}
          </div>
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
