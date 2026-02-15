import type { AcceptanceLikelihood } from '@/types';

interface ScoreBreakdownProps {
  likelihood: AcceptanceLikelihood;
}

export default function ScoreBreakdown({ likelihood }: ScoreBreakdownProps) {
  const factors = [
    { label: 'Acceptance Rate', ...likelihood.breakdown.acceptanceRate, max: 30 },
    { label: 'Topic Relevance', ...likelihood.breakdown.topicRelevance, max: 30 },
    { label: 'Word Count', ...likelihood.breakdown.wordCountAlignment, max: 15 },
    { label: 'Open Access Fit', ...likelihood.breakdown.openAccessFit, max: 10 },
    { label: 'Competitiveness', ...likelihood.breakdown.competitiveness, max: 15 },
  ];

  return (
    <div className="space-y-2.5">
      {factors.map((factor) => {
        const pct = factor.max > 0 ? (factor.score / factor.max) * 100 : 0;
        return (
          <div key={factor.label}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">{factor.label}</span>
              <span className="font-medium text-foreground tabular-nums">
                {factor.score}/{factor.max}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-journi-green rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
              {factor.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
