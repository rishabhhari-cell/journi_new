import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileUp, Search, SlidersHorizontal, X } from 'lucide-react';
import { MeshGradient } from "@paper-design/shaders-react";
import Navbar from '@/components/Navbar';
import SearchBar from '@/components/discovery/SearchBar';
import FilterPanel from '@/components/discovery/FilterPanel';
import Pagination from '@/components/discovery/Pagination';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import JournalMarquee from '@/components/discovery/JournalMarquee';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import { JournalMetricBadge } from '../components/discovery/JournalMetricBadge';
import { useJournals } from '@/contexts/JournalsContext';
import type { SortBy } from '@/contexts/JournalsContext';
import type { Journal } from '@/types';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'impactFactor', label: 'Impact Factor' },
  { value: 'acceptanceRate', label: 'Acceptance' },
  { value: 'name', label: 'Name' },
];
const HERO_SHADER_COLORS = ["#FFFFFF", "#D7F0DD", "#BFE5C8", "#D6CFF5", "#E8E2F6"];

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
  const [heroJournals, setHeroJournals] = useState<Journal[]>([]);

  const isIdle = !searchQuery.trim();
  const cards = useMemo(() => paginatedJournals, [paginatedJournals]);

  useEffect(() => {
    if (heroJournals.length === 0 && allJournals.length > 0) {
      setHeroJournals(allJournals.slice(0, 40));
    }
  }, [allJournals, heroJournals.length]);

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

      {/* Hero section */}
      <div
        className={`relative motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-in-out ${
          isIdle
            ? 'min-h-[560px] overflow-hidden'
            : 'overflow-visible border-b border-border/60 bg-white/80 supports-[backdrop-filter]:bg-white/65 supports-[backdrop-filter]:backdrop-blur-sm'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <MeshGradient
            className="absolute inset-0 h-full w-full opacity-[38%]"
            colors={HERO_SHADER_COLORS}
            speed={0.2}
          />
        </div>

        {heroJournals.length > 0 && isIdle && (
          <JournalMarquee journals={heroJournals} variant="hero" />
        )}

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 80% at 50% 50%, transparent 20%, rgba(180,215,180,0.3) 70%, rgba(160,200,160,0.6) 100%)',
          }}
        />

        <div
          className={`relative z-10 flex flex-col items-center px-4 ${
            isIdle ? 'h-full justify-center pt-20 pb-10' : 'justify-start pb-6 pt-24'
          }`}
        >
          <div className="w-full max-w-3xl px-2 md:px-0">
            {isIdle && (
              <div className="mb-6 text-center animate-in fade-in duration-300">
                <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 md:text-5xl">
                  Find Your <span className="text-journi-green">Journal</span>
                </h1>
                <p className="mx-auto mt-3 max-w-md text-base font-semibold text-slate-800">
                  Search{' '}
                  <span className="font-bold text-[#7f7fb3]">
                    {isLoading ? '...' : totalResults.toLocaleString()}
                  </span>{' '}
                  indexed medical journals
                </p>
              </div>
            )}

            <div className="mx-auto w-full max-w-2xl">
              <SearchBar onSearch={setSearchQuery} />
            </div>
          </div>
        </div>
      </div>

      {/* Below-hero content */}
      <main className="pb-16">
        <section className="container space-y-4 pt-6">
          {/* Filter toggle row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'border-journi-green/40 bg-journi-green/10 text-journi-green'
                  : 'border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              }`}
            >
              <SlidersHorizontal size={13} aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-journi-green text-[9px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters({})}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={12} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          {showFilters && (
            <FilterPanel filters={filters} onFiltersChange={setFilters} />
          )}

          <section className="space-y-4">
            {isLoading && !isIdle && (
              <p className="animate-pulse py-1 text-center text-xs text-muted-foreground">
                Finding your dream journal...
              </p>
            )}

            {!isIdle && cards.length === 0 && !isLoading && (
              <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
                <p className="font-medium text-foreground">No journals match the current filters.</p>
                <p className="mt-1 text-sm text-muted-foreground">Try broadening the search criteria.</p>
              </div>
            )}

            {isIdle && cards.length === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Start typing above to search journals</p>
              </div>
            )}

            {cards.length > 0 && (
              <>
                {/* Sort row */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <span className="mr-1.5 text-xs text-muted-foreground">Sort:</span>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSortBy(opt.value)}
                        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                          sortBy === opt.value
                            ? 'bg-journi-green/10 font-semibold text-journi-green'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Journal cards */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {cards.map((journal) => {
                    return (
                      <article
                        key={journal.id}
                        onClick={() => setSelectedJournal(journal)}
                        className="group cursor-pointer rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition-all hover:border-journi-green/40 hover:shadow-[0_2px_12px_rgba(79,177,81,0.08)]"
                      >
                        <div className="flex items-start gap-3">
                          {journal.logoUrl ? (
                            <img
                              src={journal.logoUrl}
                              alt={`${journal.name} logo`}
                              className="h-14 w-12 shrink-0 rounded-md border border-border bg-white object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className={`flex h-14 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${journal.coverColor} text-[9px] font-bold text-white`}
                            >
                              {journal.coverInitial}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h2 className="text-sm font-bold leading-snug text-foreground">{journal.name}</h2>
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {journal.publisher || 'Unknown Publisher'}
                                </p>
                              </div>
                              <span className="shrink-0 pt-0.5 text-[11px] font-medium text-journi-green opacity-0 transition-opacity group-hover:opacity-100">
                                Details -&gt;
                              </span>
                            </div>

                            <div className="mt-2.5 flex flex-wrap items-baseline gap-3">
                              <JournalMetricBadge journal={journal} size="card" />
                              <div className="flex flex-wrap gap-1.5">
                                {typeof journal.avgDecisionDays === 'number' && (
                                  <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    ~{journal.avgDecisionDays}d decision
                                  </span>
                                )}
                                {typeof journal.acceptanceRate === 'number' && (
                                  <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                    {journal.acceptanceRate}% accept
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <OAPolicyBadge journal={journal} />
                              {(journal.websiteUrl || journal.website) && (
                                <a
                                  href={journal.websiteUrl || journal.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
