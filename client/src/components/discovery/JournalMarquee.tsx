/**
 * JournalMarquee — infinite rolling showcase of all journals
 * Displays multiple rows of journal cards scrolling in alternating directions
 * with a CSS-only infinite marquee animation (no JS timers).
 */
import { useMemo } from 'react';
import type { Journal } from '@/types';

const GRADIENTS = [
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();
}

interface JournalMarqueeProps {
  journals: Journal[];
  totalAvailable?: number;
  rows?: number;
}

function MarqueeRow({
  journals,
  direction,
  speed,
  rowIndex,
}: {
  journals: Journal[];
  direction: 'left' | 'right';
  speed: number;
  rowIndex: number;
}) {
  // Duplicate the array to create seamless loop
  const items = [...journals, ...journals];
  const animationDirection = direction === 'left' ? 'normal' : 'reverse';

  return (
    <div className="relative overflow-hidden py-2">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-white to-transparent pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />

      <div
        className="flex gap-3 w-max animate-marquee"
        style={{
          animationDuration: `${speed}s`,
          animationDirection,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}
      >
        {items.map((journal, i) => {
          const gradient = GRADIENTS[(i + rowIndex * 7) % GRADIENTS.length];
          const initials = journal.coverInitial || getInitials(journal.name);
          const impactFactor =
            typeof journal.impactFactor === 'number'
              ? journal.impactFactor.toFixed(1)
              : null;

          return (
            <div
              key={`${journal.id}-${i}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:shadow-md hover:border-journi-green/30 transition-all duration-200 cursor-default select-none shrink-0 group"
            >
              <div
                className={`w-10 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}
              >
                <span className="text-white text-[10px] font-bold leading-none">
                  {initials}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate max-w-[180px] group-hover:text-journi-green transition-colors">
                  {journal.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {impactFactor && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      IF {impactFactor}
                    </span>
                  )}
                  {journal.subjectAreas[0] && (
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-50 text-blue-600 truncate max-w-[120px]">
                      {journal.subjectAreas[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalMarquee({ journals, totalAvailable, rows = 4 }: JournalMarqueeProps) {
  // Split journals into rows with different orderings for visual variety
  const rowData = useMemo(() => {
    const shuffled = [...journals];
    const result: Journal[][] = [];
    const perRow = Math.ceil(shuffled.length / rows);

    for (let r = 0; r < rows; r++) {
      // Offset each row so they show different journals side by side
      const start = r * perRow;
      const rowJournals = shuffled.slice(start, start + perRow);
      // If the row is too short, wrap around
      while (rowJournals.length < Math.min(12, journals.length)) {
        rowJournals.push(shuffled[rowJournals.length % shuffled.length]);
      }
      result.push(rowJournals);
    }
    return result;
  }, [journals, rows]);

  // Vary speed per row for a more organic feel
  const speeds = [80, 100, 90, 110];

  return (
    <div className="space-y-1">
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">
          Explore{' '}
          <span className="font-semibold text-foreground">
            {(totalAvailable ?? journals.length).toLocaleString()}
          </span>{' '}
          indexed medical journals — search above to find yours
        </p>
      </div>
      {rowData.map((row, i) => (
        <MarqueeRow
          key={i}
          journals={row}
          direction={i % 2 === 0 ? 'left' : 'right'}
          speed={speeds[i % speeds.length]}
          rowIndex={i}
        />
      ))}
    </div>
  );
}
