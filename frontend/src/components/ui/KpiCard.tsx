import { memo, useMemo } from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  sparklineData?: number[];
  loading?: boolean;
}

const Sparkline = memo(({ data }: { data: number[] }) => {
  const points = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data
      .map((value, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * 100;
        const y = 100 - ((value - min) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data]);

  return (
    <svg
      className="h-10 w-full text-primary/70"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
});

Sparkline.displayName = 'Sparkline';

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  sparklineData,
  loading,
}) => {
  return (
    <section
      role="region"
      aria-label={title}
      tabIndex={0}
      className="kpi-card rounded-xl border border-slate-200 bg-white p-3 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="kpi-title text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </span>
        </div>

        <div className="kpi-value text-xl font-semibold text-slate-800 sm:text-2xl">
          {loading ? (
            <span className="inline-flex h-7 w-24 animate-pulse rounded bg-slate-200 sm:h-8" />
          ) : (
            value
          )}
        </div>

        {subtitle ? (
          <p className="kpi-subtitle truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>
        ) : null}

        {sparklineData && sparklineData.length ? (
          <Sparkline data={sparklineData} />
        ) : null}
      </div>
    </section>
  );
};

export default KpiCard;
