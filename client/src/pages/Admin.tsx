/**
 * Admin Page - Institution Domain Management
 * Accessible at /admin. Allows org admins to register email domains that
 * auto-enroll new users into an organization on signup.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  listInstitutionDomains,
  createInstitutionDomain,
  deleteInstitutionDomain,
  fetchOrganizations,
  type InstitutionDomainDTO,
} from '@/lib/api/backend';

interface OrgOption {
  id: string;
  name: string;
}

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer - read-only access' },
  { value: 'editor', label: 'Editor - can edit manuscripts' },
  { value: 'admin', label: 'Admin - full access' },
];

export default function Admin() {
  const [domains, setDomains] = useState<InstitutionDomainDTO[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [newDomain, setNewDomain] = useState('');
  const [newOrgId, setNewOrgId] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listInstitutionDomains().then((res) => setDomains(res.data ?? [])),
      fetchOrganizations().then((res) =>
        setOrgs((res.data ?? []).map((organization) => ({ id: organization.id, name: organization.name }))),
      ),
    ])
      .catch(() => setError('Failed to load data. You may not have admin access.'))
      .finally(() => setIsLoading(false));
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
        const without = prev.filter((item) => item.domain !== domain);
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
      setDomains((prev) => prev.filter((item) => item.domain !== domain));
    } catch {
      // Ignore delete failures here and keep the current list visible.
    } finally {
      setDeletingDomain(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-1 flex items-center gap-3">
            <Building2 size={20} className="text-journi-green" />
            <h1 className="text-xl font-bold text-foreground">Institution Domain Admin</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Register email domains so users signing up with a matching address are automatically added to your organisation.
          </p>
        </div>

        {error ? (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Register a new domain</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="ucl.ac.uk"
                  className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                  required
                />
              </div>
              <select
                value={newOrgId}
                onChange={(e) => setNewOrgId(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
                required
              >
                <option value="">Select organisation...</option>
                {orgs.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSubmitting || !newDomain.trim() || !newOrgId}
                className="flex items-center gap-2 rounded-lg bg-journi-green px-4 py-2 text-sm font-semibold text-journi-slate transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Register
              </button>
            </div>
            {submitError ? <p className="text-xs text-red-500">{submitError}</p> : null}
            {submitSuccess ? (
              <div className="flex items-center gap-1.5 text-xs text-journi-green">
                <CheckCircle2 size={13} />
                {submitSuccess}
              </div>
            ) : null}
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Registered domains ({domains.length})</h2>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : domains.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No domains registered yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">@{domain.domain}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(domain.organizations as any)?.name ?? domain.organization_id} &middot; {domain.default_role}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(domain.domain)}
                    disabled={deletingDomain === domain.domain}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    title={`Remove @${domain.domain}`}
                  >
                    {deletingDomain === domain.domain ? (
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
