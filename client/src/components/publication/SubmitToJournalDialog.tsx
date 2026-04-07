/**
 * SubmitToJournalDialog
 * Lets users submit their paper from the editor — search for a journal or
 * be redirected to Journal Finder if they haven't decided yet.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Send, Search, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useJournals } from '@/contexts/JournalsContext';
import { useSubmissions } from '@/contexts/SubmissionsContext';
import type { Journal } from '@/types';
import JLoadingGlyph from '@/components/JLoadingGlyph';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  manuscriptTitle: string;
  manuscriptId: string;
}

export default function SubmitToJournalDialog({ isOpen, onClose, manuscriptTitle, manuscriptId }: Props) {
  const [, navigate] = useLocation();
  const { allJournals } = useJournals();
  const { addSubmission } = useSubmissions();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Journal | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected(null);
      setSubmitted(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return allJournals
      .filter((j) => j.name.toLowerCase().includes(q) || j.publisher?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allJournals]);

  const handleSelect = (journal: Journal) => {
    setSelected(journal);
    setQuery(journal.name);
    setDropdownOpen(false);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelected(null);
    setDropdownOpen(val.length >= 2);
  };

  const handleSubmit = () => {
    if (!selected) return;
    void (async () => {
      setIsSubmitting(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 650));
        addSubmission({
          manuscriptId,
          journalId: selected.id,
          journal: selected.name,
          title: manuscriptTitle,
          status: 'draft',
          submittedDate: new Date(),
        });
        setSubmitted(true);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleGoToDiscovery = () => {
    onClose();
    navigate('/discovery');
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-journi-green/15 flex items-center justify-center">
                <Send size={18} className="text-journi-green" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Submit Paper</h2>
                <p className="text-xs text-muted-foreground truncate max-w-[260px]">{manuscriptTitle}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {submitted ? (
            /* ── Success state ── */
            <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-journi-green/15 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-journi-green" />
              </div>
              <div>
                <p className="font-bold text-foreground">Submission created!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your paper has been added to the Submissions tracker under{' '}
                  <span className="font-medium text-foreground">{selected?.name}</span>.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={() => { handleClose(); navigate('/publication'); }}
                  className="px-4 py-2 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  View Submissions
                </button>
              </div>
            </div>
          ) : (
            /* ── Form state ── */
            <div className="px-6 py-5 space-y-5">
              {/* Journal search */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Which journal are you submitting to?
                </label>
                <div className="relative" ref={containerRef}>
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    onFocus={() => query.length >= 2 && setDropdownOpen(true)}
                    placeholder="Search journals by name or publisher…"
                    className="w-full pl-9 pr-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-journi-green transition-shadow"
                  />

                  {/* Suggestions dropdown */}
                  {dropdownOpen && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden max-h-64 overflow-y-auto">
                      {suggestions.map((j) => (
                        <button
                          key={j.id}
                          onClick={() => handleSelect(j)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors"
                        >
                          {j.logoUrl ? (
                            <img src={j.logoUrl} alt="" aria-hidden="true" className="w-8 h-9 rounded object-cover border border-border bg-white shrink-0" />
                          ) : (
                            <div className={`w-8 h-9 rounded bg-gradient-to-br ${j.coverColor} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                              {j.coverInitial}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{j.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{j.publisher}</p>
                          </div>
                          {j.impactFactor != null && (
                            <span className="text-xs text-muted-foreground shrink-0">IF {j.impactFactor.toFixed(1)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {dropdownOpen && query.length >= 2 && suggestions.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg z-10 px-4 py-3">
                      <p className="text-sm text-muted-foreground">No journals found for "{query}"</p>
                    </div>
                  )}
                </div>

                {/* Selected pill */}
                {selected && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-journi-green/10 border border-journi-green/20">
                    <BookOpen size={14} className="text-journi-green shrink-0" />
                    <span className="text-sm font-medium text-journi-green flex-1 truncate">{selected.name}</span>
                    <button
                      onClick={() => { setSelected(null); setQuery(''); inputRef.current?.focus(); }}
                      className="text-journi-green/60 hover:text-journi-green transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Discover journals CTA */}
              <button
                onClick={handleGoToDiscovery}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-dashed border-border hover:border-journi-green/40 hover:bg-journi-green/5 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-journi-green/10 transition-colors">
                    <BookOpen size={16} className="text-muted-foreground group-hover:text-journi-green transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Not sure which journal?</p>
                    <p className="text-xs text-muted-foreground">Browse and filter {allJournals.length.toLocaleString()} indexed journals</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-journi-green transition-colors shrink-0" />
              </button>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected || isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <JLoadingGlyph size={16} /> : <Send size={14} />}
                  {isSubmitting ? 'Submitting...' : 'Submit Paper'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
