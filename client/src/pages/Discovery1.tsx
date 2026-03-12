/**
 * Discovery 1 — Split Panel Explorer
 * Persistent left sidebar with search + filters.
 * Right side shows a compact scannable list.
 * Clicking any journal opens the full detail drawer.
 */
import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import Pagination from '@/components/discovery/Pagination';
import { useJournals } from '@/contexts/JournalsContext';
import { useManuscript } from '@/contexts/ManuscriptContext';
import {
  calculateAcceptanceLikelihood,
  extractManuscriptKeywordsWeighted,
  countWordsFromHtml,
} from '@/lib/acceptance-score';
import type { Journal } from '@/types';
import type { ManuscriptProfile } from '@/lib/acceptance-score';
import { Search, Sparkles, X, ChevronDown, ChevronUp, TrendingUp, Clock } from 'lucide-react';
import { ALL_SUBJECT_AREAS } from '@/data/journals-database';
import { motion } from 'framer-motion';

function ScoreRing({ score }: { score: number }) {
  const borderColor =
    score >= 75
      ? 'border-emerald-500 text-emerald-600'
      : score >= 55
        ? 'border-journi-green text-journi-green'
        : score >= 40
          ? 'border-amber-500 text-amber-600'
          : 'border-muted text-muted-foreground';
  return (
    <div className={`w-11 h-11 rounded-full border-2 ${borderColor} flex flex-col items-center justify-center shrink-0`}>
      <span className="text-xs font-bold leading-none">{score}</span>
      <span className="text-[8px] leading-none mt-0.5 opacity-70">fit</span>
    </div>
  );
}

export default function Discovery1() {
  const {
    paginatedJournals,
    filters,
    searchQuery,
    currentPage,
    resultsPerPage,
    totalPages,
    totalResults,
    setSearchQuery,
    setFilters,
    setCurrentPage,
    setResultsPerPage,
    isLoading,
  } = useJournals();

  const { manuscript } = useManuscript();
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [autoMatchMode, setAutoMatchMode] = useState(false);
  const [subjectExpanded, setSubjectExpanded] = useState(false);

  const manuscriptProfile: ManuscriptProfile = useMemo(() => {
    const keywordWeights = extractManuscriptKeywordsWeighted(manuscript);
    const subjectKeywords = Array.from(keywordWeights.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([area]) => area);
    return {
      subjectKeywords,
      keywordWeights,
      totalWordCount: manuscript.sections.reduce(
        (sum, s) => sum + countWordsFromHtml(s.content),
        0
      ),
      prefersOpenAccess: true,
    };
  }, [manuscript]);

  const scoredJournals = useMemo(() => {
    return paginatedJournals.map((journal) => ({
      journal,
      likelihood: calculateAcceptanceLikelihood(journal, manuscriptProfile),
    }));
  }, [paginatedJournals, manuscriptProfile]);

  const displayJournals = useMemo(() => {
    if (!autoMatchMode) return scoredJournals;
    return [...scoredJournals].sort((a, b) => b.likelihood.overall - a.likelihood.overall);
  }, [autoMatchMode, scoredJournals]);

  const toggleOA = (val: boolean | undefined) => {
    if (filters.openAccess === val) {
      const { openAccess: _, ...rest } = filters;
      setFilters(rest);
    } else {
      setFilters({ ...filters, openAccess: val });
    }
  };

  const toggleSubjectArea = (area: string) => {
    const current = filters.subjectAreas || [];
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    setFilters({ ...filters, subjectAreas: updated });
  };

  const clearAll = () => {
    setFilters({});
    setSearchQuery('');
    setAutoMatchMode(false);
  };

  const hasFilters =
    searchQuery ||
    filters.openAccess !== undefined ||
    filters.impactFactorMin ||
    (filters.subjectAreas && filters.subjectAreas.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <div className="flex flex-1 pt-16">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 border-r border-border sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto bg-card">
          <div className="p-5 space-y-5">
            {/* Title */}
            <div>
              <h2 className="text-base font-bold text-foreground">Journal Discovery</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalResults.toLocaleString()} journals indexed
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setAutoMatchMode(false); setSearchQuery(e.target.value); }}
                placeholder="Search by name or ISSN..."
                className="w-full pl-9 pr-8 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-journi-green"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Find My Journal */}
            <button
              onClick={() => { setAutoMatchMode(!autoMatchMode); setSearchQuery(''); }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                autoMatchMode
                  ? 'bg-journi-green text-journi-slate shadow-lg shadow-journi-green/20'
                  : 'bg-journi-green/10 text-journi-green hover:bg-journi-green/20 border border-journi-green/30'
              }`}
            >
              <Sparkles size={15} />
              {autoMatchMode ? 'Showing My Matches' : 'Find My Journal'}
            </button>

            <div className="border-t border-border" />

            {/* OA Filter */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Open Access
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { label: 'All', val: undefined },
                  { label: 'OA Only', val: true },
                  { label: 'Subs.', val: false },
                ] as const).map(({ label, val }) => (
                  <button
                    key={label}
                    onClick={() => toggleOA(val)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filters.openAccess === val
                        ? 'bg-journi-green text-journi-slate'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* IF Min */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Min Impact Factor:{' '}
                <span className="text-foreground font-bold">{filters.impactFactorMin ?? 0}</span>
              </p>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={filters.impactFactorMin ?? 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setFilters({ ...filters, impactFactorMin: val > 0 ? val : undefined });
                }}
                className="w-full accent-journi-green"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span><span>100+</span>
              </div>
            </div>

            {/* Subject Areas */}
            <div>
              <button
                onClick={() => setSubjectExpanded(!subjectExpanded)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Subject Areas
                {(filters.subjectAreas?.length ?? 0) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-journi-green text-journi-slate text-[10px]">
                    {filters.subjectAreas!.length}
                  </span>
                )}
                {subjectExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>

              {subjectExpanded && (
                <div className="mt-2 space-y-0.5 max-h-52 overflow-y-auto">
                  {ALL_SUBJECT_AREAS.slice(0, 24).map((area) => {
                    const isSelected = filters.subjectAreas?.includes(area) || false;
                    return (
                      <button
                        key={area}
                        onClick={() => toggleSubjectArea(area)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                          isSelected
                            ? 'bg-journi-green/10 text-journi-green font-medium'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clear All */}
            {hasFilters && (
              <button
                onClick={clearAll}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <X size={12} /> Clear All Filters
              </button>
            )}
          </div>
        </aside>

        {/* ── Results pane ── */}
        <main className="flex-1 min-w-0 p-5 lg:p-6">
          {/* Auto-match banner */}
          {autoMatchMode && (
            <div className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-journi-green/10 border border-journi-green/20 text-sm">
              <Sparkles size={14} className="text-journi-green shrink-0" />
              <span className="flex-1 text-foreground">
                Matched to{' '}
                <span className="font-semibold">{manuscript.title || 'your manuscript'}</span>{' '}
                — sorted by acceptance likelihood
              </span>
              <button onClick={() => setAutoMatchMode(false)}>
                <X size={14} className="text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground mb-4">
            {isLoading ? (
              'Searching...'
            ) : (
              <>
                <span className="font-medium text-foreground">{totalResults.toLocaleString()}</span>{' '}
                {autoMatchMode ? 'results sorted by fit' : 'results'}
              </>
            )}
          </p>

          {isLoading ? (
            <div className="text-center py-20">
              <div className="w-10 h-10 rounded-full border-4 border-journi-green/20 border-t-journi-green animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading journals...</p>
            </div>
          ) : displayJournals.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">No journals found. Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {displayJournals.map(({ journal, likelihood }, i) => (
                  <motion.button
                    key={journal.id}
                    onClick={() => setSelectedJournal(journal)}
                    className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-journi-green/40 hover:shadow-md hover:shadow-journi-green/5 transition-all duration-200 group"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Cover */}
                      <div
                        className={`w-10 h-12 rounded-lg bg-gradient-to-br ${journal.coverColor} flex items-center justify-center shrink-0 shadow-sm`}
                      >
                        <span className="text-white text-[10px] font-bold">{journal.coverInitial}</span>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground group-hover:text-journi-green transition-colors truncate">
                          {journal.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {journal.publisher}
                          {journal.impactFactor != null && (
                            <>
                              {' '}
                              <span className="inline-flex items-center gap-0.5">
                                <TrendingUp size={10} className="inline" /> {journal.impactFactor.toFixed(1)}
                              </span>
                            </>
                          )}
                          {journal.avgDecisionDays != null && (
                            <>
                              {' · '}
                              <span className="inline-flex items-center gap-0.5">
                                <Clock size={10} className="inline" /> {journal.avgDecisionDays}d
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Badges */}
                      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <OAPolicyBadge journal={journal} size="sm" />
                        {journal.isMedlineIndexed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                            MEDLINE
                          </span>
                        )}
                      </div>

                      {/* Score ring */}
                      <ScoreRing score={likelihood.overall} />
                    </div>

                    {/* Slim progress bar */}
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-journi-green rounded-full"
                        style={{ width: `${likelihood.overall}%` }}
                      />
                    </div>
                  </motion.button>
                ))}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                resultsPerPage={resultsPerPage}
                totalResults={totalResults}
                onPageChange={setCurrentPage}
                onResultsPerPageChange={setResultsPerPage}
              />
            </>
          )}
        </main>
      </div>

      <JournalDetailDrawer
        journal={selectedJournal}
        onClose={() => setSelectedJournal(null)}
      />

      <Footer />
    </div>
  );
}
