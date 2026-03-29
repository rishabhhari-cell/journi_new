/**
 * ReformatPanel
 * Slide-in panel that lets users reformat their manuscript to meet a target journal's
 * submission requirements. Claude returns minimal word-change suggestions displayed as
 * track-changes (strikethrough original, green proposed). Users accept or reject each
 * change individually; accepted changes are written back via the section PATCH endpoint.
 */
import { useState, useCallback } from 'react';
import {
  X, Wand2, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  BookOpen, AlertTriangle, CheckCheck, Trash2,
} from 'lucide-react';
import {
  fetchJournals,
  reformatManuscript,
  patchManuscriptSection,
  type ReformatSuggestion,
} from '@/lib/api/backend';
import type { JournalDTO } from '@shared/backend';

const TYPE_LABELS: Record<ReformatSuggestion['type'], string> = {
  word_trim: 'Trim words',
  section_add: 'Add section',
  citation_style: 'Citation style',
  heading_rename: 'Rename heading',
  structure: 'Structure',
};

const TYPE_COLORS: Record<ReformatSuggestion['type'], string> = {
  word_trim: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  section_add: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  citation_style: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  heading_rename: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  structure: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

interface ReformatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  manuscriptId: string;
  /** Called with (sectionId, newHtml) when user accepts a suggestion */
  onAcceptChange: (sectionId: string, newHtml: string, currentHtml: string, originalText: string, suggestedText: string) => void;
}

interface SuggestionState {
  suggestion: ReformatSuggestion;
  status: 'pending' | 'accepted' | 'rejected';
  isExpanded: boolean;
}

export default function ReformatPanel({
  isOpen,
  onClose,
  manuscriptId,
  onAcceptChange,
}: ReformatPanelProps) {
  const [journalQuery, setJournalQuery] = useState('');
  const [journalResults, setJournalResults] = useState<JournalDTO[]>([]);
  const [selectedJournal, setSelectedJournal] = useState<JournalDTO | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [error, setError] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // --- Journal search ---
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
    setSuggestions([]);
    setError('');
  };

  // --- Run analysis ---
  const handleAnalyse = async () => {
    if (!selectedJournal) return;
    setIsAnalysing(true);
    setError('');
    setSuggestions([]);

    try {
      const res = await reformatManuscript(manuscriptId, selectedJournal.id);
      if (!res.data || res.data.length === 0) {
        setError('No changes needed — your manuscript already meets this journal\'s requirements.');
        return;
      }
      setSuggestions(
        res.data.map((s) => ({ suggestion: s, status: 'pending', isExpanded: true })),
      );
    } catch (err: any) {
      setError(
        err?.message?.includes('ANTHROPIC_API_KEY')
          ? 'ANTHROPIC_API_KEY is not configured on the server. Add it to your .env file.'
          : err?.message || 'Analysis failed. Please try again.',
      );
    } finally {
      setIsAnalysing(false);
    }
  };

  // --- Accept a suggestion ---
  const handleAccept = async (index: number) => {
    const item = suggestions[index];
    if (!item || item.status !== 'pending') return;
    const { suggestion } = item;

    setAcceptingId(`${index}`);
    try {
      onAcceptChange(
        suggestion.sectionId,
        '', // placeholder — parent builds new HTML
        '', // currentHtml fetched by parent
        suggestion.originalText,
        suggestion.suggestedText,
      );
      setSuggestions((prev) =>
        prev.map((s, i) => (i === index ? { ...s, status: 'accepted' } : s)),
      );
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: 'rejected' } : s)),
    );
  };

  const handleToggleExpand = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, isExpanded: !s.isExpanded } : s)),
    );
  };

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const acceptedCount = suggestions.filter((s) => s.status === 'accepted').length;

  const handleAcceptAll = () => {
    suggestions.forEach((s, i) => {
      if (s.status === 'pending') handleAccept(i);
    });
  };

  const handleRejectAll = () => {
    setSuggestions((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' } : s)));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-journi-green/15 flex items-center justify-center">
              <Wand2 size={18} className="text-journi-green" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Reformat for Journal</h2>
              <p className="text-[11px] text-muted-foreground">
                Minimal edits only — you accept each change individually
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Journal selector */}
          <div className="p-5 border-b border-border space-y-3">
            <div className="relative">
              <BookOpen
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={journalQuery}
                onChange={(e) => handleJournalSearch(e.target.value)}
                placeholder="Search target journal..."
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green"
              />
              {isSearching && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground"
                />
              )}
            </div>

            {/* Dropdown results */}
            {journalResults.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden bg-card shadow-md">
                {journalResults.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => handleSelectJournal(j)}
                    className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-0"
                  >
                    <p className="text-sm font-medium text-foreground">{j.name}</p>
                    {j.publisher && (
                      <p className="text-[11px] text-muted-foreground">{j.publisher}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedJournal && (
              <div className="flex items-center gap-2 px-3 py-2 bg-journi-green/5 border border-journi-green/20 rounded-lg">
                <CheckCircle2 size={14} className="text-journi-green shrink-0" />
                <span className="text-sm text-foreground font-medium truncate">
                  {selectedJournal.name}
                </span>
                <button
                  onClick={() => { setSelectedJournal(null); setJournalQuery(''); setSuggestions([]); }}
                  className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <button
              onClick={handleAnalyse}
              disabled={!selectedJournal || isAnalysing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalysing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analysing with Claude…
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  Analyse &amp; Suggest Edits
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

          {/* Suggestions list */}
          {suggestions.length > 0 && (
            <div className="p-5 space-y-3">
              {/* Summary + bulk actions */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {pendingCount} pending · {acceptedCount} accepted ·{' '}
                  {suggestions.length - pendingCount - acceptedCount} rejected
                </p>
                {pendingCount > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleAcceptAll}
                      className="flex items-center gap-1 text-[11px] font-medium text-journi-green hover:opacity-80 transition-opacity"
                    >
                      <CheckCheck size={12} />
                      Accept all
                    </button>
                    <button
                      onClick={handleRejectAll}
                      className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Trash2 size={12} />
                      Reject all
                    </button>
                  </div>
                )}
              </div>

              {suggestions.map((item, index) => (
                <SuggestionCard
                  key={index}
                  item={item}
                  index={index}
                  isAccepting={acceptingId === String(index)}
                  onAccept={() => handleAccept(index)}
                  onReject={() => handleReject(index)}
                  onToggle={() => handleToggleExpand(index)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SuggestionCard({
  item,
  index,
  isAccepting,
  onAccept,
  onReject,
  onToggle,
}: {
  item: SuggestionState;
  index: number;
  isAccepting: boolean;
  onAccept: () => void;
  onReject: () => void;
  onToggle: () => void;
}) {
  const { suggestion, status, isExpanded } = item;
  const typeColor = TYPE_COLORS[suggestion.type] ?? TYPE_COLORS.structure;
  const typeLabel = TYPE_LABELS[suggestion.type] ?? suggestion.type;

  const cardClass =
    status === 'accepted'
      ? 'border-journi-green/30 bg-journi-green/5 opacity-70'
      : status === 'rejected'
        ? 'border-border opacity-40'
        : 'border-border bg-card hover:border-journi-green/30';

  return (
    <div className={`rounded-lg border transition-colors ${cardClass}`}>
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
          {typeLabel}
        </span>
        <span className="text-xs text-muted-foreground flex-1 truncate">
          {suggestion.sectionTitle}
        </span>
        {status === 'accepted' && (
          <CheckCircle2 size={13} className="text-journi-green shrink-0" />
        )}
        {status === 'rejected' && (
          <XCircle size={13} className="text-muted-foreground shrink-0" />
        )}
        {isExpanded ? (
          <ChevronUp size={13} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Track changes diff */}
          <div className="bg-muted/40 rounded-lg p-3 text-[12px] leading-relaxed space-y-2">
            {suggestion.originalText && (
              <p>
                <span className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider block mb-1">
                  Original
                </span>
                <span className="line-through text-red-500/80 font-mono">
                  {suggestion.originalText}
                </span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground text-[10px] uppercase font-semibold tracking-wider block mb-1">
                Suggested
              </span>
              <span className="text-emerald-600 font-mono">
                {suggestion.suggestedText || '(remove this text)'}
              </span>
            </p>
          </div>

          {/* Reason */}
          <p className="text-[11px] text-muted-foreground italic">{suggestion.reason}</p>

          {/* Actions */}
          {status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={onAccept}
                disabled={isAccepting}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-journi-green text-journi-slate text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isAccepting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                Accept
              </button>
              <button
                onClick={onReject}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-border text-xs font-medium text-foreground rounded-lg hover:bg-accent transition-colors"
              >
                <XCircle size={12} />
                Reject
              </button>
            </div>
          )}

          {status === 'accepted' && (
            <p className="text-[11px] text-journi-green font-medium">
              ✓ Change accepted
            </p>
          )}
          {status === 'rejected' && (
            <p className="text-[11px] text-muted-foreground">Rejected</p>
          )}
        </div>
      )}
    </div>
  );
}
