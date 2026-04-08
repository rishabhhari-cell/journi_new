import type {
  FormatCheckManualActionDTO,
  FormatCheckSafeActionDTO,
  FormatCheckUnsupportedDTO,
  JournalDTO,
  JournalGuidelinesDTO,
  ManuscriptFormatCheckDTO,
  ManuscriptImportSessionDTO,
  OrgRole,
  OrganizationDTO,
  PaginatedResult,
  PresenceState,
} from '@shared/backend';
import type { RawParsedDocument } from '@shared/document-parse';
import { apiFetch } from './client';
import { apiFetchNoAuth } from './client';

export interface SearchJournalParams {
  q?: string;
  page?: number;
  perPage?: number;
  sortBy?: 'relevance' | 'impact_factor' | 'name' | 'last_verified_at';
  sortDirection?: 'asc' | 'desc';
  openAccess?: boolean;
  impactFactorMin?: number;
  impactFactorMax?: number;
  subjectAreas?: string[];
}

export async function fetchJournals(params: SearchJournalParams = {}) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.page) query.set('page', String(params.page));
  if (params.perPage) query.set('perPage', String(params.perPage));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDirection) query.set('sortDirection', params.sortDirection);
  if (typeof params.openAccess === 'boolean') query.set('openAccess', String(params.openAccess));
  if (typeof params.impactFactorMin === 'number') query.set('impactFactorMin', String(params.impactFactorMin));
  if (typeof params.impactFactorMax === 'number') query.set('impactFactorMax', String(params.impactFactorMax));
  if (params.subjectAreas && params.subjectAreas.length > 0) {
    query.set('subjectAreas', params.subjectAreas.join(','));
  }

  return apiFetch<PaginatedResult<JournalDTO>>(`/journals?${query.toString()}`, { method: 'GET' });
}

export async function fetchJournalById(journalId: string) {
  return apiFetch<{ data: JournalDTO }>(`/journals/${journalId}`, { method: 'GET' });
}

export interface CollaborationMessage {
  type: 'join' | 'doc_update' | 'presence' | 'comments';
  manuscriptId: string;
  update?: string;
  state?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export function createCollaborationSocket(accessToken: string): WebSocket {
  const wsBase = import.meta.env.VITE_WS_BASE_URL ?? `${window.location.origin.replace(/^http/, 'ws')}/ws/collab`;
  return new WebSocket(`${wsBase}?token=${encodeURIComponent(accessToken)}`);
}

export interface PresencePayload {
  type: 'presence';
  manuscriptId: string;
  users: PresenceState[];
}

export interface ApiProjectMember {
  user_id: string;
  role: OrgRole;
  can_edit: boolean;
  can_comment: boolean;
}

export interface ApiProject {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project_members?: ApiProjectMember[];
  tasks_json?: unknown[];
  collaborators_json?: unknown[];
}

export interface ApiManuscriptSection {
  id: string;
  manuscript_id: string;
  title: string;
  content_html: string;
  status: 'complete' | 'active' | 'draft' | 'pending';
  sort_order: number;
  last_edited_by: string | null;
  last_edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiManuscript {
  id: string;
  project_id: string;
  title: string;
  type: string;
  status: 'draft' | 'ready' | 'submitted' | 'revision' | 'archived';
  created_at: string;
  updated_at: string;
  manuscript_sections?: ApiManuscriptSection[];
}

export interface ApiCommentProfile {
  full_name: string | null;
  initials: string | null;
}

export interface ApiComment {
  id: string;
  manuscript_id: string;
  section_id: string | null;
  parent_id: string | null;
  author_user_id: string;
  content: string;
  quoted_text: string | null;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  profiles?: ApiCommentProfile | ApiCommentProfile[] | null;
}

export interface ApiCitation {
  id: string;
  manuscript_id: string;
  citation_type: 'article' | 'book' | 'website' | 'conference';
  authors: string[];
  title: string;
  publication_year: number | null;
  doi: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchOrganizations() {
  return apiFetch<{ data: Array<OrganizationDTO & { role: OrgRole }> }>('/organizations', {
    method: 'GET',
  });
}

export async function createOrganization(input: { name: string; slug?: string }) {
  return apiFetch<{ data: OrganizationDTO }>('/organizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function inviteToOrganization(
  organizationId: string,
  input: { email: string; role: OrgRole },
) {
  return apiFetch<{ data: { inviteToken: string; role: OrgRole; expiresAt: string } }>(
    `/organizations/${organizationId}/invite`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function fetchProjects(organizationId: string) {
  const query = new URLSearchParams({ organizationId });
  return apiFetch<{ data: ApiProject[] }>(`/projects?${query.toString()}`, {
    method: 'GET',
  });
}

export async function fetchProjectById(projectId: string) {
  return apiFetch<{ data: ApiProject }>(`/projects/${projectId}`, {
    method: 'GET',
  });
}

export async function createProject(input: {
  organizationId: string;
  title: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived';
  dueDate?: string;
}) {
  return apiFetch<{ data: ApiProject }>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchProject(
  projectId: string,
  input: {
    title?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    dueDate?: string | null;
  },
) {
  return apiFetch<{ data: ApiProject }>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProject(projectId: string) {
  return apiFetch<{ ok: boolean }>(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function patchProjectTasks(projectId: string, tasks: unknown[]) {
  return apiFetch<{ ok: boolean }>(`/projects/${projectId}/tasks`, {
    method: 'PATCH',
    body: JSON.stringify({ tasks }),
  });
}

export async function patchProjectCollaborators(projectId: string, collaborators: unknown[]) {
  return apiFetch<{ ok: boolean }>(`/projects/${projectId}/collaborators`, {
    method: 'PATCH',
    body: JSON.stringify({ collaborators }),
  });
}

export async function fetchManuscripts(projectId: string) {
  const query = new URLSearchParams({ projectId });
  return apiFetch<{ data: ApiManuscript[] }>(`/manuscripts?${query.toString()}`, {
    method: 'GET',
  });
}

export async function createManuscript(input: {
  projectId: string;
  title: string;
  type: string;
  status?: 'draft' | 'ready' | 'submitted' | 'revision' | 'archived';
  sections?: Array<{
    title: string;
    contentHtml?: string;
    status?: 'complete' | 'active' | 'draft' | 'pending';
  }>;
}) {
  return apiFetch<{ data: ApiManuscript }>('/manuscripts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchManuscript(
  manuscriptId: string,
  input: {
    title?: string;
    type?: string;
    status?: 'draft' | 'ready' | 'submitted' | 'revision' | 'archived';
  },
) {
  return apiFetch<{ data: ApiManuscript }>(`/manuscripts/${manuscriptId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteManuscript(manuscriptId: string) {
  return apiFetch<{ ok: boolean }>(`/manuscripts/${manuscriptId}`, {
    method: 'DELETE',
  });
}

export async function patchManuscriptSection(
  manuscriptId: string,
  sectionId: string,
  input: {
    title?: string;
    contentHtml?: string;
    status?: 'complete' | 'active' | 'draft' | 'pending';
    sortOrder?: number;
  },
) {
  return apiFetch<{ data: ApiManuscriptSection }>(
    `/manuscripts/${manuscriptId}/sections/${sectionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function createManuscriptVersion(input: {
  manuscriptId: string;
  label: string;
  snapshotBase64: string;
}) {
  return apiFetch<{ data: { id: string } }>('/manuscripts/versions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listManuscriptVersions(manuscriptId: string) {
  return apiFetch<{
    data: Array<{
      id: string;
      version_label: string;
      created_at: string;
      created_by: string | null;
    }>;
  }>(`/manuscripts/${manuscriptId}/versions`, {
    method: 'GET',
  });
}

export async function parseManuscriptUpload(input: {
  fileName: string;
  mimeType?: string;
  base64: string;
}) {
  return apiFetch<{ data: RawParsedDocument }>('/manuscripts/parse', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchComments(manuscriptId: string) {
  const query = new URLSearchParams({ manuscriptId });
  return apiFetch<{ data: ApiComment[] }>(`/comments?${query.toString()}`, {
    method: 'GET',
  });
}

export async function createComment(input: {
  manuscriptId: string;
  sectionId?: string;
  parentId?: string;
  content: string;
  quotedText?: string;
}) {
  return apiFetch<{ data: ApiComment }>('/comments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchComment(
  commentId: string,
  input: {
    content?: string;
    resolved?: boolean;
  },
) {
  return apiFetch<{ data: ApiComment }>(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteComment(commentId: string) {
  return apiFetch<{ ok: boolean }>(`/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export async function fetchCitations(manuscriptId: string) {
  const query = new URLSearchParams({ manuscriptId });
  return apiFetch<{ data: ApiCitation[] }>(`/citations?${query.toString()}`, {
    method: 'GET',
  });
}

export async function createCitation(input: {
  manuscriptId: string;
  citationType: 'article' | 'book' | 'website' | 'conference';
  authors: string[];
  title: string;
  publicationYear?: number;
  doi?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch<{ data: ApiCitation }>('/citations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteCitation(citationId: string) {
  return apiFetch<{ ok: boolean }>(`/citations/${citationId}`, {
    method: 'DELETE',
  });
}

export async function patchCitation(
  citationId: string,
  input: {
    citationType?: 'article' | 'book' | 'website' | 'conference';
    authors?: string[];
    title?: string;
    publicationYear?: number | null;
    doi?: string | null;
    url?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return apiFetch<{ data: ApiCitation }>(`/citations/${citationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function lookupCitationByDoi(doi: string) {
  return apiFetch<{
    data: {
      citationType: string;
      authors: string[];
      title: string;
      publicationYear: number | null;
      doi: string;
      url: string | null;
      metadata: Record<string, unknown>;
    };
  }>('/citations/lookup', {
    method: 'POST',
    body: JSON.stringify({ doi }),
  });
}

export async function fetchCitationsFormatted(manuscriptId: string, format: 'vancouver' | 'apa' | 'mla') {
  const query = new URLSearchParams({ manuscriptId, format });
  return apiFetch<{ data: Array<{ id: string; formatted: string }> }>(
    `/citations?${query.toString()}`,
    { method: 'GET' },
  );
}

export async function fetchJournalGuidelines(journalId: string) {
  return apiFetch<{ data: JournalGuidelinesDTO }>(`/journals/${journalId}/guidelines`, {
    method: 'GET',
  });
}

export async function fetchFormatCheck(manuscriptId: string, journalId: string) {
  return apiFetch<{ data: ManuscriptFormatCheckDTO }>(`/manuscripts/${manuscriptId}/format-check`, {
    method: 'POST',
    body: JSON.stringify({ journalId }),
  });
}

export type {
  JournalGuidelinesDTO,
  ManuscriptImportSessionDTO,
  ManuscriptFormatCheckDTO,
  FormatCheckSafeActionDTO,
  FormatCheckManualActionDTO,
  FormatCheckUnsupportedDTO,
};

export async function createImportSession(input: {
  manuscriptId?: string | null;
  fileName: string;
  fileTitle: string;
  sourceFormat: 'docx' | 'pdf' | 'image';
  reviewRequired: boolean;
  status: 'pending_review' | 'ready_to_commit' | 'manual_only' | 'unsupported';
  unsupportedReason?: string | null;
  diagnostics: Array<{ level: 'info' | 'warning' | 'error'; code: string; message: string }>;
  items: ManuscriptImportSessionDTO['items'];
}) {
  return apiFetch<{ data: ManuscriptImportSessionDTO }>('/manuscripts/import-sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchImportSession(sessionId: string) {
  return apiFetch<{ data: ManuscriptImportSessionDTO }>(`/manuscripts/import-sessions/${sessionId}`, {
    method: 'GET',
  });
}

export async function patchImportSession(
  sessionId: string,
  input: {
    status?: 'pending_review' | 'ready_to_commit' | 'manual_only' | 'unsupported';
    unsupportedReason?: string | null;
    items?: ManuscriptImportSessionDTO['items'];
  },
) {
  return apiFetch<{ data: ManuscriptImportSessionDTO }>(`/manuscripts/import-sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function commitImportSession(sessionId: string) {
  return apiFetch<{
    data: {
      session: ManuscriptImportSessionDTO;
      sections: ApiManuscriptSection[];
      citations: ApiCitation[];
    };
  }>(`/manuscripts/import-sessions/${sessionId}/commit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// --- Institution domain admin ---

export interface InstitutionDomainDTO {
  id: string;
  domain: string;
  organization_id: string;
  default_role: string;
  created_at: string;
  organizations?: { name: string } | null;
}

export async function listInstitutionDomains() {
  return apiFetch<{ data: InstitutionDomainDTO[] }>('/auth/admin/institution-domains', {
    method: 'GET',
  });
}

export async function createInstitutionDomain(input: {
  domain: string;
  organizationId: string;
  defaultRole: string;
}) {
  return apiFetch<{ data: InstitutionDomainDTO }>('/auth/admin/institution-domains', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteInstitutionDomain(domain: string) {
  return apiFetch<{ ok: boolean }>(`/auth/admin/institution-domains/${encodeURIComponent(domain)}`, {
    method: 'DELETE',
  });
}

export async function requestPasswordReset(email: string) {
  return apiFetchNoAuth<{ ok: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resendVerificationEmail(email: string) {
  return apiFetchNoAuth<{ ok: boolean; sent: boolean; alreadyVerified: boolean }>('/auth/signup/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function updatePassword(password: string) {
  return apiFetch<{ ok: boolean }>('/auth/update-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function acceptOrganizationInvite(token: string) {
  return apiFetch<{ ok: boolean; organizationId: string; role: OrgRole }>('/auth/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// --- Billing ---

export interface BillingSubscription {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  planCode: string;
  cancelAtPeriodEnd: boolean;
}

export async function createCheckoutSession(billingInterval: 'monthly' | 'yearly') {
  return apiFetch<{ data: { checkoutUrl: string; sessionId: string } }>('/billing/checkout-session', {
    method: 'POST',
    body: JSON.stringify({ billingInterval }),
  });
}

export async function fetchBillingStatus() {
  return apiFetch<{ data: { subscription: BillingSubscription | null; hasProAccess: boolean } }>(
    '/billing/me',
    { method: 'GET' },
  );
}

export async function createCustomerPortalSession() {
  return apiFetch<{ data: { url: string } }>('/billing/customer-portal', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
