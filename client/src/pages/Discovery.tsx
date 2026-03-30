import { useMemo, useState } from 'react';
import { ExternalLink, FileUp, Loader2, Search } from 'lucide-react';
import Navbar from '@/components/Navbar';
import SearchBar from '@/components/discovery/SearchBar';
import FilterPanel from '@/components/discovery/FilterPanel';
import Pagination from '@/components/discovery/Pagination';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import JournalMarquee from '@/components/discovery/JournalMarquee';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import { useJournals } from '@/contexts/JournalsContext';
import type { Journal } from '@/types';

function formatImpactFactor(value: number | null | undefined) {
  if (typeof value !== 'number') return 'N/A';
  return value.toFixed(2);
}

export default function Discovery() {
  const {
    filters,
    setFilters,
    searchQuery,
    setSearchQuery,
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

  const isIdle = !searchQuery.trim();
  const cards = useMemo(() => paginatedJournals, [paginatedJournals]);

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────────────────────── */}
      <div
        className={`relative overflow-hidden motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-in-out bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
          ${isIdle ? 'h-[560px]' : 'h-[120px]'}`}
      >
        {/* Scattered journal covers — behind everything */}
        {allJournals.length > 0 && isIdle && (
          <JournalMarquee
            journals={allJournals.slice(0, 40)}
            variant="hero"
          />
        )}

        {/* Vignette: darkens edges, keeps centre clear so covers are visible */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 80% at 50% 50%, transparent 20%, rgba(15,23,42,0.55) 70%, rgba(15,23,42,0.90) 100%)',
          }}
        />

        {/* Centered hero content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full pt-20 pb-10 px-4">
          {isIdle && (
            <div className="text-center mb-8 animate-in fade-in duration-300">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight drop-shadow-lg">
                Find Your Journal
              </h1>
              <p className="mt-3 text-base text-white/60 max-w-md mx-auto">
                Search{' '}
                <span className="font-semibold text-white/80">
                  {totalResults.toLocaleString()}
                </span>{' '}
                indexed medical journals and shortlist with confidence.
              </p>
            </div>
          )}

          {/* Search bar — always visible in hero */}
          <div className="w-full max-w-2xl">
            <SearchBar onSearch={setSearchQuery} dark />
          </div>
        </div>
      </div>

      {/* ── Below-hero content ─────────────────────────────────────────────── */}
      <main className="pb-16">
        <section className="container space-y-4 pt-6">
          <FilterPanel filters={filters} onFiltersChange={setFilters} />

          <section className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                Loading journals...
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cards.map((journal) => (
                  <article
                    key={journal.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-[#9999cc]/45 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {journal.logoUrl ? (
                        <img
                          src={journal.logoUrl}
                          alt={`${journal.name} logo`}
                          className="w-12 h-14 rounded-md object-cover border border-border bg-white"
                          loading="lazy"
                        />
                      ) : (
                        <div className={`w-12 h-14 rounded-md bg-gradient-to-br ${journal.coverColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {journal.coverInitial}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-base font-bold text-foreground leading-snug">{journal.name}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {journal.publisher || 'Unknown Publisher'}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedJournal(journal)}
                            className="text-xs font-semibold text-[#8b86c4] hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9999cc]/40 rounded-sm"
                          >
                            View details
                          </button>
                        </div>

                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded bg-muted/40">
                            <p className="text-muted-foreground">Impact factor</p>
                            <p className="font-semibold text-foreground">{formatImpactFactor(journal.impactFactor)}</p>
                          </div>
                          <div className="p-2 rounded bg-muted/40">
                            <p className="text-muted-foreground">Decision time</p>
                            <p className="font-semibold text-foreground">
                              {typeof journal.avgDecisionDays === 'number' ? `${journal.avgDecisionDays}d` : 'N/A'}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-muted/40">
                            <p className="text-muted-foreground">Acceptance</p>
                            <p className="font-semibold text-foreground">
                              {typeof journal.acceptanceRate === 'number' ? `${journal.acceptanceRate}%` : 'N/A'}
                            </p>
                          </div>
                          <div className="p-2 rounded bg-muted/40">
                            <p className="text-muted-foreground">Open access</p>
                            <p className="font-semibold text-foreground">
                              {journal.openAccess === true ? 'Yes' : journal.openAccess === false ? 'No' : 'Unknown'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2">
                          <OAPolicyBadge journal={journal} />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {journal.websiteUrl || journal.website ? (
                            <a
                              href={journal.websiteUrl || journal.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-accent"
                            >
                              <ExternalLink size={13} /> Website
                            </a>
                          ) : null}
                          {journal.submissionPortalUrl ? (
                            <a
                              href={journal.submissionPortalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-accent"
                            >
                              <FileUp size={13} /> Submission Portal
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
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
