/**
 * Journal Detail Drawer
 * Slide-out panel showing the full enriched profile for a selected journal.
 * Lazily fetches Crossref journal metadata on open.
 */
import { useEffect, useState } from 'react';
import { X, ExternalLink, BookOpen, TrendingUp, Clock, Users, Globe, Award, FileText, List, Quote, Image } from 'lucide-react';
import type { Journal } from '@/types';
import OAPolicyBadge from '@/components/discovery/OAPolicyBadge';
import { fetchJournalGuidelines, type JournalGuidelinesDTO } from '@/lib/api/backend';

interface JournalDetailDrawerProps {
  journal: Journal | null;
  onClose: () => void;
}

interface CrossrefJournalMeta {
  publisher: string;
  depositsOrcid: boolean;
  depositsReferences: boolean;
  totalDois: number;
}

async function fetchCrossrefMeta(issn: string): Promise<CrossrefJournalMeta | null> {
  try {
    const response = await fetch(
      `https://api.crossref.org/journals/${encodeURIComponent(issn)}?mailto=journi@journi.app`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const msg = data.message;
    return {
      publisher: msg.publisher ?? '',
      depositsOrcid: msg.flags?.['deposits-articles-with-orcids-current'] ?? false,
      depositsReferences: msg.flags?.['deposits-references-current'] ?? false,
      totalDois: msg.counts?.['total-dois'] ?? 0,
    };
  } catch {
    return null;
  }
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number | null | undefined;
  icon: React.ElementType;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
      <div className="w-8 h-8 rounded-lg bg-journi-green/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-journi-green" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function JournalDetailDrawer({ journal, onClose }: JournalDetailDrawerProps) {
  const [crossrefMeta, setCrossrefMeta] = useState<CrossrefJournalMeta | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [guidelines, setGuidelines] = useState<JournalGuidelinesDTO | null>(null);

  useEffect(() => {
    if (!journal) {
      setCrossrefMeta(null);
      setGuidelines(null);
      return;
    }
    const issn = journal.issn ?? journal.issnOnline;
    if (issn) {
      setIsLoadingMeta(true);
      fetchCrossrefMeta(issn)
        .then(setCrossrefMeta)
        .finally(() => setIsLoadingMeta(false));
    }

    // Fetch structured guidelines from backend (silently ignore if not available)
    fetchJournalGuidelines(journal.id)
      .then((res) => setGuidelines(res.data ?? null))
      .catch(() => setGuidelines(null));
  }, [journal?.id]);

  if (!journal) return null;

  const hasOrcidSupport = crossrefMeta?.depositsOrcid;
  const hasReferenceSupport = crossrefMeta?.depositsReferences;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-br ${journal.coverColor} p-6 text-white shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold mb-3">
                {journal.coverInitial}
              </div>
              <h2 className="font-bold text-base leading-snug">{journal.name}</h2>
              {journal.abbreviation && (
                <p className="text-xs text-white/70 mt-1">{journal.abbreviation}</p>
              )}
              {journal.publisher && (
                <p className="text-xs text-white/80 mt-1">{journal.publisher}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick badges */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {journal.isMedlineIndexed && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-semibold">
                MEDLINE
              </span>
            )}
            {journal.issn && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px]">
                ISSN {journal.issn}
              </span>
            )}
            {journal.geographicLocation && journal.geographicLocation !== 'Unknown' && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[10px]">
                {journal.geographicLocation}
              </span>
            )}
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* OA Policy */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Open Access
            </p>
            <OAPolicyBadge journal={journal} size="md" />
            {journal.openAccess === false && (
              <p className="text-xs text-muted-foreground mt-2">Subscription-based journal</p>
            )}
            {journal.openAccess === null && (
              <p className="text-xs text-muted-foreground mt-2">OA status unknown</p>
            )}
          </div>

          {/* Key Stats */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Key Metrics
            </p>
            <div className="grid grid-cols-1 gap-2">
              <Stat
                label="Impact Factor (2yr)"
                value={journal.impactFactor != null ? journal.impactFactor.toFixed(2) : null}
                icon={TrendingUp}
              />
              <Stat
                label="Acceptance Rate"
                value={journal.acceptanceRate != null ? `${journal.acceptanceRate}%` : null}
                icon={Users}
              />
              <Stat
                label="Avg. Decision Time"
                value={journal.avgDecisionDays != null ? `${journal.avgDecisionDays} days` : null}
                icon={Clock}
              />
              <Stat
                label="Total Citations"
                value={
                  journal.citationsCount != null
                    ? journal.citationsCount.toLocaleString()
                    : null
                }
                icon={BookOpen}
              />
              <Stat
                label="Total Works"
                value={
                  journal.worksCount != null ? journal.worksCount.toLocaleString() : null
                }
                icon={BookOpen}
              />
              {crossrefMeta && crossrefMeta.totalDois > 0 && (
                <Stat
                  label="DOIs Registered"
                  value={crossrefMeta.totalDois.toLocaleString()}
                  icon={BookOpen}
                />
              )}
            </div>
          </div>

          {/* Subject Areas */}
          {journal.subjectAreas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Subject Areas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {journal.subjectAreas.slice(0, 12).map((area) => (
                  <span
                    key={area}
                    className="px-2 py-0.5 rounded-full bg-accent text-foreground text-[11px]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Infrastructure (from Crossref) */}
          {!isLoadingMeta && crossrefMeta && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Infrastructure
              </p>
              <div className="space-y-1.5">
                {hasOrcidSupport && (
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <span className="w-2 h-2 rounded-full bg-journi-green shrink-0" />
                    Deposits ORCID identifiers with Crossref
                  </div>
                )}
                {hasReferenceSupport && (
                  <div className="flex items-center gap-2 text-xs text-foreground">
                    <span className="w-2 h-2 rounded-full bg-journi-green shrink-0" />
                    Deposits reference lists with Crossref
                  </div>
                )}
                {!hasOrcidSupport && !hasReferenceSupport && (
                  <p className="text-xs text-muted-foreground">
                    No ORCID or reference deposit data available
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Formatting Requirements */}
          {journal.formattingRequirements && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Formatting
              </p>
              <div className="space-y-1.5 text-xs text-foreground">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Reference style</span>
                  <span className="font-medium uppercase">
                    {journal.formattingRequirements.referenceStyle}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Abstract</span>
                  <span className="font-medium capitalize">
                    {journal.formattingRequirements.abstractStructure}
                  </span>
                </div>
                {journal.formattingRequirements.wordLimits?.total && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="text-muted-foreground">Word limit</span>
                    <span className="font-medium">
                      {journal.formattingRequirements.wordLimits.total.toLocaleString()}
                    </span>
                  </div>
                )}
                {journal.formattingRequirements.requiresCoverLetter && (
                  <div className="flex items-center gap-2 py-1.5">
                    <span className="w-2 h-2 rounded-full bg-journi-green shrink-0" />
                    Cover letter required
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Structured submission guidelines from backend */}
          {guidelines && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Submission Guidelines
              </p>
              <div className="space-y-1.5 text-xs text-foreground">
                {guidelines.citationStyle && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Quote size={11} />Citation style</span>
                    <span className="font-medium">{guidelines.citationStyle}</span>
                  </div>
                )}
                {guidelines.wordLimits?.total && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><FileText size={11} />Total word limit</span>
                    <span className="font-medium">{guidelines.wordLimits.total.toLocaleString()}</span>
                  </div>
                )}
                {guidelines.wordLimits?.main_text && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><FileText size={11} />Main text limit</span>
                    <span className="font-medium">{guidelines.wordLimits.main_text.toLocaleString()}</span>
                  </div>
                )}
                {guidelines.wordLimits?.abstract && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><FileText size={11} />Abstract limit</span>
                    <span className="font-medium">{guidelines.wordLimits.abstract.toLocaleString()}</span>
                  </div>
                )}
                {guidelines.figuresMax != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Image size={11} />Max figures</span>
                    <span className="font-medium">{guidelines.figuresMax}</span>
                  </div>
                )}
                {guidelines.tablesMax != null && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><List size={11} />Max tables</span>
                    <span className="font-medium">{guidelines.tablesMax}</span>
                  </div>
                )}
                {guidelines.structuredAbstract != null && (
                  <div className="flex items-center gap-2 py-1.5 border-b border-border">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${guidelines.structuredAbstract ? 'bg-journi-green' : 'bg-muted-foreground'}`} />
                    <span className="text-muted-foreground">{guidelines.structuredAbstract ? 'Structured abstract required' : 'Unstructured abstract accepted'}</span>
                  </div>
                )}
                {guidelines.sectionsRequired && guidelines.sectionsRequired.length > 0 && (
                  <div className="pt-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Required sections</p>
                    <div className="flex flex-wrap gap-1">
                      {guidelines.sectionsRequired.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full bg-accent text-foreground text-[10px]">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {guidelines.notes && (
                  <p className="pt-1.5 text-[11px] text-muted-foreground italic leading-relaxed">{guidelines.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* External Links */}
          <div className="flex flex-col gap-2 pt-1">
            {journal.website && (
              <a
                href={journal.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-journi-green text-journi-slate rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <Globe size={15} />
                Visit Journal Website
              </a>
            )}
            {journal.submissionPortalUrl && (
              <a
                href={journal.submissionPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink size={14} />
                Open Submission Portal
              </a>
            )}
            {journal.openAlexId && (
              <a
                href={journal.openAlexId}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink size={14} />
                View on OpenAlex
              </a>
            )}
            {journal.doajId && (
              <a
                href={`https://doaj.org/toc/${journal.doajId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Award size={14} />
                View on DOAJ
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
