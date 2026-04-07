import { useState, useCallback, type ReactNode } from 'react';
import {
  X, Wand2, Loader2, CheckCircle2, ChevronDown, ChevronUp,
  BookOpen, AlertTriangle, CheckCheck, ListChecks, CircleHelp,
} from 'lucide-react';
import JLoadingGlyph from '@/components/JLoadingGlyph';
import {
  fetchFormatCheck,
  fetchJournals,
  type FormatCheckManualActionDTO,
  type FormatCheckSafeActionDTO,
  type FormatCheckUnsupportedDTO,
} from '@/lib/api/backend';
import type { JournalDTO, ManuscriptFormatCheckDTO } from '@shared/backend';

const SAFE_LABELS: Record<FormatCheckSafeActionDTO['type'], string> = {
  rename_heading: 'Rename heading',
  reorder_sections: 'Reorder sections',
  insert_missing_section: 'Insert section',
  apply_structured_abstract_template: 'Abstract template',
};

const MANUAL_LABELS: Record<FormatCheckManualActionDTO['type'], string> = {
  word_limit_overrun: 'Word limit',
  citation_style_review: 'Citation review',
  figure_limit_exceeded: 'Figure limit',
  table_limit_exceeded: 'Table limit',
  keywords_required: 'Keywords',
  required_declaration_missing: 'Declaration',
};

interface ReformatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  manuscriptId: string;
  onApplySafeAction: (action: FormatCheckSafeActionDTO) => void;
}

interface ExpandedState {
  safe: Record<string, boolean>;
  manual: Record<string, boolean>;
}

export default function ReformatPanel({
  isOpen,
  onClose,
  manuscriptId,
  onApplySafeAction,
}: ReformatPanelProps) {
  const [journalQuery, setJournalQuery] = useState('');
  const [journalResults, setJournalResults] = useState<JournalDTO[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<JournalDTO | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ManuscriptFormatCheckDTO | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<ExpandedState>({ safe: {}, manual: {} });
  const [appliedActionIds, setAppliedActionIds] = useState<string[]>([]);

  const handleJournalSearch = useCallback(async (q: string) => {
    setJournalQuery(q);
    if (!q.trim() || q.length < 2) {
      setJournalResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetchJournals({ q, perPage: 6, sortBy: 'relevance' });
      setJournalResults(res.data ?? []);
    } catch {
      setJournalResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectJournal = (journal: JournalDTO) => {
    setSelectedJournal(journal);
    setJournalResults([]);
    setJournalQuery(journal.name);
    setResult(null);
    setError('');
    setAppliedActionIds([]);
  };

  const handleCheck = async () => {
    if (!selectedJournal) return;
    setIsChecking(true);
    setError('');
    setResult(null);

    try {
      const response = await fetchFormatCheck(manuscriptId, selectedJournal.id);
      setResult(response.data);
      setExpanded({
        safe: Object.fromEntries(response.data.safeAutoActions.map((action) => [action.id, true])),
        manual: Object.fromEntries(response.data.manualActions.map((action) => [action.id, true])),
      });
    } catch (err: any) {
      setError(err?.message || 'Format check failed. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const applyAction = (action: FormatCheckSafeActionDTO) => {
    onApplySafeAction(action);
    setAppliedActionIds((prev) => (prev.includes(action.id) ? prev : [...prev, action.id]));
  };

  const applyAllSafeActions = () => {
    for (const action of result?.safeAutoActions ?? []) {
      if (appliedActionIds.includes(action.id)) continue;
      applyAction(action);
    }
  };

  const toggleSafe = (id: string) => {
    setExpanded((prev) => ({ ...prev, safe: { ...prev.safe, [id]: !prev.safe[id] } }));
  };

  const toggleManual = (id: string) => {
    setExpanded((prev) => ({ ...prev, manual: { ...prev.manual, [id]: !prev.manual[id] } }));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-journi-green/15 flex items-center justify-center">
              <Wand2 size={18} className="text-journi-green" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Journal Format Check</h2>
              <p className="text-[11px] text-muted-foreground">
                Deterministic actions only. No generated prose rewrites.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 border-b border-border space-y-3">
            <div className="relative">
              <BookOpen size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={journalQuery}
                onChange={(e) => handleJournalSearch(e.target.value)}
                placeholder="Search target journal..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              />
              {isSearching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {journalResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-md">
                {journalResults.map((journal) => (
                  <button
                    key={journal.id}
                    onClick={() => handleSelectJournal(journal)}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                  >
                    <p className="text-sm font-medium text-foreground">{journal.name}</p>
                    {journal.publisher && <p className="text-[11px] text-muted-foreground">{journal.publisher}</p>}
                  </button>
                ))}
              </div>
            )}

            {selectedJournal && (
              <div className="flex items-center gap-2 px-3 py-2 bg-journi-green/5 border border-journi-green/20 rounded-lg">
                <CheckCircle2 size={14} className="text-journi-green shrink-0" />
                <span className="text-sm text-foreground font-medium truncate">{selectedJournal.name}</span>
                <button
                  onClick={() => {
                    setSelectedJournal(null);
                    setJournalQuery('');
                    setResult(null);
                    setAppliedActionIds([]);
                  }}
                  className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <button
              onClick={handleCheck}
              disabled={!selectedJournal || isChecking}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? (
                <>
                  <JLoadingGlyph size={18} />
                  Running format check…
                </>
              ) : (
                <>
                  <ListChecks size={15} />
                  Run Format Check
                </>
              )}
            </button>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {result && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <SummaryCard label="Total words" value={result.summary.totalWordCount.toLocaleString()} />
                <SummaryCard label="Main text" value={result.summary.mainTextWordCount.toLocaleString()} />
                <SummaryCard label="Abstract" value={result.summary.abstractWordCount.toLocaleString()} />
                <SummaryCard label="Figures / Tables" value={`${result.summary.figureCount} / ${result.summary.tableCount}`} />
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Safe auto-actions</h3>
                    <p className="text-xs text-muted-foreground">Structured changes that can be applied directly.</p>
                  </div>
                  {result.safeAutoActions.length > 0 && (
                    <button
                      onClick={applyAllSafeActions}
                      className="text-[11px] font-medium text-journi-green hover:opacity-80 transition-opacity"
                    >
                      <CheckCheck size={12} className="inline mr-1" />
                      Apply all
                    </button>
                  )}
                </div>

                {result.safeAutoActions.length === 0 && (
                  <EmptyState text="No safe structural changes are needed." />
                )}

                {result.safeAutoActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    label={SAFE_LABELS[action.type]}
                    description={action.description}
                    severity={action.severity}
                    expanded={expanded.safe[action.id]}
                    onToggle={() => toggleSafe(action.id)}
                    body={action.details ? JSON.stringify(action.details, null, 2) : null}
                    footer={
                      <button
                        onClick={() => applyAction(action)}
                        disabled={appliedActionIds.includes(action.id)}
                        className="px-3 py-1.5 rounded-lg bg-journi-green text-journi-slate text-xs font-semibold disabled:opacity-40"
                      >
                        {appliedActionIds.includes(action.id) ? 'Applied' : 'Apply'}
                      </button>
                    }
                  />
                ))}
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Manual actions</h3>
                  <p className="text-xs text-muted-foreground">These need author judgment or content edits.</p>
                </div>

                {result.manualActions.length === 0 && <EmptyState text="No manual actions flagged." />}

                {result.manualActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    label={MANUAL_LABELS[action.type]}
                    description={action.description}
                    severity={action.severity}
                    expanded={expanded.manual[action.id]}
                    onToggle={() => toggleManual(action.id)}
                    body={action.details ? JSON.stringify(action.details, null, 2) : null}
                  />
                ))}
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Unsupported checks</h3>
                  <p className="text-xs text-muted-foreground">These still need future deterministic support.</p>
                </div>

                {result.unsupportedChecks.length === 0 && <EmptyState text="No unsupported checks for this journal." />}

                {result.unsupportedChecks.map((check) => (
                  <div key={check.id} className="rounded-lg border border-border p-4 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-amber-600 font-semibold">
                      <CircleHelp size={12} />
                      {check.code}
                    </div>
                    <p className="text-sm text-foreground">{check.description}</p>
                  </div>
                ))}
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function ActionCard({
  label,
  description,
  severity,
  expanded,
  onToggle,
  body,
  footer,
}: {
  label: string;
  description: string;
  severity: 'info' | 'warning' | 'required';
  expanded: boolean;
  onToggle: () => void;
  body?: string | null;
  footer?: ReactNode;
}) {
  const severityColor =
    severity === 'required'
      ? 'text-red-600 bg-red-500/10 border-red-500/20'
      : severity === 'warning'
        ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
        : 'text-blue-600 bg-blue-500/10 border-blue-500/20';

  return (
    <div className="rounded-lg border border-border bg-card">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${severityColor}`}>{label}</span>
        <span className="flex-1 text-sm text-foreground">{description}</span>
        {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {body && (
            <pre className="rounded-lg bg-muted/40 p-3 text-[11px] whitespace-pre-wrap break-words text-muted-foreground">
              {body}
            </pre>
          )}
          {footer && <div className="flex justify-end">{footer}</div>}
        </div>
      )}
    </div>
  );
}
