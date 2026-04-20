import type { Journal } from '../../types';

interface Props {
  journal: Journal;
  size?: 'card' | 'detail';
}

export function JournalMetricBadge({ journal, size = 'card' }: Props) {
  const { impactFactor, citeScore, sjrScore, sjrQuartile } = journal;

  if (size === 'detail') {
    const metrics: { label: string; value: number }[] = [];
    if (impactFactor != null) metrics.push({ label: 'IF', value: impactFactor });
    if (citeScore != null) metrics.push({ label: 'CiteScore', value: citeScore });
    if (sjrScore != null) metrics.push({ label: 'SJR', value: sjrScore });

    if (metrics.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        {metrics.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold">{value.toFixed(2)}</span>
            <span className="text-[9px] uppercase text-muted-foreground">{label}</span>
            {label === 'SJR' && sjrQuartile != null && (
              <span className="text-[9px] text-muted-foreground">({sjrQuartile})</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // card: show best available metric only
  if (impactFactor != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{impactFactor.toFixed(2)}</span>
        <span className="text-[9px] uppercase">IF</span>
      </div>
    );
  }

  if (citeScore != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{citeScore.toFixed(2)}</span>
        <span className="text-[9px] uppercase">CiteScore</span>
      </div>
    );
  }

  if (sjrScore != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{sjrScore.toFixed(2)}</span>
        <span className="text-[9px] uppercase">SJR</span>
      </div>
    );
  }

  return (
    <span className="text-sm text-muted-foreground shrink-0">Unavailable</span>
  );
}
