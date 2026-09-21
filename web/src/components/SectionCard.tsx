interface Props {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'default' | 'alert';
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({ title, icon, right, tone = 'default', className = '', children }: Props) {
  return (
    <section className={`rounded-xl ${tone === 'alert' ? 'bg-red-50/60 ring-red-100' : 'bg-white ring-slate-200'} p-4 shadow-sm ring-1 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon && <span className="text-slate-400">{icon}</span>}
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}
