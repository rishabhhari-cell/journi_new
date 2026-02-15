/**
 * Journi Publication Portal — Fully Functional
 * Submission management with editable statuses and auto-calculating stats
 */
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SubmissionDialog from '@/components/publication/SubmissionDialog';
import StatusEditor from '@/components/publication/StatusEditor';
import { useSubmissions } from '@/contexts/SubmissionsContext';
import { motion } from 'framer-motion';
import { Send, Clock, CheckCircle2, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import type { SubmissionFormData } from '@/types';

export default function Publication() {
  const { submissions, stats, addSubmission, updateSubmissionStatus } = useSubmissions();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSubmissionSubmit = (formData: SubmissionFormData) => {
    addSubmission(formData);
  };

  // Generate timeline based on status
  const generateTimeline = (submission: any) => {
    const timeline: any[] = [];
    const raw = submission.submittedDate;
    const submittedDate = raw ? (raw instanceof Date ? raw : new Date(raw)) : new Date();

    if (submission.status === 'draft') {
      timeline.push(
        { step: 'Draft Ready', date: format(submittedDate, 'MMM d'), done: true, current: true },
        {
          step: 'Co-author Review',
          date: '~' + format(new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: false,
        },
        {
          step: 'Final Edits',
          date:
            '~' + format(new Date(submittedDate.getTime() + 14 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: false,
        },
        {
          step: 'Submit',
          date:
            '~' + format(new Date(submittedDate.getTime() + 21 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: false,
        }
      );
    } else if (submission.status === 'under_review') {
      timeline.push(
        { step: 'Submitted', date: format(submittedDate, 'MMM d'), done: true, current: false },
        {
          step: 'Editor Assigned',
          date: format(new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Peer Review',
          date: format(new Date(submittedDate.getTime() + 20 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Under Review',
          date: format(new Date(submittedDate.getTime() + 40 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: true,
        },
        {
          step: 'Decision',
          date:
            '~' + format(new Date(submittedDate.getTime() + 60 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: false,
        }
      );
    } else if (submission.status === 'revision') {
      timeline.push(
        { step: 'Submitted', date: format(submittedDate, 'MMM d'), done: true, current: false },
        {
          step: 'Editor Assigned',
          date: format(new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Peer Review',
          date: format(new Date(submittedDate.getTime() + 20 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Revision Requested',
          date: format(new Date(submittedDate.getTime() + 40 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: true,
        },
        {
          step: 'Decision',
          date:
            '~' + format(new Date(submittedDate.getTime() + 80 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: false,
          current: false,
        }
      );
    } else if (submission.status === 'accepted' || submission.status === 'published') {
      timeline.push(
        { step: 'Submitted', date: format(submittedDate, 'MMM d'), done: true, current: false },
        {
          step: 'Editor Assigned',
          date: format(new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Peer Review',
          date: format(new Date(submittedDate.getTime() + 20 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Minor Revisions',
          date: format(new Date(submittedDate.getTime() + 40 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Accepted',
          date: format(new Date(submittedDate.getTime() + 60 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: submission.status === 'accepted',
        }
      );
      if (submission.status === 'published') {
        timeline.push({
          step: 'Published',
          date: format(new Date(submittedDate.getTime() + 90 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: true,
        });
      }
    } else if (submission.status === 'rejected') {
      timeline.push(
        { step: 'Submitted', date: format(submittedDate, 'MMM d'), done: true, current: false },
        {
          step: 'Editor Assigned',
          date: format(new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Peer Review',
          date: format(new Date(submittedDate.getTime() + 20 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: false,
        },
        {
          step: 'Rejected',
          date: format(new Date(submittedDate.getTime() + 40 * 24 * 60 * 60 * 1000), 'MMM d'),
          done: true,
          current: true,
        }
      );
    }

    return timeline;
  };

  // Calculate progress based on status
  const getProgress = (status: string) => {
    switch (status) {
      case 'draft':
        return 25;
      case 'under_review':
        return 60;
      case 'revision':
        return 70;
      case 'accepted':
        return 100;
      case 'published':
        return 100;
      case 'rejected':
        return 100;
      default:
        return 0;
    }
  };

  const quickStats = [
    { label: 'Total Submissions', value: stats.total.toString(), icon: Send },
    { label: 'Under Review', value: stats.underReview.toString(), icon: Clock },
    { label: 'Accepted', value: stats.accepted.toString(), icon: CheckCircle2 },
    {
      label: 'Avg. Review Time',
      value: stats.avgReviewTime > 0 ? `${stats.avgReviewTime} days` : '—',
      icon: Clock,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <section className="pt-28 pb-8 bg-muted/30">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-extrabold text-foreground mb-2">Publication Portal</h1>
            <p className="text-muted-foreground text-lg">
              Manage submissions, track review progress, and monitor your publication pipeline
            </p>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {quickStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="bg-card rounded-xl border border-border p-4 flex items-center gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <div className="w-10 h-10 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0">
                  <stat.icon size={18} className="text-journi-green" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Submissions */}
      <section className="py-10">
        <div className="container">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Your Submissions</h2>
            <button
              onClick={() => setIsDialogOpen(true)}
              className="inline-flex items-center gap-2 bg-journi-green text-journi-slate text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Send size={15} />
              New Submission
            </button>
          </div>

          {submissions.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <Send size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">No submissions yet</p>
              <p className="text-xs text-muted-foreground">
                Click &quot;New Submission&quot; to add your first submission
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {submissions.map((sub, i) => {
                const timeline = generateTimeline(sub);
                const progress = getProgress(sub.status);

                return (
                  <motion.div
                    key={sub.id}
                    className="bg-card rounded-xl border border-border p-6 hover:shadow-lg hover:shadow-journi-green/5 transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                  >
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="text-base font-bold text-foreground">{sub.title}</h3>
                          <StatusEditor
                            submissionId={sub.id}
                            currentStatus={sub.status}
                            onStatusChange={updateSubmissionStatus}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <BookOpen size={12} className="inline mr-1" />
                          {sub.journalName || 'Unknown Journal'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Submitted: {format(sub.submittedDate ? (sub.submittedDate instanceof Date ? sub.submittedDate : new Date(sub.submittedDate)) : new Date(), 'MMM d, yyyy')}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Progress</span>
                        <span className="text-xs font-medium text-foreground">{progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            sub.status === 'accepted' || sub.status === 'published'
                              ? 'bg-status-completed'
                              : sub.status === 'draft'
                                ? 'bg-status-upcoming'
                                : sub.status === 'rejected'
                                  ? 'bg-status-delayed'
                                  : 'bg-status-progress'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        />
                      </div>
                    </div>

                    {/* Horizontal Timeline */}
                    <div className="flex items-center overflow-x-auto pb-2">
                      {timeline.map((step, j) => (
                        <div key={step.step} className="flex items-center shrink-0">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                            ${
                              step.done
                                ? 'bg-status-completed text-white'
                                : step.current
                                  ? 'bg-status-progress text-white ring-2 ring-status-progress/30'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                            >
                              {step.done ? <CheckCircle2 size={12} /> : j + 1}
                            </div>
                            <p
                              className={`text-[10px] mt-1.5 whitespace-nowrap ${step.current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                            >
                              {step.step}
                            </p>
                            <p className="text-[9px] text-muted-foreground/60">{step.date}</p>
                          </div>
                          {j < timeline.length - 1 && (
                            <div
                              className={`w-12 md:w-20 h-0.5 mx-1 ${step.done ? 'bg-status-completed' : 'bg-border'}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />

      {/* Submission Dialog */}
      <SubmissionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmissionSubmit}
      />
    </div>
  );
}
