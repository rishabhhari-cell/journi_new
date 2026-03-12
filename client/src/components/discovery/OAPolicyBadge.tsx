/**
 * OA Policy Badge
 * Displays a journal's open access and DOAJ status as color-coded badges.
 * Uses data from OpenAlex (is_in_doaj, is_oa) and DOAJ (doajSeal).
 */
import type { Journal } from '@/types';

interface OAPolicyBadgeProps {
  journal: Journal;
  size?: 'sm' | 'md';
}

export default function OAPolicyBadge({ journal, size = 'sm' }: OAPolicyBadgeProps) {
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const px = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  const badges: React.ReactNode[] = [];

  // DOAJ Seal — highest quality signal
  if (journal.doajSeal) {
    badges.push(
      <span
        key="doaj-seal"
        title="DOAJ Seal: This journal meets the highest standards for open access publishing"
        className={`inline-flex items-center gap-1 ${px} rounded-full font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 ${textSize}`}
      >
        <span>⭐</span> DOAJ Seal
      </span>,
    );
  } else if (journal.isDoajListed) {
    // Listed in DOAJ but no Seal
    badges.push(
      <span
        key="doaj"
        title="Listed in the Directory of Open Access Journals"
        className={`inline-flex items-center gap-1 ${px} rounded-full font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 ${textSize}`}
      >
        DOAJ
      </span>,
    );
  }

  // Open Access indicator (from OpenAlex)
  if (journal.openAccess === true && !journal.isDoajListed) {
    badges.push(
      <span
        key="oa"
        title="Open Access journal"
        className={`inline-flex items-center ${px} rounded-full font-semibold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30 ${textSize}`}
      >
        OA
      </span>,
    );
  }

  // APC cost indicator
  if (typeof journal.apcCostUsd === 'number' && journal.apcCostUsd > 0) {
    const isHighApc = journal.apcCostUsd > 3000;
    badges.push(
      <span
        key="apc"
        title={`Article Processing Charge: $${journal.apcCostUsd.toLocaleString()} USD`}
        className={`inline-flex items-center ${px} rounded-full font-semibold border ${textSize} ${
          isHighApc
            ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
        }`}
      >
        APC ${journal.apcCostUsd >= 1000
          ? `${(journal.apcCostUsd / 1000).toFixed(1)}k`
          : journal.apcCostUsd}
      </span>,
    );
  } else if (journal.openAccess === true && journal.apcCostUsd === 0) {
    badges.push(
      <span
        key="free"
        title="No article processing charge"
        className={`inline-flex items-center ${px} rounded-full font-semibold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 ${textSize}`}
      >
        No APC
      </span>,
    );
  }

  if (badges.length === 0) return null;

  return <div className="flex flex-wrap items-center gap-1">{badges}</div>;
}
