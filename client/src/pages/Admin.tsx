/**
 * Admin Page — Institution Domain Management
 * Accessible at /admin. Allows org admins to register email domains that
 * auto-enroll new users into an organization on signup.
 */
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  fetchEmailDebug,
  listInstitutionDomains,
  createInstitutionDomain,
  deleteInstitutionDomain,
  fetchOrganizations,
  type EmailDebugResponseDTO,
  type InstitutionDomainDTO,
} from '@/lib/api/backend';

interface OrgOption {
  id: string;
  name: string;
}

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer — read-only access' },
  { value: 'editor', label: 'Editor — can edit manuscripts' },
  { value: 'admin', label: 'Admin — full access' },
];

export default function Admin() {
  const [domains, setDomains] = useState<InstitutionDomainDTO[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // New domain form
  const [newDomain, setNewDomain] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);
  const [emailDebug, setEmailDebug] = useState<EmailDebugResponseDTO | null>(null);
  const [emailDebugError, setEmailDebugError] = useState('');
  const [isEmailDebugLoading, setIsEmailDebugLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listInstitutionDomains().then((res) => setDomains(res.data ?? [])),
      fetchOrganizations().then((res) =>
        setOrgs((res.data ?? []).map((o) => ({ id: o.id, name: o.name }))),
      ),
    ])
      .catch(() => setError('Failed to load data. You may not have admin access.'))
      .finally(() => setIsLoading(false));

    fetchEmailDebug(12)
      .then((res) => {
        setEmailDebug(res);
        setEmailDebugError('');
      })
      .catch(() => setEmailDebugError('Email diagnostics are unavailable right now.'))
      .finally(() => setIsEmailDebugLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const domain = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!domain || !newOrgId) return;

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const res = await createInstitutionDomain({ domain, organizationId: newOrgId, defaultRole: newRole });
      setDomains((prev) => {
        const without = prev.filter((d) => d.domain !== domain);
        return [...without, res.data];
      });
      setNewDomain('');
      setSubmitSuccess(`@${domain} registered.`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to register domain.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (domain: string) => {
    if (!window.confirm(`Remove @${domain}? Users with this email domain will no longer be auto-enrolled.`)) return;
    setDeletingDomain(domain);
    try {
      await deleteInstitutionDomain(domain);
      setDomains((prev) => prev.filter((d) => d.domain !== domain));
    } catch {
      // silently ignore
    } finally {
      setDeletingDomain(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Building2 size={20} className="text-journi-green" />
            <h1 className="text-xl font-bold text-foreground">Institution Domain Admin</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Register email domains so users signing up with a matching address are automatically added to your organisation.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 mb-6">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Add form */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Register a new domain</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="ucl.ac.uk"
                  className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                  required
                />
              </div>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                required
              >
                <option value="">Select organisation…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSubmitting || !newDomain.trim() || !newOrgId}
                className="flex items-center gap-2 px-4 py-2 bg-journi-green text-journi-slate text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Register
              </button>
            </div>
            {submitError && (
              <p className="text-xs text-red-500">{submitError}</p>
            )}
            {submitSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-journi-green">
                <CheckCircle2 size={13} />
                {submitSuccess}
              </div>
            )}
          </form>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Email diagnostics</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Confirm auth and invite emails are using the app mailer and review recent send events.
              </p>
            </div>
            {emailDebug?.config && (
              <span className="rounded-full bg-journi-green/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-journi-green">
                {emailDebug.config.provider}
              </span>
            )}
          </div>

          {isEmailDebugLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : emailDebugError ? (
            <p className="text-sm text-muted-foreground">{emailDebugError}</p>
          ) : emailDebug ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Sender</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{emailDebug.config.mailFrom}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reply-to: {emailDebug.config.mailReplyTo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Support: {emailDebug.config.supportEmail}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Delivery mode</p>
                  <p className="mt-1 text-sm font-medium text-foreground">Auth: {emailDebug.config.authDeliveryMode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Invites: {emailDebug.config.inviteDeliveryMode}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Resets: {emailDebug.config.resetDeliveryMode}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">Warnings</p>
                {emailDebug.warnings.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-journi-green/20 bg-journi-green/5 px-3 py-2 text-sm text-journi-green">
                    <CheckCircle2 size={14} />
                    Email configuration looks healthy.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {emailDebug.warnings.map((warning) => (
                      <div
                        key={warning}
                        className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700"
                      >
                        <AlertTriangle size={14} className="shrink-0" />
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Recent email events</p>
                  <p className="text-[11px] text-muted-foreground">
                    Updated {new Date(emailDebug.generatedAt).toLocaleString()}
                  </p>
                </div>
                {emailDebug.recentEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent auth or email events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {emailDebug.recentEvents.slice(0, 8).map((event) => (
                      <div key={event.id} className="rounded-lg border border-border bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">{event.eventType}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(event.payload?.email as string | undefined) ?? event.actorEmail ?? 'Unknown email'}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Source: {(event.payload?.source as string | undefined) ?? 'n/a'} - Provider:{' '}
                          {(event.payload?.provider as string | undefined) ?? 'n/a'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Domains list */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Registered domains ({domains.length})</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : domains.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No domains registered yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">@{d.domain}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(d.organizations as any)?.name ?? d.organization_id} &middot; {d.default_role}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(d.domain)}
                    disabled={deletingDomain === d.domain}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                    title={`Remove @${d.domain}`}
                  >
                    {deletingDomain === d.domain ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
