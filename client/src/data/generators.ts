// Mock data generators for Journi Platform

import { nanoid } from 'nanoid';
import type {
  Project,
  Task,
  TaskPriority,
  Collaborator,
  Manuscript,
  DocumentSection,
  Citation,
  Submission,
  Comment,
  Activity,
  TaskStatus,
  CollaboratorRole,
  CitationType,
} from '@/types';
import type { Journal } from '@/types';

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================================
// Project & Task Data Generation
// ============================================================================

const TASK_NAMES = [
  'Literature Review',
  'Data Collection',
  'Experimental Design',
  'Run Experiments',
  'Data Analysis',
  'Statistical Analysis',
  'Write Methods Section',
  'Write Results Section',
  'Write Discussion',
  'Create Figures',
  'Prepare Tables',
  'IRB Approval',
  'Grant Application',
  'Peer Review',
  'Revise Manuscript',
  'Submit to Journal',
];

const TASK_STATUSES: TaskStatus[] = ['completed', 'progress', 'pending', 'delayed', 'upcoming'];
const TASK_PRIORITIES: TaskPriority[] = ['urgent', 'urgent', 'medium', 'medium', 'medium', 'medium', 'medium', 'low', 'low', 'low'];

function getCompletionPctForStatus(status: TaskStatus): number {
  if (status === 'completed') return 100;
  if (status === 'progress') return randomNumber(20, 80);
  return 0;
}

function generateTask(collaboratorIds: string[]): Task {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + randomNumber(-30, 30));
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + randomNumber(5, 30));
  const status = randomElement(TASK_STATUSES);

  return {
    id: nanoid(),
    name: randomElement(TASK_NAMES),
    startDate,
    endDate,
    status,
    priority: randomElement(TASK_PRIORITIES),
    completionPct: getCompletionPctForStatus(status),
    assignedTo: Array.from({ length: randomNumber(0, 2) }, () => randomElement(collaboratorIds)),
    description: 'Task description placeholder',
  };
}

const FIRST_NAMES = ['Emily', 'Michael', 'Sarah', 'David', 'Lisa', 'John', 'Maria', 'Robert', 'Jennifer', 'James'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const SUBJECT_AREAS = ['Molecular Biology', 'Neuroscience', 'Oncology', 'Cardiology', 'Immunology', 'Genetics', 'Pharmacology', 'Public Health', 'Biochemistry', 'Cell Biology'];

function generateOrcid(): string {
  const seg = () => String(Math.floor(1000 + Math.random() * 9000));
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

function generateCollaborator(role: CollaboratorRole): Collaborator {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const initials = `${firstName[0]}${lastName[0]}`;

  return {
    id: nanoid(),
    name: `Dr. ${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu`,
    role,
    initials,
    online: Math.random() > 0.5,
    orcidId: Math.random() > 0.25 ? generateOrcid() : undefined, // ~75% have ORCID
  };
}

export function generateSampleProject(): Project {
  const collaborators = [
    generateCollaborator('lead_author'),
    generateCollaborator('co_author'),
    generateCollaborator('co_author'),
    generateCollaborator('supervisor'),
    generateCollaborator('contributor'),
  ];

  const collaboratorIds = collaborators.map((c) => c.id);
  const tasks = Array.from({ length: randomNumber(5, 10) }, () => generateTask(collaboratorIds));

  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - randomNumber(30, 180));

  return {
    id: nanoid(),
    title: 'Tetraplan IVF Study',
    description: 'Research project on IVF treatment outcomes',
    status: 'active',
    createdAt,
    updatedAt: new Date(),
    tasks,
    collaborators,
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  };
}

export function generateSampleProject2(): Project {
  const collaborators = [
    generateCollaborator('lead_author'),
    generateCollaborator('co_author'),
    generateCollaborator('supervisor'),
    generateCollaborator('contributor'),
  ];

  const collaboratorIds = collaborators.map((c) => c.id);
  const tasks = Array.from({ length: randomNumber(4, 8) }, () => generateTask(collaboratorIds));

  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - randomNumber(10, 60));

  return {
    id: nanoid(),
    title: 'CRISPR Gene Therapy Study',
    description: 'Investigating CRISPR-Cas9 delivery mechanisms for targeted gene therapy',
    status: 'active',
    createdAt,
    updatedAt: new Date(),
    tasks,
    collaborators,
    dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
  };
}

// ============================================================================
// Manuscript Data Generation
// ============================================================================

const SECTION_TITLES = [
  'Title',
  'Abstract',
  'Introduction',
  'Literature Review',
  'Methods',
  'Results',
  'Discussion',
  'Conclusion',
  'References',
];

function generateSection(title: string, index: number): DocumentSection {
  const statuses: Array<'complete' | 'active' | 'draft' | 'pending'> = ['complete', 'complete', 'complete', 'active', 'draft', 'pending', 'pending', 'draft'];

  return {
    id: nanoid(),
    title,
    content: `<h3>${title}</h3><p>Section content for ${title}...</p>`,
    status: statuses[index] || 'pending',
    order: index,
    lastEditedBy: 'Dr. Emily Carter',
    lastEditedAt: new Date(Date.now() - randomNumber(1, 48) * 60 * 60 * 1000),
  };
}

function generateCitation(): Citation {
  const types: CitationType[] = ['article', 'book', 'website', 'conference'];
  const authors = Array.from({ length: randomNumber(1, 4) }, () => `${randomElement(FIRST_NAMES)[0]}. ${randomElement(LAST_NAMES)}`);

  return {
    id: nanoid(),
    authors,
    title: 'Sample Research Article Title',
    year: randomNumber(2015, 2024),
    journal: randomElement(SUBJECT_AREAS),
    type: randomElement(types),
    doi: `10.1000/journal.${randomNumber(1000, 9999)}`,
  };
}

function generateComment(collaborators: Collaborator[], sectionId: string): Comment {
  const collab = randomElement(collaborators);

  return {
    id: nanoid(),
    userId: collab.id,
    userName: collab.name,
    userInitials: collab.initials,
    content: 'Sample comment on this section...',
    timestamp: new Date(Date.now() - randomNumber(1, 48) * 60 * 60 * 1000),
    sectionId,
    resolved: Math.random() > 0.7,
  };
}

export function generateSampleManuscript(projectId: string, collaborators: Collaborator[]): Manuscript {
  const sections = SECTION_TITLES.map((title, index) => generateSection(title, index));
  const citations = Array.from({ length: randomNumber(10, 30) }, () => generateCitation());
  const comments = collaborators.length > 0
    ? Array.from({ length: randomNumber(3, 8) }, () =>
        generateComment(collaborators, randomElement(sections).id)
      )
    : [];

  return {
    id: nanoid(),
    projectId,
    title: 'Research Manuscript Title',
    type: 'full_paper' as const,
    sections,
    comments,
    citations,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  };
}

// ============================================================================
// Submission Data Generation
// ============================================================================

export function generateSampleSubmissions(manuscriptId: string, journals: Journal[]): Submission[] {
  if (journals.length === 0) return [];

  const statuses = ['under_review', 'accepted', 'revision'] as const;

  return Array.from({ length: Math.min(3, journals.length) }, (_, i) => {
    const journal = journals[i % journals.length];
    const status = statuses[i % statuses.length];
    const submittedDate = new Date();
    submittedDate.setDate(submittedDate.getDate() - randomNumber(10, 90));

    const estimatedDecisionDate = new Date(submittedDate);
    estimatedDecisionDate.setDate(
      estimatedDecisionDate.getDate() + (journal.avgDecisionDays ?? 60)
    );

    const progress = status === 'under_review' ? 50 : status === 'accepted' ? 100 : 75;

    return {
      id: nanoid(),
      manuscriptId,
      journalId: journal.id,
      journalName: journal.name,
      title: 'Research Manuscript Submission',
      status,
      submittedDate,
      estimatedDecisionDate,
      timeline: [
        { step: 'Submitted', date: submittedDate.toISOString(), done: true, current: false },
        { step: 'Under Review', date: new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), done: status !== 'under_review', current: status === 'under_review' },
        { step: 'Decision', date: estimatedDecisionDate.toISOString(), done: status === 'accepted', current: false },
      ],
      progress,
      keywords: ['research', 'medicine', 'clinical trial'],
    };
  });
}

// ============================================================================
// Activity Feed Generation
// ============================================================================

export function generateActivities(collaborators: Collaborator[]): Activity[] {
  const actions = [
    { type: 'edit' as const, action: 'edited the Methods section' },
    { type: 'reference' as const, action: 'added 3 new references' },
    { type: 'comment' as const, action: 'commented on Results' },
    { type: 'approval' as const, action: 'approved the manuscript' },
    { type: 'milestone' as const, action: 'completed Data Analysis' },
    { type: 'upload' as const, action: 'uploaded supplementary files' },
  ];

  return Array.from({ length: 6 }, (_, i) => {
    const collab = collaborators[i % collaborators.length];
    const actionData = actions[i % actions.length];

    return {
      id: nanoid(),
      userId: collab.id,
      userName: collab.name,
      userInitials: collab.initials,
      action: actionData.action,
      type: actionData.type,
      timestamp: new Date(Date.now() - (i + 1) * 30 * 60 * 1000), // Stagger by 30 minutes
    };
  });
}
