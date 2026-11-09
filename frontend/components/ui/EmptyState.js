export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-raised rounded-2xl flex items-center justify-center mb-4">
        {Icon && <Icon size={28} className="text-muted" />}
      </div>
      <h3 className="text-ink font-semibold mb-1">{title}</h3>
      <p className="text-muted text-sm mb-5 max-w-xs">{description}</p>
      {action}
    </div>
  );
}
