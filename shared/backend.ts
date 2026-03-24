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

export interface JournalSubmissionRequirements {
  [key: string]: unknown;
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
