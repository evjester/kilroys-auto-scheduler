import type { Assignment } from '@/lib/types';

interface Props {
  assignment: Assignment;
}

export default function ReasoningPanel({ assignment }: Props) {
  const { factors, summary, alternativesCount, runnerUp } = assignment;
  const sortedFactors = [...factors].sort((a, b) => b.weighted - a.weighted);

  return (
    <div className="mt-2 space-y-2 rounded-md bg-white/80 p-2.5 text-xs">
      <p className="text-gray-700 leading-relaxed">{summary}</p>

      <div className="space-y-1">
        {sortedFactors.map(f => (
          <div key={f.name} className="flex items-center gap-2">
            <div className="w-20 text-faint font-medium">{f.name}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${f.value}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-faint">
                  +{f.weighted.toFixed(1)}
                </span>
              </div>
              <div className="mt-0.5 text-muted">{f.explanation}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 pt-1.5 text-faint">
        <span>{alternativesCount} other candidate{alternativesCount !== 1 ? 's' : ''} considered</span>
        {runnerUp && (
          <span>Runner-up: {runnerUp.name} ({runnerUp.score.toFixed(1)})</span>
        )}
      </div>
    </div>
  );
}
