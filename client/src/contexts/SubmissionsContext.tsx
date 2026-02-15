import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import type { Submission, SubmissionStats, SubmissionFormData, SubmissionStatus } from '@/types';
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from '@/lib/storage';
import { getDaysDifference } from '@/lib/date-utils';
import { generateSampleSubmissions } from '@/data/generators';
import { useJournals } from './JournalsContext';
import { useManuscript } from './ManuscriptContext';

// ============================================================================
// Context Type Definition
// ============================================================================

interface SubmissionsContextType {
  submissions: Submission[];
  stats: SubmissionStats;
  addSubmission: (submission: SubmissionFormData) => void;
  updateSubmissionStatus: (submissionId: string, status: SubmissionStatus) => void;
  deleteSubmission: (submissionId: string) => void;
  getSubmission: (submissionId: string) => Submission | undefined;
}

// ============================================================================
// Create Context
// ============================================================================

const SubmissionsContext = createContext<SubmissionsContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

interface SubmissionsProviderProps {
  children: ReactNode;
}

export function SubmissionsProvider({ children }: SubmissionsProviderProps) {
  const { allJournals } = useJournals();
  const { manuscript } = useManuscript();

  // Load initial data from localStorage or generate sample data
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    const stored = loadFromStorage<Submission[] | null>(STORAGE_KEYS.SUBMISSIONS, null);
    if (stored && stored.length > 0) {
      return stored;
    }
    const generated = generateSampleSubmissions(manuscript.id, allJournals.slice(0, 3));
    saveToStorage(STORAGE_KEYS.SUBMISSIONS, generated);
    return generated;
  });

  // Save to localStorage whenever submissions change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SUBMISSIONS, submissions);
  }, [submissions]);

  // ========================================
  // Auto-calculating Stats
  // ========================================

  const stats: SubmissionStats = useMemo(() => {
    const total = submissions.length;
    const underReview = submissions.filter((s) => s.status === 'under_review').length;
    const accepted = submissions.filter((s) => s.status === 'accepted').length;

    // Calculate average review time for completed submissions
    const completedSubmissions = submissions.filter(
      (s) => s.actualDecisionDate && s.submittedDate
    );
    const avgReviewTime =
      completedSubmissions.length > 0
        ? completedSubmissions.reduce(
            (sum, s) =>
              sum + getDaysDifference(s.submittedDate!, s.actualDecisionDate!),
            0
          ) / completedSubmissions.length
        : 0;

    return {
      total,
      underReview,
      accepted,
      avgReviewTime: Math.round(avgReviewTime),
    };
  }, [submissions]);

  // ========================================
  // Submission Management Functions
  // ========================================

  const addSubmission = (submissionData: SubmissionFormData) => {
    const journal = allJournals.find((j) => j.id === submissionData.journalId);
    const submittedDate = new Date();
    const estimatedDecisionDate = new Date(submittedDate);
    estimatedDecisionDate.setDate(
      estimatedDecisionDate.getDate() + (journal?.avgDecisionDays || 60)
    );

    const newSubmission: Submission = {
      id: nanoid(),
      manuscriptId: submissionData.manuscriptId,
      journalId: submissionData.journalId,
      journalName: journal?.name || 'Unknown Journal',
      title: manuscript.title,
      status: 'draft',
      submittedDate,
      estimatedDecisionDate,
      timeline: [
        { step: 'Draft', date: submittedDate.toISOString(), done: true, current: true },
        { step: 'Submitted', date: '', done: false, current: false },
        { step: 'Under Review', date: '', done: false, current: false },
        { step: 'Decision', date: '', done: false, current: false },
      ],
      progress: 25,
      coverLetter: submissionData.coverLetter,
      keywords: submissionData.keywords,
    };

    setSubmissions((prev) => [...prev, newSubmission]);
  };

  const updateSubmissionStatus = (submissionId: string, status: SubmissionStatus) => {
    setSubmissions((prev) =>
      prev.map((submission) => {
        if (submission.id !== submissionId) return submission;

        // Calculate progress based on status
        let progress = 25;
        let timeline = [...submission.timeline];

        switch (status) {
          case 'draft':
            progress = 25;
            timeline = timeline.map((step, i) => ({
              ...step,
              done: i === 0,
              current: i === 0,
            }));
            break;
          case 'under_review':
            progress = 50;
            timeline = timeline.map((step, i) => ({
              ...step,
              done: i <= 2,
              current: i === 2,
            }));
            break;
          case 'revision':
            progress = 75;
            timeline = timeline.map((step, i) => ({
              ...step,
              done: i <= 2,
              current: i === 2,
            }));
            break;
          case 'accepted':
            progress = 100;
            timeline = timeline.map((step) => ({
              ...step,
              done: true,
              current: false,
            }));
            break;
          case 'rejected':
            progress = 100;
            timeline = timeline.map((step) => ({
              ...step,
              done: true,
              current: false,
            }));
            break;
        }

        return {
          ...submission,
          status,
          progress,
          timeline,
          actualDecisionDate:
            status === 'accepted' || status === 'rejected'
              ? new Date()
              : undefined,
        };
      })
    );
  };

  const deleteSubmission = (submissionId: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
  };

  const getSubmission = (submissionId: string): Submission | undefined => {
    return submissions.find((s) => s.id === submissionId);
  };

  // ========================================
  // Context Value
  // ========================================

  const value: SubmissionsContextType = {
    submissions,
    stats,
    addSubmission,
    updateSubmissionStatus,
    deleteSubmission,
    getSubmission,
  };

  return <SubmissionsContext.Provider value={value}>{children}</SubmissionsContext.Provider>;
}

// ============================================================================
// Hook to use Submissions Context
// ============================================================================

export function useSubmissions() {
  const context = useContext(SubmissionsContext);
  if (context === undefined) {
    throw new Error('useSubmissions must be used within a SubmissionsProvider');
  }
  return context;
}
