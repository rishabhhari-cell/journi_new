import { useMemo, useState } from 'react';
import { ExternalLink, FileUp, Loader2 } from 'lucide-react';
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
    dataSource,
    isLoading,
  } = useJournals();

  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);

  const isIdle = !searchQuery.trim();
  const canShowMarquee = isIdle && allJournals.length > 0;

  const cards = useMemo(() => paginatedJournals, [paginatedJournals]);

  return (
    <div className="min-h-screen bg-muted/20">
      <Navbar />
      <main className="pt-20 pb-16">
        <section className="container space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">Journal Discovery</h1>
            <p className="text-sm text-muted-foreground">
              Search, compare, and shortlist journals with structured submission metadata.
            </p>
          </div>

          <SearchBar onSearch={setSearchQuery} />
          <FilterPanel filters={filters} onFiltersChange={setFilters} />

          {canShowMarquee && (
            <div className="pt-2">
              <JournalMarquee journals={allJournals.slice(0, 100)} totalAvailable={totalResults} rows={4} />
            </div>
          )}

          <section className="space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 size={18} className="animate-spin" />
                Loading journals...
              </div>
            )}

            {!isLoading && cards.length === 0 && (
              <div className="text-center py-16 border border-dashed border-border rounded-xl bg-card">
                <p className="text-foreground font-medium">No journals match the current filters.</p>
                <p className="text-sm text-muted-foreground mt-1">Try broadening the search criteria.</p>
              </div>
            )}

            {!isLoading && cards.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cards.map((journal) => (
                  <article
                    key={journal.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-journi-green/40 transition-colors"
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
                            className="text-xs font-semibold text-journi-green hover:underline"
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
