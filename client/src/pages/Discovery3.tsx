/**
 * Discovery 3 — Tiered Match Board
 * Journals sorted by acceptance likelihood and split into 3 tier columns:
 * Strong Match (75+), Good Match (50–74), Others (<50).
 * Compact magazine-style cards. Clicking opens the full detail drawer.
 */
import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import JournalDetailDrawer from '@/components/discovery/JournalDetailDrawer';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import { useJournals } from '@/contexts/JournalsContext';
import { useManuscript } from '@/contexts/ManuscriptContext';
import {
  calculateAcceptanceLikelihood,
  extractManuscriptKeywordsWeighted,
  countWordsFromHtml,
} from '@/lib/acceptance-score';
import type { Journal } from '@/types';
import type { ManuscriptProfile } from '@/lib/acceptance-score';
import { Search, Sparkles, X, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

const TIERS = [
  {
    key: 'strong',
    label: 'Strong Match',
    sublabel: 'Score 75+',
    min: 75,
    max: 101,
    headerBg: 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5',
    headerBorder: 'border-emerald-500/25',
    pillBg: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500',
    scoreBg: 'bg-emerald-600',
  },
  {
    key: 'good',
    label: 'Good Match',
    sublabel: 'Score 50–74',
    min: 50,
    max: 75,
    headerBg: 'bg-gradient-to-r from-journi-green/15 to-journi-green/5',
    headerBorder: 'border-journi-green/25',
    pillBg: 'bg-journi-green text-journi-slate',
    dot: 'bg-journi-green',
    scoreBg: 'bg-journi-green',
  },
  {
    key: 'other',
    label: 'Others',
    sublabel: 'Score < 50',
    min: 0,
    max: 50,
    headerBg: 'bg-gradient-to-r from-muted/50 to-muted/20',
    headerBorder: 'border-border',
    pillBg: 'bg-muted-foreground text-white',
    dot: 'bg-muted-foreground',
    scoreBg: 'bg-muted-foreground',
  },
] as const;

const CARDS_PER_TIER = 5;

export default function Discovery3() {
  const {
    paginatedJournals,
    searchQuery,
    totalResults,
    setSearchQuery,
    setFilters,
    filters,
    isLoading,
  } = useJournals();

  const { manuscript } = useManuscript();
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [autoMatchMode, setAutoMatchMode] = useState(true);
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});

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
    return paginatedJournals
      .map((journal) => ({
        journal,
        likelihood: calculateAcceptanceLikelihood(journal, manuscriptProfile),
      }))
      .sort((a, b) => b.likelihood.overall - a.likelihood.overall);
  }, [paginatedJournals, manuscriptProfile]);

  const tieredData = useMemo(() => {
    return TIERS.map((tier) => ({
      ...tier,
      journals: scoredJournals.filter(
        ({ likelihood }) =>
          likelihood.overall >= tier.min && likelihood.overall < tier.max
      ),
    }));
  }, [scoredJournals]);

  const toggleTierExpand = (key: string) => {
    setExpandedTiers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleOA = () => {
    if (filters.openAccess === true) {
      const { openAccess: _, ...rest } = filters;
      setFilters(rest);
    } else {
      setFilters({ ...filters, openAccess: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ── Sticky toolbar (fixed height — no conditional content inside) ── */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container py-3 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search journals..."
              className="w-full pl-8 pr-8 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-journi-green"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* OA pill */}
          <button
            onClick={toggleOA}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              filters.openAccess
                ? 'bg-journi-green text-journi-slate border-journi-green'
                : 'bg-card border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            OA Only
          </button>

          {/* Match toggle */}
          <button
            onClick={() => setAutoMatchMode(!autoMatchMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              autoMatchMode
                ? 'bg-journi-green text-journi-slate'
                : 'bg-journi-green/10 text-journi-green border border-journi-green/30 hover:bg-journi-green/20'
            }`}
          >
            <Sparkles size={13} />
            {autoMatchMode ? 'Matched to My Paper' : 'Match My Paper'}
          </button>

          <p className="text-xs text-muted-foreground ml-auto hidden sm:block">
            {totalResults.toLocaleString()} journals
          </p>
        </div>
      </div>

      {/* Context banner — normal flow so it scrolls away cleanly */}
      {autoMatchMode && (
        <div className="bg-journi-green/5 border-b border-journi-green/15">
          <p className="container text-xs text-muted-foreground py-1.5 flex items-center gap-1.5">
            <Sparkles size={10} className="text-journi-green" />
            Tiered by acceptance likelihood for{' '}
            <span className="font-medium text-foreground">
              {manuscript.title || 'your manuscript'}
            </span>
          </p>
        </div>
      )}

      {/* ── Sticky tier header row (desktop) — transparent outer, each box stands alone ── */}
      {!isLoading && (
        <div className="hidden md:block sticky top-[7.75rem] z-20">
          <div className="container pt-4 pb-2">
            <div className="grid grid-cols-3 gap-5">
              {tieredData.map((tier) => (
                <div
                  key={tier.key}
                  className={`rounded-xl border px-4 py-3 bg-background ${tier.headerBg} ${tier.headerBorder}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{tier.label}</p>
                      <p className="text-xs text-muted-foreground">{tier.sublabel}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tier.pillBg}`}>
                      {tier.journals.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Board (cards only — no headers on desktop) ── */}
      <div className="flex-1 container pt-10 pb-6">
        {isLoading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-journi-green/20 border-t-journi-green animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading journals...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {tieredData.map((tier) => {
              const isExpanded = expandedTiers[tier.key] ?? false;
              const visible = isExpanded
                ? tier.journals
                : tier.journals.slice(0, CARDS_PER_TIER);
              const hidden = tier.journals.length - CARDS_PER_TIER;

              return (
                <div key={tier.key} className="flex flex-col gap-3">
                  {/* Mobile only: inline tier header */}
                  <div
                    className={`md:hidden rounded-xl border px-4 py-3 ${tier.headerBg} ${tier.headerBorder}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{tier.label}</p>
                        <p className="text-xs text-muted-foreground">{tier.sublabel}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tier.pillBg}`}>
                        {tier.journals.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5">
                    {visible.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center">
                        <p className="text-xs text-muted-foreground">No journals in this tier</p>
                      </div>
                    ) : (
                      visible.map(({ journal, likelihood }, i) => (
                        <motion.button
                          key={journal.id}
                          onClick={() => setSelectedJournal(journal)}
                          className="w-full text-left bg-card border border-border rounded-xl overflow-hidden hover:border-journi-green/40 hover:shadow-md hover:shadow-journi-green/5 transition-all duration-200 group"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.035 }}
                        >
                          <div className={`h-1.5 w-full bg-gradient-to-r ${journal.coverColor}`} />

                          <div className="p-3.5">
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div
                                className={`w-9 h-11 rounded-lg bg-gradient-to-br ${journal.coverColor} flex items-center justify-center shrink-0 shadow-sm`}
                              >
                                <span className="text-white text-[9px] font-bold">
                                  {journal.coverInitial}
                                </span>
                              </div>
                              <div
                                className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${tier.scoreBg} text-white`}
                              >
                                {likelihood.overall}
                              </div>
                            </div>

                            <p className="text-xs font-semibold text-foreground group-hover:text-journi-green transition-colors leading-snug line-clamp-2">
                              {journal.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {journal.publisher}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <TrendingUp size={10} />
                                IF {journal.impactFactor?.toFixed(1) ?? 'N/A'}
                              </div>
                              <div className="flex items-center gap-1">
                                <OAPolicyBadge journal={journal} size="sm" />
                                {journal.isMedlineIndexed && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                                    M
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2.5 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${tier.scoreBg} rounded-full`}
                                style={{ width: `${likelihood.overall}%` }}
                              />
                            </div>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>

                  {/* Expand / collapse */}
                  {tier.journals.length > CARDS_PER_TIER && (
                    <button
                      onClick={() => toggleTierExpand(tier.key)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={13} /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={13} /> {hidden} more in this tier
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JournalDetailDrawer
        journal={selectedJournal}
        onClose={() => setSelectedJournal(null)}
      />

      <Footer />
    </div>
  );
}
