interface Props {
  label: string;
  value: string;
  color?: 'green' | 'blue' | 'purple' | 'red' | 'amber' | 'indigo';
  subtitle?: string;
}

const colorMap = {
  green:  'border-green-500/30 text-green-400',
  blue:   'border-blue-500/30 text-blue-400',
  purple: 'border-purple-500/30 text-purple-400',
  red:    'border-red-500/30 text-red-400',
  amber:  'border-amber-500/30 text-amber-400',
  indigo: 'border-indigo-500/30 text-indigo-400',
};

export default function StatCard({ label, value, color = 'blue', subtitle }: Props) {
  return (
    <div className={`glass-card rounded-xl p-4 ${colorMap[color]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
      {subtitle && <div className="mt-0.5 text-xs text-faint">{subtitle}</div>}
    </div>
  );
}
