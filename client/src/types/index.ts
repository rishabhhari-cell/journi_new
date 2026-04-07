// Core type definitions for Journi Platform

// ============================================================================
// Project & Task Management
// ============================================================================

export type TaskStatus = 'completed' | 'progress' | 'pending' | 'delayed' | 'upcoming';
export type TaskPriority = 'urgent' | 'medium' | 'low';

export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  completionPct: number; // 0-100
  assignedTo?: string[];
  description?: string;
  dependencies?: string[];
}

export type CollaboratorRole = 'lead_author' | 'co_author' | 'supervisor' | 'contributor';

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  initials: string;
  avatarColor?: string;
  online?: boolean;
  orcidId?: string;
  institution?: string;
  rorId?: string;
  institutionCountry?: string;
}

export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
  collaborators: Collaborator[];
  dueDate?: Date;
}

// ============================================================================
// Manuscript & Collaboration
// ============================================================================

export type SectionStatus = 'complete' | 'active' | 'draft' | 'pending';

export interface DocumentSection {
  id: string;
  title: string;
  content: string; // TipTap JSON or HTML
  status: SectionStatus;
  order: number;
  lastEditedBy?: string;
  lastEditedAt?: Date;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  content: string;
  timestamp: Date;
  sectionId?: string;
  parentId?: string; // For threaded replies
  resolved?: boolean;
  quotedText?: string; // Highlighted text this comment refers to
}

export type CitationType = 'article' | 'book' | 'website' | 'conference';

export interface Citation {
  id: string;
  authors: string[];
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: CitationType;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  freePdfUrl?: string;
  oaStatus?: 'gold' | 'hybrid' | 'bronze' | 'green' | 'closed';
}

export type ManuscriptType = 'full_paper' | 'abstract' | 'cover_letter' | 'response_letter' | 'supplementary' | 'literature_review' | 'grant_application' | 'other';

export interface Manuscript {
  id: string;
  projectId: string;
  title: string;
  type: ManuscriptType;
  sections: DocumentSection[];
  comments: Comment[];
  citations: Citation[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Journal Discovery
// ============================================================================

export type ReferenceStyle = 'vancouver' | 'apa' | 'mla' | 'harvard' | 'nlm' | 'ama' | 'ieee';
export type AbstractStructure = 'structured' | 'unstructured';

export interface JournalFormattingRequirements {
  sectionOrder: string[];
  wordLimits?: {
    total?: number;
    abstract?: number;
    title?: number;
  };
  abstractStructure: AbstractStructure;
  referenceStyle: ReferenceStyle;
  titleFormat?: {
    maxCharacters?: number;
    allowSubtitle?: boolean;
  };
  requiresKeywords?: boolean;
  maxKeywords?: number;
  requiresCoverLetter?: boolean;
  figureLimit?: number;
  tableLimit?: number;
  requiresConflictOfInterest?: boolean;
  requiresFundingStatement?: boolean;
  additionalSections?: string[];
}

export interface Journal {
  id: string;
  name: string;
  abbreviation?: string;
  externalId?: string;
  coverColor: string; // Tailwind gradient class
  coverInitial: string;
  logoUrl?: string | null;
  impactFactor?: number | null;
  impactFactorYear?: number | null;
  matchScore?: number;
  matchLabel?: 'Top' | 'High' | 'Good' | 'Fair';
  avgDecisionDays?: number | null; // Time to publication
  acceptanceRate?: number | null; // Percentage
  openAccess?: boolean | null;
  subjectAreas: string[];
  geographicLocation: string;
  publisher: string;
  issn?: string;
  issnOnline?: string;
  isMedlineIndexed?: boolean;
  indexingScore?: number | null;
  website?: string;
  websiteUrl?: string | null;
  submissionPortalUrl?: string | null;
  submissionRequirements?: Record<string, unknown> | null;
  formattingRequirements?: JournalFormattingRequirements;
  scoreInsights?: {
    topicRelevance: number;
    timelineFit: number;
    openAccess: boolean;
  };
  // OpenAlex enrichment
  openAlexId?: string;
  apcCostUsd?: number | null;
  citationsCount?: number | null;
  worksCount?: number | null;
  // DOAJ enrichment
  isDoajListed?: boolean;
  doajSeal?: boolean;
  doajId?: string;
  apcCurrency?: string;
  peerReviewType?: string | null;
  provenance?: Record<string, string>;
  lastVerifiedAt?: string;
}

// ============================================================================
// Acceptance Likelihood Score
// ============================================================================

export interface AcceptanceLikelihood {
  overall: number;
  label: 'Very High' | 'High' | 'Moderate' | 'Low' | 'Very Low';
  breakdown: {
    acceptanceRate: { score: number; detail: string };
    topicRelevance: { score: number; detail: string; matchedAreas: string[] };
    wordCountAlignment: { score: number; detail: string };
    openAccessFit: { score: number; detail: string };
    competitiveness: { score: number; detail: string };
  };
}

export interface JournalFilters {
  search?: string;
  impactFactorMin?: number;
  impactFactorMax?: number;
  openAccess?: boolean;
  subjectAreas?: string[];
  geographicLocations?: string[];
  timeToPublicationMin?: number; // days
  timeToPublicationMax?: number; // days
}

// ============================================================================
// Publication Management
// ============================================================================

export type SubmissionStatus = 'draft' | 'under_review' | 'revision' | 'accepted' | 'rejected' | 'published';

export interface TimelineStep {
  step: string;
  date: string;
  done: boolean;
  current: boolean;
}

export interface Submission {
  id: string;
  manuscriptId: string;
  journalId: string;
  journalName?: string;
  title: string;
  status: SubmissionStatus;
  submittedDate?: Date;
  estimatedDecisionDate?: Date;
  actualDecisionDate?: Date;
  timeline: TimelineStep[];
  progress: number; // 0-100
  coverLetter?: string;
  keywords?: string[];
  suggestedReviewers?: string[];
}

export interface SubmissionStats {
  total: number;
  underReview: number;
  accepted: number;
  avgReviewTime: number; // in days
}

// ============================================================================
// Activity Feed
// ============================================================================

export type ActivityType = 'edit' | 'reference' | 'approval' | 'comment' | 'milestone' | 'upload' | 'task' | 'status';

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  userInitials?: string;
  action: string;
  type: ActivityType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// Backend Collaboration Types
// ============================================================================

export type ProjectMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectMember {
  userId: string;
  role: ProjectMemberRole;
  canEdit: boolean;
  canComment: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMembership {
  organizationId: string;
  role: ProjectMemberRole;
  organization: Organization;
}

export interface AuditEvent {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface PresenceState {
  userId: string;
  fullName: string;
  initials: string;
  sectionId?: string;
  cursor?: { from: number; to: number };
  updatedAt: string;
}

// ============================================================================
// UI State Types
// ============================================================================

export type ViewMode = 'list' | 'gantt';

export interface DateRange {
  start: Date;
  end: Date;
}

// ============================================================================
// Form Types
// ============================================================================

export interface TaskFormData {
  name: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  completionPct: number;
  assignedTo?: string[];
  description?: string;
  dependencies?: string[];
}

export interface CollaboratorFormData {
  name: string;
  email: string;
  role: CollaboratorRole;
  orcidId?: string;
}

export interface CitationFormData {
  authors: string[];
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: CitationType;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  freePdfUrl?: string;
  oaStatus?: 'gold' | 'hybrid' | 'bronze' | 'green' | 'closed';
  metadata?: Record<string, unknown>;
}

export interface SubmissionFormData {
  manuscriptId?: string;
  journalId?: string;
  title?: string;
  journal?: string;
  status?: SubmissionStatus;
  submittedDate?: Date;
  coverLetter?: string;
  keywords?: string[];
}

export interface CommentFormData {
  content: string;
  sectionId?: string;
  parentId?: string;
  quotedText?: string;
}
