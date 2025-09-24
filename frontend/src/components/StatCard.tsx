interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: 'primary' | 'success' | 'warning';
}

const toneStyles: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-accent/10 text-emerald-600',
  warning: 'bg-amber-100 text-amber-700',
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, tone = 'primary' }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-2 text-sm font-medium text-slate-500">{title}</div>
    <div className={`inline-flex rounded-md px-3 py-1 text-lg font-semibold ${toneStyles[tone]}`}>{value}</div>
    {subtitle ? <div className="mt-2 text-xs text-slate-400">{subtitle}</div> : null}
  </div>
);
