/**
 * Discovery 2 — Guided Match Wizard
 * A 3-step wizard pre-filled from the user's manuscript context.
 * After running, shows results as a prominent ranked recommendation list.
 */
import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import SearchBar from '@/components/discovery/SearchBar';
import Pagination from '@/components/discovery/Pagination';
import { useJournals } from '@/contexts/JournalsContext';
import { useManuscript } from '@/contexts/ManuscriptContext';
import {
  calculateAcceptanceLikelihood,
  extractManuscriptKeywordsWeighted,
  countWordsFromHtml,
} from '@/lib/acceptance-score';
import type { Journal, JournalFilters } from '@/types';
import type { ManuscriptProfile } from '@/lib/acceptance-score';
import {
  Sparkles,
  ChevronRight,
  FileText,
  X,
  TrendingUp,
  Clock,
  Users,
  ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type OAPreference = 'required' | 'preferred' | 'none';

export default function Discovery2() {
  const {
    paginatedJournals,
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
  const [oaPreference, setOaPreference] = useState<OAPreference>('preferred');
  const [maxDays, setMaxDays] = useState(300);
  const [resultsVisible, setResultsVisible] = useState(false);

  const topKeywords = useMemo(() => {
    const weights = extractManuscriptKeywordsWeighted(manuscript);
    return Array.from(weights.keys()).slice(0, 8);
  }, [manuscript]);

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
      prefersOpenAccess: oaPreference !== 'none',
    };
  }, [manuscript, oaPreference]);

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

  const handleRunWizard = () => {
    const newFilters: JournalFilters = {};
    if (oaPreference === 'required') newFilters.openAccess = true;
    if (maxDays < 300) newFilters.timeToPublicationMax = maxDays;
    setFilters(newFilters);
    setSearchQuery('');
    setAutoMatchMode(true);
    setResultsVisible(true);
  };

  const handleReset = () => {
    setAutoMatchMode(false);
    setResultsVisible(false);
    setFilters({});
    setSearchQuery('');
  };

  const scoreConfig = (score: number) => {
    if (score >= 75) return { bg: 'bg-emerald-600', label: 'Strong' };
    if (score >= 55) return { bg: 'bg-journi-green', label: 'Good' };
    if (score >= 40) return { bg: 'bg-amber-500', label: 'Fair' };
    return { bg: 'bg-muted-foreground', label: 'Low' };
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20 pb-16">
        <div className="container max-w-2xl">
          <AnimatePresence mode="wait">
            {/* ── Wizard ── */}
            {!resultsVisible ? (
              <motion.div
                key="wizard"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35 }}
              >
                {/* Hero */}
                <div className="text-center mb-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-journi-green/10 text-journi-green text-xs font-semibold mb-4">
                    <Sparkles size={12} /> AI-Powered Matching
                  </span>
                  <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">
                    Find Your Perfect Journal
                  </h1>
                  <p className="text-muted-foreground text-base">
                    Three questions. Ranked results. No guesswork.
                  </p>
                </div>

                {/* Step 1 — Research topic */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
                      1
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      What is your manuscript about?
                    </h3>
                  </div>

                  {topKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="px-3 py-1 rounded-full bg-journi-green/10 text-journi-green text-xs font-medium border border-journi-green/20"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No manuscript loaded yet.{' '}
                      <a href="/collaboration" className="text-journi-green hover:underline">
                        Go to Collaboration
                      </a>{' '}
                      to start writing, then come back.
                    </p>
                  )}

                  {manuscript.title && (
                    <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                      <FileText size={11} />
                      {manuscript.title}
                    </p>
                  )}
                </div>

                {/* Step 2 — OA preference */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Open Access preference?</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { val: 'required', label: 'Required', desc: 'OA journals only' },
                        { val: 'preferred', label: 'Preferred', desc: 'Favour OA, show all' },
                        { val: 'none', label: 'No Preference', desc: 'Any journal type' },
                      ] as const
                    ).map(({ val, label, desc }) => (
                      <button
                        key={val}
                        onClick={() => setOaPreference(val)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                          oaPreference === val
                            ? 'border-journi-green bg-journi-green/5'
                            : 'border-border hover:border-journi-green/40'
                        }`}
                      >
                        <p className="text-xs font-semibold text-foreground">{label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3 — Timeline */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-7 h-7 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      How quickly do you need a decision?
                    </h3>
                  </div>

                  <input
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    value={maxDays}
                    onChange={(e) => setMaxDays(parseInt(e.target.value))}
                    className="w-full accent-journi-green"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">30 days</span>
                    <span className="text-sm font-semibold text-journi-green">
                      {maxDays >= 300 ? 'Any timeline' : `Up to ${maxDays} days`}
                    </span>
                    <span className="text-xs text-muted-foreground">No limit</span>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleRunWizard}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-journi-green text-journi-slate font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-journi-green/25"
                >
                  <Sparkles size={18} />
                  Find My Journals
                  <ChevronRight size={18} />
                </button>

                {/* Divider — direct search */}
                <div className="mt-10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-xs text-muted-foreground font-medium">
                      or search directly
                    </span>
                    <div className="flex-1 border-t border-border" />
                  </div>
                  <SearchBar
                    onSearch={(q) => {
                      setAutoMatchMode(false);
                      setSearchQuery(q);
                      setResultsVisible(true);
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              /* ── Results view ── */
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Results header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Sparkles size={16} className="text-journi-green" />
                      <h2 className="text-xl font-bold text-foreground">
                        {autoMatchMode ? 'Your Matched Journals' : 'Search Results'}
                      </h2>
                    </div>
                    {autoMatchMode && (
                      <p className="text-sm text-muted-foreground">
                        Ranked by fit for{' '}
                        <span className="font-medium text-foreground">
                          {manuscript.title || 'your manuscript'}
                        </span>
                        {oaPreference !== 'none' && (
                          <> · OA {oaPreference}</>
                        )}
                        {maxDays < 300 && <> · ≤{maxDays} day decision</>}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Back to wizard
                  </button>
                </div>

                {isLoading ? (
                  <div className="text-center py-20">
                    <div className="w-10 h-10 rounded-full border-4 border-journi-green/20 border-t-journi-green animate-spin mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Finding journals...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {displayJournals.map(({ journal, likelihood }, i) => {
                        const { bg, label } = scoreConfig(likelihood.overall);
                        return (
                          <motion.button
                            key={journal.id}
                            onClick={() => setSelectedJournal(journal)}
                            className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:border-journi-green/40 hover:shadow-lg hover:shadow-journi-green/5 transition-all duration-200 group"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <div className="flex gap-4">
                              {/* Score block */}
                              <div
                                className={`w-14 h-14 rounded-xl ${bg} flex flex-col items-center justify-center shrink-0 shadow-sm`}
                              >
                                <span className="text-2xl font-extrabold text-white leading-none">
                                  {likelihood.overall}
                                </span>
                                <span className="text-[9px] font-semibold text-white/80 uppercase">
                                  {label}
                                </span>
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-foreground group-hover:text-journi-green transition-colors leading-snug">
                                      {journal.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {journal.publisher}
                                    </p>
                                  </div>
                                  <div className="shrink-0 flex flex-wrap gap-1 justify-end">
                                    <OAPolicyBadge journal={journal} size="sm" />
                                    {journal.isMedlineIndexed && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold whitespace-nowrap">
                                        MEDLINE
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3-stat row */}
                                <div className="grid grid-cols-3 gap-2">
                                  {[
                                    {
                                      Icon: TrendingUp,
                                      val: journal.impactFactor?.toFixed(1) ?? 'N/A',
                                      label: 'Impact Factor',
                                    },
                                    {
                                      Icon: Users,
                                      val:
                                        journal.acceptanceRate != null
                                          ? `${journal.acceptanceRate}%`
                                          : 'N/A',
                                      label: 'Acceptance',
                                    },
                                    {
                                      Icon: Clock,
                                      val:
                                        journal.avgDecisionDays != null
                                          ? `${journal.avgDecisionDays}d`
                                          : 'N/A',
                                      label: 'Decision',
                                    },
                                  ].map(({ Icon, val, label }) => (
                                    <div
                                      key={label}
                                      className="text-center p-2 rounded-lg bg-muted/40"
                                    >
                                      <Icon
                                        size={11}
                                        className="mx-auto text-muted-foreground mb-0.5"
                                      />
                                      <p className="text-xs font-semibold text-foreground">
                                        {val}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">{label}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Match progress */}
                            <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${bg} rounded-full`}
                                style={{ width: `${likelihood.overall}%` }}
                              />
                            </div>
                          </motion.button>
                        );
                      })}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <JournalDetailDrawer
        journal={selectedJournal}
        onClose={() => setSelectedJournal(null)}
      />

      <Footer />
    </div>
  );
}
