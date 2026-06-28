export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   value: 'text-blue-600' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    value: 'text-red-500' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  value: 'text-green-600' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', value: 'text-yellow-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-600' },
  };
  const c = colors[color];

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold ${c.value} mb-1`}>{value}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}
