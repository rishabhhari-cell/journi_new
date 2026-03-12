/**
 * Discovery — Tiered Match Board
 * Unified discovery: inline filter bar, AI match toggle, and optional guided wizard.
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
import type { Journal, JournalFilters } from '@/types';
import type { ManuscriptProfile } from '@/lib/acceptance-score';
import { ALL_SUBJECT_AREAS } from '@/data/journals-database';
import {
  Search,
  Sparkles,
  X,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  FileText,
  ChevronRight,
  Check,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Tier config ──────────────────────────────────────────────────────────────

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
    scoreBg: 'bg-muted-foreground',
  },
] as const;

const CARDS_PER_TIER = 5;

type OAPreference = 'required' | 'preferred' | 'none';
type ActivePanel = 'oa' | 'specialty' | 'impact' | 'timeline' | null;

// ── FilterPill ───────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  open,
  onClick,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        active
          ? 'bg-journi-green/10 text-journi-green border-journi-green/30'
          : open
            ? 'bg-accent border-border text-foreground'
            : 'bg-card border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Discovery() {
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
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardOA, setWizardOA] = useState<OAPreference>('preferred');
  const [wizardMaxDays, setWizardMaxDays] = useState(300);

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

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const toggleSubjectArea = (area: string) => {
    const current = filters.subjectAreas || [];
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    setFilters({ ...filters, subjectAreas: updated });
  };

  const handleWizardRun = () => {
    const newFilters: JournalFilters = {};
    if (wizardOA === 'required') newFilters.openAccess = true;
    if (wizardMaxDays < 300) newFilters.timeToPublicationMax = wizardMaxDays;
    setFilters(newFilters);
    setSearchQuery('');
    setAutoMatchMode(true);
    setShowWizard(false);
  };

  const hasFilters =
    !!searchQuery ||
    filters.openAccess !== undefined ||
    filters.impactFactorMin !== undefined ||
    filters.timeToPublicationMax !== undefined ||
    (filters.subjectAreas && filters.subjectAreas.length > 0);

  const clearAll = () => {
    setFilters({});
    setSearchQuery('');
    setActivePanel(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        {/* Main row */}
        <div className="container py-3 flex items-center gap-2 flex-wrap">
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

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterPill
              label={
                filters.openAccess !== undefined
                  ? filters.openAccess
                    ? 'OA Only'
                    : 'Subs. Only'
                  : 'Open Access'
              }
              active={filters.openAccess !== undefined}
              open={activePanel === 'oa'}
              onClick={() => togglePanel('oa')}
            />
            <FilterPill
              label={`Specialty${(filters.subjectAreas?.length ?? 0) > 0 ? ` (${filters.subjectAreas!.length})` : ''}`}
              active={(filters.subjectAreas?.length ?? 0) > 0}
              open={activePanel === 'specialty'}
              onClick={() => togglePanel('specialty')}
            />
            <FilterPill
              label={
                filters.impactFactorMin !== undefined
                  ? `IF ≥ ${filters.impactFactorMin}`
                  : 'Impact Factor'
              }
              active={filters.impactFactorMin !== undefined}
              open={activePanel === 'impact'}
              onClick={() => togglePanel('impact')}
            />
            <FilterPill
              label={
                filters.timeToPublicationMax !== undefined
                  ? `≤ ${filters.timeToPublicationMax}d`
                  : 'Timeline'
              }
              active={filters.timeToPublicationMax !== undefined}
              open={activePanel === 'timeline'}
              onClick={() => togglePanel('timeline')}
            />
            {hasFilters && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setAutoMatchMode(!autoMatchMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                autoMatchMode
                  ? 'bg-journi-green text-journi-slate'
                  : 'bg-journi-green/10 text-journi-green border border-journi-green/30 hover:bg-journi-green/20'
              }`}
            >
              <Sparkles size={12} />
              {autoMatchMode ? 'Matched' : 'Match My Paper'}
            </button>
            <button
              onClick={() => setShowWizard(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <Wand2 size={12} />
              Wizard
            </button>
            <p className="text-xs text-muted-foreground hidden sm:block pl-1">
              {totalResults.toLocaleString()} journals
            </p>
          </div>
        </div>

        {/* Expandable filter panels */}
        <AnimatePresence>
          {activePanel && (
            <motion.div
              key={activePanel}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="container py-3">
                {/* Open Access */}
                {activePanel === 'oa' && (
                  <div className="flex gap-2 flex-wrap">
                    {(
                      [
                        { label: 'All Journals', val: undefined },
                        { label: 'OA Only', val: true },
                        { label: 'Subscription Only', val: false },
                      ] as const
                    ).map(({ label, val }) => (
                      <button
                        key={label}
                        onClick={() => {
                          if (val === undefined) {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { openAccess: _oa, ...rest } = filters;
                            setFilters(rest);
                          } else {
                            setFilters({ ...filters, openAccess: val });
                          }
                          setActivePanel(null);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors border ${
                          filters.openAccess === val
                            ? 'bg-journi-green text-journi-slate border-journi-green'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Specialty */}
                {activePanel === 'specialty' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {ALL_SUBJECT_AREAS.slice(0, 30).map((area) => {
                      const selected = filters.subjectAreas?.includes(area) || false;
                      return (
                        <button
                          key={area}
                          onClick={() => toggleSubjectArea(area)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors border ${
                            selected
                              ? 'bg-journi-green/10 text-journi-green font-medium border-journi-green/30'
                              : 'bg-muted text-foreground hover:bg-accent border-transparent'
                          }`}
                        >
                          {selected && <Check size={10} className="shrink-0" />}
                          {area}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Impact Factor */}
                {activePanel === 'impact' && (
                  <div className="flex items-center gap-4 max-w-xs">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Min IF:</span>
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
                    <span className="text-xs font-semibold text-journi-green w-8 text-right">
                      {filters.impactFactorMin ?? 0}
                    </span>
                  </div>
                )}

                {/* Timeline */}
                {activePanel === 'timeline' && (
                  <div className="flex items-center gap-4 max-w-xs">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Max days:</span>
                    <input
                      type="range"
                      min="30"
                      max="300"
                      step="10"
                      value={filters.timeToPublicationMax ?? 300}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFilters({
                          ...filters,
                          timeToPublicationMax: val < 300 ? val : undefined,
                        });
                      }}
                      className="w-full accent-journi-green"
                    />
                    <span className="text-xs font-semibold text-journi-green w-16 text-right">
                      {filters.timeToPublicationMax
                        ? `${filters.timeToPublicationMax}d`
                        : 'Any'}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context banner — normal flow so it scrolls away */}
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

      {/* ── Sticky tier header row (desktop) ── */}
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

      {/* ── Board ── */}
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
                  {/* Mobile-only inline tier header */}
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

      {/* ── Wizard Modal ── */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-20 pb-8 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowWizard(false);
            }}
          >
            <motion.div
              className="w-full max-w-lg mx-4"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-journi-green/10 text-journi-green text-xs font-semibold mb-4">
                  <Sparkles size={12} /> Guided Matching Wizard
                </span>
                <h1 className="text-2xl font-extrabold text-foreground mb-1">
                  Find Your Perfect Journal
                </h1>
                <p className="text-sm text-muted-foreground">
                  Three questions. Ranked results. No guesswork.
                </p>
              </div>

              {/* Step 1 — Research topic */}
              <div className="bg-card border border-border rounded-2xl p-5 mb-3 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    What is your manuscript about?
                  </h3>
                </div>
                {topKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {topKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 rounded-full bg-journi-green/10 text-journi-green text-xs font-medium border border-journi-green/20"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No manuscript loaded.{' '}
                    <a href="/collaboration" className="text-journi-green hover:underline">
                      Go to Collaboration
                    </a>{' '}
                    to start writing.
                  </p>
                )}
                {manuscript.title && (
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText size={11} />
                    {manuscript.title}
                  </p>
                )}
              </div>

              {/* Step 2 — OA preference */}
              <div className="bg-card border border-border rounded-2xl p-5 mb-3 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Open Access preference?</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { val: 'required', label: 'Required', desc: 'OA journals only' },
                      { val: 'preferred', label: 'Preferred', desc: 'Favour OA, show all' },
                      { val: 'none', label: 'No Preference', desc: 'Any journal type' },
                    ] as const
                  ).map(({ val, label, desc }) => (
                    <button
                      key={val}
                      onClick={() => setWizardOA(val)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        wizardOA === val
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
              <div className="bg-card border border-border rounded-2xl p-5 mb-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 rounded-full bg-journi-green/15 text-journi-green text-xs font-bold flex items-center justify-center shrink-0">
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
                  value={wizardMaxDays}
                  onChange={(e) => setWizardMaxDays(parseInt(e.target.value))}
                  className="w-full accent-journi-green"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">30 days</span>
                  <span className="text-sm font-semibold text-journi-green">
                    {wizardMaxDays >= 300 ? 'Any timeline' : `Up to ${wizardMaxDays} days`}
                  </span>
                  <span className="text-xs text-muted-foreground">No limit</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={handleWizardRun}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-journi-green text-journi-slate font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-journi-green/25"
              >
                <Sparkles size={16} />
                Find My Journals
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setShowWizard(false)}
                className="w-full mt-2.5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <JournalDetailDrawer
        journal={selectedJournal}
        onClose={() => setSelectedJournal(null)}
      />

      <Footer />
    </div>
  );
}
