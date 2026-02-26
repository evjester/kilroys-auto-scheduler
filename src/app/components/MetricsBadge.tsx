interface Props {
  score: number;
  size?: 'sm' | 'md';
}

export default function MetricsBadge({ score, size = 'md' }: Props) {
  const color = score >= 80
    ? 'bg-green-500/20 text-green-400 ring-green-500/30'
    : score >= 60
    ? 'bg-blue-500/20 text-blue-400 ring-blue-500/30'
    : score >= 40
    ? 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30'
    : 'bg-overlay-hover text-muted ring-border-strong';

  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${color} ${sizeClass}`}>
      {score}
    </span>
  );
}
