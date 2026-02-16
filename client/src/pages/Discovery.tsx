/**
 * Journi Discovery Portal — Fully Functional
 * Real medical journal database with search, filters, acceptance scoring, and pagination
 */
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SearchBar from '@/components/discovery/SearchBar';
import FilterPanel from '@/components/discovery/FilterPanel';
import Pagination from '@/components/discovery/Pagination';
import ScoreBreakdown from '@/components/discovery/ScoreBreakdown';
import { useJournals } from '@/contexts/JournalsContext';
import { useManuscript } from '@/contexts/ManuscriptContext';
import {
  calculateAcceptanceLikelihood,
  extractManuscriptKeywords,
  extractManuscriptKeywordsWeighted,
  countWordsFromHtml,
} from '@/lib/acceptance-score';
import type { ManuscriptProfile } from '@/lib/acceptance-score';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, FileText, Sparkles, X } from 'lucide-react';

const DISCOVERY_BG =
  'https://private-us-east-1.manuscdn.com/sessionFile/26L77Mx18FIvYFxOwaY7CL/sandbox/x4psCbR5WAhHiPiXSrPmLs-img-4_1770760354000_na1fn_am91cm5pLWRpc2NvdmVyeS1oZXJv.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvMjZMNzdNeDE4Rkl2WUZ4T3dhWTdDTC9zYW5kYm94L3g0cHNDYlI1V0FoSGlQaVhTclBtTHMtaW1nLTRfMTc3MDc2MDM1NDAwMF9uYTFmbl9hbTkxY201cExXUnBjMk52ZG1WeWVTMW9aWEp2LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=UZmBQAoocAg~sfm9d2M~Gppt~4pucIfesw1vFCSn01lVfBMogc0LB8rsGAOJ7JTrPA~~HjsniBF723gLbvFFyPN91BtndWd3~9AWtRCP25GWSPINSlqh1D3CNONlScfTWU~VdzbZh6g76Z5sXDQvHHdEjCQK4GVXz4aKmNsKky9RfNWGhnz1yb55sPs4Yt60fobCJsjyA0MgC9XfdF0PortIN1KwmisT2sI4V7xpxrmFjQGzFmLYQ2NhoPcIJ76W0YmDAj2PwNTLr8wKj~CTIq3Edll8psqcTi~m8wUVKgxFahNDxU3XV120e7Jjw2aPeOV1Ah8dPQ8H8IoCtoFG1g__';

const COVER_COLORS = [
  'from-blue-800 to-blue-600',
  'from-emerald-800 to-emerald-600',
  'from-purple-800 to-purple-600',
  'from-rose-800 to-rose-600',
  'from-amber-800 to-amber-600',
  'from-teal-800 to-teal-600',
  'from-indigo-800 to-indigo-600',
  'from-pink-800 to-pink-600',
  'from-cyan-800 to-cyan-600',
  'from-orange-800 to-orange-600',
];

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const bgColor =
    score >= 75
      ? 'bg-status-completed'
      : score >= 55
        ? 'bg-journi-green'
        : score >= 40
          ? 'bg-status-pending'
          : 'bg-muted-foreground';
  return (
    <div
      className={`w-14 h-14 rounded-full ${bgColor} flex flex-col items-center justify-center shrink-0`}
    >
      <span className="text-lg font-extrabold text-white leading-none">{score}</span>
      <span className="text-[7px] font-semibold text-white/80 uppercase leading-tight">
        {label}
      </span>
    </div>
  );
}

export default function Discovery() {
  const {
    filteredJournals,
    paginatedJournals,
    filters,
    currentPage,
    resultsPerPage,
    totalPages,
    setSearchQuery,
    setFilters,
    setCurrentPage,
    setResultsPerPage,
  } = useJournals();

  const { manuscript } = useManuscript();
  const [, navigate] = useLocation();
  const [autoMatchMode, setAutoMatchMode] = useState(false);

  // Build manuscript profile once for scoring all journals — deep semantic analysis
  const manuscriptProfile: ManuscriptProfile = useMemo(
    () => {
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
    },
    [manuscript]
  );

  // When in auto-match mode, score and sort ALL journals by acceptance likelihood (descending)
  const scoredJournals = useMemo(() => {
    const source = autoMatchMode ? filteredJournals : paginatedJournals;
    return source.map((journal) => ({
      journal,
      likelihood: calculateAcceptanceLikelihood(journal, manuscriptProfile),
    }));
  }, [autoMatchMode, filteredJournals, paginatedJournals, manuscriptProfile]);

  const sortedScoredJournals = useMemo(() => {
    if (!autoMatchMode) return scoredJournals;
    return [...scoredJournals].sort((a, b) => b.likelihood.overall - a.likelihood.overall);
  }, [autoMatchMode, scoredJournals]);

  // In auto-match mode, paginate manually after scoring
  const displayJournals = useMemo(() => {
    if (!autoMatchMode) return sortedScoredJournals;
    const start = (currentPage - 1) * resultsPerPage;
    return sortedScoredJournals.slice(start, start + resultsPerPage);
  }, [autoMatchMode, sortedScoredJournals, currentPage, resultsPerPage]);

  const effectiveTotalPages = autoMatchMode
    ? Math.ceil(sortedScoredJournals.length / resultsPerPage)
    : totalPages;

  // Handle "Find My Journal" click
  const handleFindMyJournal = () => {
    setSearchQuery('');
    setAutoMatchMode(true);
    setCurrentPage(1);
  };

  const handleExitAutoMatch = () => {
    setAutoMatchMode(false);
  };

  // Get initials from journal name
  const getInitials = (name: string) => {
    const words = name.split(' ').filter((w) => w.length > 0);
    if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
    return words
      .slice(0, 3)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-28 pb-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${DISCOVERY_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 to-white" />
        <div className="container relative z-10">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3">
              Discovery Portal
            </h1>
            <p className="text-muted-foreground text-lg mb-8">
              Find the perfect journal for your research from our database of indexed medical
              journals
            </p>

            {/* Search Bar + Find My Journal */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <SearchBar onSearch={(q) => { setAutoMatchMode(false); setSearchQuery(q); }} />
              </div>
              <button
                onClick={handleFindMyJournal}
                className={`shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  autoMatchMode
                    ? 'bg-journi-green text-journi-slate shadow-lg shadow-journi-green/20'
                    : 'bg-journi-green/10 text-journi-green hover:bg-journi-green/20 border border-journi-green/30'
                }`}
              >
                <Sparkles size={16} />
                Find My Journal
              </button>
            </div>

            {/* Filters */}
            <div className="mt-5">
              <FilterPanel filters={filters} onFiltersChange={setFilters} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Results */}
      <section className="pb-20">
        <div className="container">
          {/* Auto-match banner */}
          <AnimatePresence>
            {autoMatchMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-journi-green/10 border border-journi-green/20">
                  <Sparkles size={16} className="text-journi-green shrink-0" />
                  <p className="text-sm text-foreground flex-1">
                    Showing journals matched to your manuscript:{' '}
                    <span className="font-semibold">{manuscript.title || 'Untitled'}</span>.
                    Sorted by acceptance likelihood.
                  </p>
                  <button
                    onClick={handleExitAutoMatch}
                    className="p-1 rounded hover:bg-journi-green/20 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-sm text-muted-foreground mb-6">
            Showing{' '}
            <span className="font-medium text-foreground">
              {autoMatchMode ? sortedScoredJournals.length : filteredJournals.length}
            </span>{' '}
            results{autoMatchMode ? ' sorted by acceptance likelihood' : ''}
          </p>

          {displayJournals.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">No journals found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {displayJournals.map(({ journal, likelihood }, i) => {
                  const coverColor = COVER_COLORS[i % COVER_COLORS.length];
                  const initials = getInitials(journal.name);

                  return (
                    <motion.div
                      key={journal.id}
                      className="bg-card rounded-xl border border-border p-5 hover:shadow-lg hover:shadow-journi-green/5 transition-all duration-300 group"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                    >
                      <div className="flex gap-4">
                        {/* Journal Cover */}
                        <div
                          className={`w-16 h-20 rounded-lg bg-gradient-to-br ${coverColor} flex items-center justify-center shrink-0 shadow-md`}
                        >
                          <span className="text-white text-xs font-bold">{initials}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-bold text-foreground group-hover:text-journi-green transition-colors">
                                {journal.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {journal.publisher} &middot; IF: {journal.impactFactor.toFixed(1)}
                              </p>
                            </div>
                            <ScoreBadge score={likelihood.overall} label={likelihood.label} />
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-journi-green rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${likelihood.overall}%` }}
                              transition={{ delay: 0.3 + i * 0.06, duration: 0.6 }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bottom: Timeline Insight + Score Breakdown */}
                      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                        {/* Timeline Insight */}
                        <div>
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Clock size={10} />
                            Journal Metrics
                          </h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Impact Factor</span>
                              <span className="text-xs font-medium text-foreground">
                                {journal.impactFactor.toFixed(1)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Acceptance Rate</span>
                              <span className="text-xs font-medium text-foreground">
                                {journal.acceptanceRate}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Avg. Decision</span>
                              <span className="text-xs font-medium text-foreground">
                                {journal.avgDecisionDays} days
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Open Access</span>
                              <span
                                className={`text-xs font-medium ${journal.openAccess ? 'text-journi-green' : 'text-muted-foreground'}`}
                              >
                                {journal.openAccess ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Score Breakdown */}
                        <div>
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            Acceptance Likelihood
                          </h4>
                          <ScoreBreakdown likelihood={likelihood} />
                        </div>
                      </div>

                      {/* Format for Journal button */}
                      <div className="mt-3 pt-3 border-t border-border">
                        <button
                          onClick={() => navigate(`/format/${journal.id}`)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-journi-green bg-journi-green/10 hover:bg-journi-green/20 rounded-lg transition-colors"
                        >
                          <FileText size={14} />
                          Format Manuscript for This Journal
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={effectiveTotalPages}
                resultsPerPage={resultsPerPage}
                totalResults={autoMatchMode ? sortedScoredJournals.length : filteredJournals.length}
                onPageChange={setCurrentPage}
                onResultsPerPageChange={setResultsPerPage}
              />
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
