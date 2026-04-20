export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export interface ApiSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  provider: "local" | "google" | "orcid" | "guest";
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationMembershipDTO {
  organizationId: string;
  role: OrgRole;
  organization: OrganizationDTO;
}

export interface AuditEventDTO {
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
  color?: string;
  updatedAt: string;
}

export type JournalCitationStyle =
  | "vancouver"
  | "apa"
  | "mla"
  | "harvard"
  | "ama"
  | "nlm"
  | "ieee";

export interface JournalWordLimits {
  abstract?: number | null;
  main_text?: number | null;
  total?: number | null;
  title?: number | null;
}

export interface JournalSubmissionRequirements {
  word_limits?: JournalWordLimits | null;
  section_order?: string[] | null;
  sections_required?: string[] | null;
  citation_style?: JournalCitationStyle | string | null;
  figures_max?: number | null;
  tables_max?: number | null;
  structured_abstract?: boolean | null;
  notes?: string | null;
  required_declarations?: string[] | null;
  keywords_required?: boolean | null;
  max_keywords?: number | null;
  requires_cover_letter?: boolean | null;
}

export interface JournalGuidelinesDTO {
  journalId: string;
  journalName: string;
  submissionPortalUrl: string | null;
  wordLimits: JournalWordLimits | null;
  sectionOrder: string[] | null;
  sectionsRequired: string[] | null;
  citationStyle: string | null;
  figuresMax: number | null;
  tablesMax: number | null;
  structuredAbstract: boolean | null;
  keywordsRequired: boolean | null;
  maxKeywords: number | null;
  requiredDeclarations: string[] | null;
  requiresCoverLetter: boolean | null;
  notes: string | null;
  acceptanceRate: number | null;
  avgDecisionDays: number | null;
  raw: JournalSubmissionRequirements | null;
}

export interface JournalDTO {
  id: string;
  externalId?: string | null;
  name: string;
  abbreviation?: string | null;
  logoUrl?: string | null;
  impactFactor?: number | null;
  impactFactorYear?: number | null;
  openAccess?: boolean | null;
  websiteUrl?: string | null;
  submissionPortalUrl?: string | null;
  submissionRequirements?: JournalSubmissionRequirements | null;
  publisher?: string | null;
  subjectAreas: string[];
  geographicLocation?: string | null;
  issnPrint?: string | null;
  issnOnline?: string | null;
  acceptanceRate?: number | null;
  avgDecisionDays?: number | null;
  apcCostUsd?: number | null;
  citeScore?: number | null;
  sjrScore?: number | null;
  sjrQuartile?: string | null;
  meanTimeToPublicationDays?: number | null;
  provenance?: Record<string, string>;
  lastVerifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResult<T> {
  page: number;
  perPage: number;
  total: number;
  data: T[];
}

export type ImportSessionStatus =
  | "pending_review"
  | "ready_to_commit"
  | "manual_only"
  | "unsupported"
  | "committed";

export type ImportSessionItemType =
  | "section"
  | "text_block"
  | "reference"
  | "table_candidate"
  | "figure_caption"
  | "manual_only";

export type ImportSessionDecision = "pending" | "accepted" | "rejected";

export interface ImportSessionItemDTO {
  id: string;
  type: ImportSessionItemType;
  sourceFormat: "docx" | "pdf" | "image";
  title?: string | null;
  text?: string | null;
  html?: string | null;
  page?: number | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  confidence: number;
  diagnostics: Array<{ level: "info" | "warning" | "error"; code: string; message: string }>;
  proposedSectionTitle?: string | null;
  assignedSectionTitle?: string | null;
  decision: ImportSessionDecision;
  metadata?: Record<string, unknown>;
}

export interface ManuscriptImportSessionDTO {
  id: string;
  manuscriptId: string | null;
  fileName: string;
  fileTitle: string;
  sourceFormat: "docx" | "pdf" | "image";
  reviewRequired: boolean;
  status: ImportSessionStatus;
  unsupportedReason: string | null;
  diagnostics: Array<{ level: "info" | "warning" | "error"; code: string; message: string }>;
  items: ImportSessionItemDTO[];
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
}

export type FormatCheckSeverity = "info" | "warning" | "required";
export type FormatCheckSafeActionType =
  | "rename_heading"
  | "reorder_sections"
  | "insert_missing_section"
  | "apply_structured_abstract_template";
export type FormatCheckManualActionType =
  | "word_limit_overrun"
  | "citation_style_review"
  | "figure_limit_exceeded"
  | "table_limit_exceeded"
  | "keywords_required"
  | "required_declaration_missing";

export interface FormatCheckSafeActionDTO {
  id: string;
  type: FormatCheckSafeActionType;
  severity: FormatCheckSeverity;
  sectionId?: string;
  sectionTitle?: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface FormatCheckManualActionDTO {
  id: string;
  type: FormatCheckManualActionType;
  severity: FormatCheckSeverity;
  sectionId?: string;
  sectionTitle?: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface FormatCheckUnsupportedDTO {
  id: string;
  code: string;
  description: string;
}

export interface ManuscriptFormatCheckDTO {
  journalId: string;
  journalName: string;
  safeAutoActions: FormatCheckSafeActionDTO[];
  manualActions: FormatCheckManualActionDTO[];
  unsupportedChecks: FormatCheckUnsupportedDTO[];
  summary: {
    titleWordCount: number;
    abstractWordCount: number;
    totalWordCount: number;
    mainTextWordCount: number;
    figureCount: number;
    tableCount: number;
    citationStyleSupported: boolean;
  };
}
