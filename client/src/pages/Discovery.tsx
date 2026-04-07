import { useMemo, useState, useEffect, useRef } from 'react';
import { ExternalLink, FileUp, Search, SlidersHorizontal, X } from 'lucide-react';
import { MeshGradient } from "@paper-design/shaders-react";
import Navbar from '@/components/Navbar';
import SearchBar from '@/components/discovery/SearchBar';
import FilterPanel from '@/components/discovery/FilterPanel';
import Pagination from '@/components/discovery/Pagination';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import JournalMarquee from '@/components/discovery/JournalMarquee';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import LoadingScreen from '@/components/LoadingScreen';
import { useJournals } from '@/contexts/JournalsContext';
import type { SortBy } from '@/contexts/JournalsContext';
import type { Journal } from '@/types';

function formatImpactFactor(value: number | null | undefined): string | null {
  if (typeof value !== 'number') return null;
  return value.toFixed(1);
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'impactFactor', label: 'Impact Factor' },
  { value: 'acceptanceRate', label: 'Acceptance' },
  { value: 'name', label: 'Name' },
];

export default function Discovery() {
  const {
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    totalPages,
    totalResults,
    resultsPerPage,
    setResultsPerPage,
    paginatedJournals,
    allJournals,
    isLoading,
  } = useJournals();

  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const isIdle = !searchQuery.trim();

  // Burst overlay: shown briefly when a search completes (isLoading true → false).
  const [searchProgress, setSearchProgress] = useState<number | undefined>(undefined);
  const prevLoadingRef = useRef(isLoading);
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;
    // Only burst on a real search completing, not the initial idle load.
    if (wasLoading && !isLoading && !isIdle) {
      setSearchProgress(100);
      const hide = setTimeout(() => setSearchProgress(undefined), 1500);
      return () => clearTimeout(hide);
    }
  }, [isLoading, isIdle]);
  const cards = useMemo(() => paginatedJournals, [paginatedJournals]);

  const activeFilterCount = [
    filters.impactFactorMin !== undefined,
    filters.impactFactorMax !== undefined,
    filters.openAccess !== undefined,
    (filters.subjectAreas?.length ?? 0) > 0,
    (filters.geographicLocations?.length ?? 0) > 0,
    filters.timeToPublicationMax !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />

      {/* â”€â”€ Hero Section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={`relative overflow-hidden motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-in-out
          ${isIdle ? 'h-[560px]' : 'h-[120px]'}`}
      >
        {/* Shader base behind journal covers */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <MeshGradient
            className="absolute inset-0 w-full h-full opacity-[38%]"
            colors={["#FFFFFF", "#D7F0DD", "#BFE5C8", "#D6CFF5", "#E8E2F6"]}
            speed={0.2}
          />
        </div>

        {/* Scattered journal covers â€” behind everything */}
        {allJournals.length > 0 && isIdle && (
          <JournalMarquee
            journals={allJournals.slice(0, 40)}
            variant="hero"
          />
        )}

        {/* Vignette: softens edges so covers blend into the sage background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 80% at 50% 50%, transparent 20%, rgba(180,215,180,0.3) 70%, rgba(160,200,160,0.6) 100%)',
          }}
        />

        {/* Centered hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-20 pb-10 px-4">
          <div className="w-full max-w-3xl px-2 md:px-0">
            {isIdle && (
              <div className="text-center mb-6 animate-in fade-in duration-300">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                  Find Your Journal
                </h1>
                <p className="mt-3 text-base text-slate-800 max-w-md mx-auto font-semibold">
                  Search{' '}
                  <span className="font-bold text-slate-900">
                    {isLoading ? '…' : totalResults.toLocaleString()}
                  </span>{' '}
                  indexed medical journals and shortlist with confidence.
                </p>
              </div>
            )}

            {/* Search bar — always visible in hero */}
            <div className="w-full max-w-2xl mx-auto">
              <SearchBar onSearch={setSearchQuery} />
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Below-hero content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <main className="pb-16">
        <section className="container space-y-4 pt-6">

          {/* â”€â”€ Filter toggle row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-journi-green/40 bg-journi-green/10 text-journi-green'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
              }`}
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-journi-green text-white text-[9px] font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({})}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          {/* Filter panel â€” shown when toggled */}
          {showFilters && (
            <FilterPanel filters={filters} onFiltersChange={setFilters} />
          )}

          <section className="space-y-4">
            {/* Burst overlay when search finishes — all-purple dashes, no J fill */}
            {searchProgress === 100 && (
              <LoadingScreen fullscreen={false} progress={searchProgress} hideJFill />
            )}
            {isLoading && (
              <div className="relative min-h-[400px]">
                <LoadingScreen fullscreen={false} hideJFill />
              </div>
            )}

            {!isLoading && !isIdle && cards.length === 0 && (
              <div className="text-center py-16 border border-dashed border-border rounded-xl bg-card">
                <p className="text-foreground font-medium">No journals match the current filters.</p>
                <p className="text-sm text-muted-foreground mt-1">Try broadening the search criteria.</p>
              </div>
            )}

            {!isLoading && isIdle && cards.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Start typing above to search journals</p>
              </div>
            )}

            {!isLoading && cards.length > 0 && (
              <>
                {/* â”€â”€ Sort row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs text-muted-foreground mr-1.5">Sort:</span>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                          sortBy === opt.value
                            ? 'bg-journi-green/10 text-journi-green font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* â”€â”€ Journal cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {cards.map((journal) => {
                    const ifStr = formatImpactFactor(journal.impactFactor);
                    return (
                      <article
                        key={journal.id}
                        onClick={() => setSelectedJournal(journal)}
                        className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm hover:border-journi-green/40 hover:shadow-[0_2px_12px_rgba(79,177,81,0.08)] transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-3">
                          {/* Cover thumbnail */}
                          {journal.logoUrl ? (
                            <img
                              src={journal.logoUrl}
                              alt={`${journal.name} logo`}
                              className="w-12 h-14 rounded-md object-cover border border-border bg-white shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={`w-12 h-14 rounded-md bg-gradient-to-br ${journal.coverColor} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}
                            >
                              {journal.coverInitial}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {/* Name + publisher + hover arrow */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h2 className="text-sm font-bold text-foreground leading-snug">{journal.name}</h2>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                  {journal.publisher || 'Unknown Publisher'}
                                </p>
                              </div>
                              <span className="text-[11px] text-journi-green shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-medium pt-0.5">
                                Details â†’
                              </span>
                            </div>

                            {/* Impact factor + secondary info pills */}
                            <div className="mt-2.5 flex items-baseline gap-3 flex-wrap">
                              <div className="flex items-baseline gap-1 shrink-0">
                                <span className="text-lg font-extrabold text-foreground leading-none">
                                  {ifStr ?? 'â€”'}
                                </span>
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                                  IF
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {typeof journal.avgDecisionDays === 'number' && (
                                  <span className="text-[10px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full">
                                    ~{journal.avgDecisionDays}d decision
                                  </span>
                                )}
                                {typeof journal.acceptanceRate === 'number' && (
                                  <span className="text-[10px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full">
                                    {journal.acceptanceRate}% accept
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* OA badges + external links */}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <OAPolicyBadge journal={journal} />
                              {(journal.websiteUrl || journal.website) && (
                                <a
                                  href={journal.websiteUrl || journal.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                  <ExternalLink size={10} aria-hidden="true" /> Website
                                </a>
                              )}
                              {journal.submissionPortalUrl && (
                                <a
                                  href={journal.submissionPortalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                >
                                  <FileUp size={10} aria-hidden="true" /> Submit
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(totalPages, 1)}
              resultsPerPage={resultsPerPage}
              totalResults={totalResults}
              onPageChange={setCurrentPage}
              onResultsPerPageChange={setResultsPerPage}
            />
          </section>
        </section>
      </main>

      <JournalDetailDrawer journal={selectedJournal} onClose={() => setSelectedJournal(null)} />
    </div>
  );
}


