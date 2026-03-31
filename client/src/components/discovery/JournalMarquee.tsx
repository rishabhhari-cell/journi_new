/**
 * JournalMarquee
 * variant="hero"    → static scattered journal covers, randomly placed, non-overlapping
 * variant="default" → scrolling compact pill cards (light background)
 */
import { useMemo, useEffect, useRef, useState } from 'react';
import type { Journal } from '@/types';

const GRADIENTS = [
  'from-blue-900 to-blue-700',
  'from-emerald-900 to-emerald-700',
  'from-purple-900 to-purple-700',
  'from-rose-900 to-rose-700',
  'from-amber-900 to-amber-700',
  'from-teal-900 to-teal-700',
  'from-indigo-900 to-indigo-700',
  'from-pink-900 to-pink-700',
  'from-cyan-900 to-cyan-700',
  'from-orange-900 to-orange-700',
  'from-violet-900 to-violet-700',
  'from-sky-900 to-sky-700',
];

const SPRINGER_COVERS: Record<string, string> = {
  '1078-8956': 'https://media.springernature.com/full/springer-static/cover/journal/41591.jpg',
  '1087-0156': 'https://media.springernature.com/full/springer-static/cover/journal/41587.jpg',
  '1061-4036': 'https://media.springernature.com/full/springer-static/cover/journal/41588.jpg',
  '1465-7392': 'https://media.springernature.com/full/springer-static/cover/journal/41556.jpg',
  '1548-7091': 'https://media.springernature.com/full/springer-static/cover/journal/41592.jpg',
  '2041-1723': 'https://media.springernature.com/full/springer-static/cover/journal/41467.jpg',
};

function getCoverUrl(journal: Journal): string | null {
  if (journal.issn && SPRINGER_COVERS[journal.issn]) return SPRINGER_COVERS[journal.issn];
  if (journal.issnOnline && SPRINGER_COVERS[journal.issnOnline]) return SPRINGER_COVERS[journal.issnOnline];
  if (journal.logoUrl) return journal.logoUrl;
  return null;
}

function getFaviconUrl(journal: Journal): string | null {
  const site = journal.website ?? (journal as any).websiteUrl;
  if (!site) return null;
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(site).hostname}&sz=128`;
  } catch { return null; }
}

function getInitials(name: string): string {
  return name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').substring(0, 3).toUpperCase();
}

// ─── Layout types ─────────────────────────────────────────────────────────────
interface CardLayout {
  journal: Journal;
  cx: number;       // center x in px
  cy: number;       // center y in px
  w: number;
  h: number;
  rotation: number; // degrees
  gradient: string;
  zIndex: number;
  objectPosition: 'top' | 'center' | 'bottom';
}

// ─── Collision detection (axis-aligned bounding boxes + padding) ───────────────
function overlaps(a: CardLayout, b: CardLayout, pad = 18): boolean {
  return !(
    a.cx + a.w / 2 + pad < b.cx - b.w / 2 ||
    a.cx - a.w / 2 - pad > b.cx + b.w / 2 ||
    a.cy + a.h / 2 + pad < b.cy - b.h / 2 ||
    a.cy - a.h / 2 - pad > b.cy + b.h / 2
  );
}

// ─── Greedy random non-overlapping placement ──────────────────────────────────
function computeLayout(
  containerW: number,
  containerH: number,
  journals: Journal[],
): CardLayout[] {
  // Card width ≈ 1/3.2 of container → 3-4 fit across
  const W = Math.round(containerW / 3.2);
  // Portrait ratio — taller than container so card always fills hero height
  const H = Math.round(W * 1.45);

  // Center-point ranges: allow cards to protrude slightly off-screen at edges
  const xMin = W * 0.05;
  const xMax = containerW - W * 0.05;
  const yMin = -H * 0.15;
  const yMax = containerH + H * 0.15;

  const placed: CardLayout[] = [];
  const MAX_ATTEMPTS = 400;

  const shuffled = [...journals].sort(() => Math.random() - 0.5);

  for (let idx = 0; idx < shuffled.length; idx++) {
    const journal = shuffled[idx];
    let found = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const cx = xMin + Math.random() * (xMax - xMin);
      const cy = yMin + Math.random() * (yMax - yMin);
      const rotation = (Math.random() - 0.5) * 14; // ±7 degrees

      const positions: CardLayout['objectPosition'][] = ['top', 'center', 'bottom'];
      const candidate: CardLayout = {
        journal,
        cx, cy, w: W, h: H,
        rotation,
        gradient: GRADIENTS[idx % GRADIENTS.length],
        zIndex: idx,
        objectPosition: positions[Math.floor(Math.random() * positions.length)],
      };

      if (!placed.some(p => overlaps(p, candidate))) {
        placed.push(candidate);
        found = true;
        break;
      }
    }

    // Once we can't fit any more cards, stop
    if (!found && placed.length >= 3) break;
  }

  return placed;
}

// ─── Single hero cover card ───────────────────────────────────────────────────
function HeroCoverCard({ layout }: { layout: CardLayout }) {
  const { journal, cx, cy, w, h, rotation, gradient, zIndex, objectPosition } = layout;
  const coverUrl   = getCoverUrl(journal);
  const faviconUrl = getFaviconUrl(journal);
  const impactFactor = typeof journal.impactFactor === 'number' ? journal.impactFactor.toFixed(1) : null;
  const subject = journal.subjectAreas?.[0] ?? '';

  return (
    <div
      className="absolute select-none rounded-lg overflow-hidden"
      style={{
        left: cx,
        top: cy,
        width: w,
        height: h,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        zIndex,
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {coverUrl ? (
        <div className="relative w-full h-full">
          <img
            src={coverUrl}
            alt={journal.name}
            className="w-full h-full object-cover"
            style={{ objectPosition }}
            crossOrigin="anonymous"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent flex items-end p-3">
            <p className="text-white text-xs font-bold leading-tight line-clamp-2">{journal.name}</p>
          </div>
        </div>
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col px-4 py-4`}>
          <div className="flex items-center gap-1 mb-3 shrink-0">
            <div className="h-px flex-1 bg-white/30" />
            {impactFactor && (
              <span className="text-white/60 text-[9px] font-bold uppercase tracking-widest px-1.5 shrink-0">IF {impactFactor}</span>
            )}
            <div className="h-px flex-1 bg-white/30" />
          </div>
          {faviconUrl && (
            <div className="flex justify-center mb-3 shrink-0">
              <img
                src={faviconUrl}
                alt=""
                aria-hidden="true"
                className="w-10 h-10 rounded-lg opacity-80"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <p className="text-white font-extrabold text-sm tracking-wide uppercase leading-snug flex-1 overflow-hidden">
            {journal.name}
          </p>
          <div className="mt-auto pt-3 border-t border-white/20 shrink-0">
            {subject && <p className="text-white/50 text-[9px] uppercase tracking-widest truncate">{subject}</p>}
            {journal.publisher && <p className="text-white/35 text-[9px] truncate mt-0.5">{journal.publisher}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Default compact card ─────────────────────────────────────────────────────
function DefaultCard({ journal, gradient }: { journal: Journal; gradient: string }) {
  const initials = journal.coverInitial || getInitials(journal.name);
  const impactFactor = typeof journal.impactFactor === 'number' ? journal.impactFactor.toFixed(1) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:shadow-md hover:border-journi-green/30 transition-all duration-200 cursor-default select-none shrink-0 group">
      <div className={`w-10 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-sm`}>
        <span className="text-white text-[10px] font-bold leading-none">{initials}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate max-w-[180px] group-hover:text-journi-green transition-colors">{journal.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {impactFactor && <span className="text-[10px] font-medium text-muted-foreground">IF {impactFactor}</span>}
          {journal.subjectAreas[0] && (
            <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-50 text-blue-600 truncate max-w-[120px]">{journal.subjectAreas[0]}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Default scrolling row ────────────────────────────────────────────────────
function DefaultRow({ journals, direction, speed, rowIndex }: { journals: Journal[]; direction: 'left' | 'right'; speed: number; rowIndex: number }) {
  const items = [...journals, ...journals];
  const animDir = direction === 'left' ? 'normal' : 'reverse';
  return (
    <div className="relative overflow-hidden py-2">
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-r from-white to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none bg-gradient-to-l from-white to-transparent" />
      <div
        className="flex w-max animate-marquee animate-marquee-pauseable gap-3"
        style={{ animationDuration: `${speed}s`, animationDirection: animDir, animationTimingFunction: 'linear', animationIterationCount: 'infinite' }}
      >
        {items.map((journal, i) => (
          <DefaultCard key={`${journal.id}-${i}`} journal={journal} gradient={GRADIENTS[(i + rowIndex * 7) % GRADIENTS.length]} />
        ))}
      </div>
    </div>
  );
}

// ─── Hero scatter container ───────────────────────────────────────────────────
function HeroScatter({ journals }: { journals: Journal[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<CardLayout[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const compute = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setCards(computeLayout(width, height, journals));
    };

    compute();

    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [journals]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {cards.map((layout, i) => (
        <HeroCoverCard key={`${layout.journal.id}-${i}`} layout={layout} />
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
interface JournalMarqueeProps {
  journals: Journal[];
  totalAvailable?: number;
  rows?: number;
  variant?: 'hero' | 'default';
}

export default function JournalMarquee({ journals, totalAvailable, rows = 4, variant = 'default' }: JournalMarqueeProps) {
  const effectiveRows = variant === 'hero' ? 1 : rows;

  const rowData = useMemo(() => {
    const result: Journal[][] = [];
    const perRow = Math.ceil(journals.length / effectiveRows);
    for (let r = 0; r < effectiveRows; r++) {
      const slice = journals.slice(r * perRow, r * perRow + perRow);
      while (slice.length < 20) slice.push(journals[slice.length % journals.length]);
      result.push(slice);
    }
    return result;
  }, [journals, effectiveRows]);

  if (variant === 'hero') {
    return <HeroScatter journals={journals} />;
  }

  const speeds = [80, 100, 90, 110];
  return (
    <div className="space-y-1">
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground">
          Explore{' '}
          <span className="font-semibold text-foreground">{(totalAvailable ?? journals.length).toLocaleString()}</span>
          {' '}indexed medical journals — search above to find yours
        </p>
      </div>
      {rowData.map((row, i) => (
        <DefaultRow key={i} journals={row} direction={i % 2 === 0 ? 'left' : 'right'} speed={speeds[i % speeds.length]} rowIndex={i} />
      ))}
    </div>
  );
}
