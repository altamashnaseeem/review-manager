export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-accent-soft',   icon: 'text-accent',   value: 'text-accent' },
    red:    { bg: 'bg-negative-soft',    icon: 'text-negative',    value: 'text-negative' },
    green:  { bg: 'bg-positive-soft',  icon: 'text-positive',  value: 'text-positive' },
    yellow: { bg: 'bg-caution-soft', icon: 'text-caution', value: 'text-caution' },
    purple: { bg: 'bg-accent-soft', icon: 'text-accent', value: 'text-accent' },
  };
  const c = colors[color];

  return (
    <div className="card min-w-0 p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-positive-soft text-positive' : 'bg-negative-soft text-negative'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-3xl sm:text-[42px] leading-tight tracking-[-0.05em] font-normal text-ink mb-2">{value}</div>
      <div className="text-sm font-medium text-secondary">{title}</div>
      {subtitle && <div className="text-xs text-muted mt-0.5">{subtitle}</div>}
    </div>
  );
}
