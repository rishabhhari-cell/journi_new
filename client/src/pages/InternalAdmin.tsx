import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  fetchEmailDebug,
  fetchInternalAdminHealth,
  type EmailDebugResponseDTO,
} from '@/lib/api/backend';

export default function InternalAdmin() {
  const [emailDebug, setEmailDebug] = useState<EmailDebugResponseDTO | null>(null);
  const [accessError, setAccessError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      await fetchInternalAdminHealth();
      const response = await fetchEmailDebug(12);
      setEmailDebug(response);
      setAccessError('');
    } catch (error: any) {
      setEmailDebug(null);
      setAccessError(error?.message || 'You do not have permission to view this page.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-28">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <ShieldCheck size={20} className="text-journi-green" />
              <h1 className="text-xl font-bold text-foreground">Journie Internal Admin</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Review auth and invite email delivery, sender configuration, and recent provider failures.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDiagnostics()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Email diagnostics</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm auth and invite emails are using the app mailer and review recent send events.
              </p>
            </div>
            {emailDebug?.config ? (
              <span className="rounded-full bg-journi-green/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-journi-green">
                {emailDebug.config.provider}
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : accessError ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-700">
              <AlertTriangle size={15} className="shrink-0" />
              {accessError}
            </div>
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
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Warnings</p>
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
                <div className="mb-2 flex items-center justify-between gap-3">
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
                        {typeof event.payload?.error === 'string' && event.payload.error.length > 0 ? (
                          <p className="mt-1 text-[11px] text-red-500">{event.payload.error}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
