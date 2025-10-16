import { useMemo, type CSSProperties } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

import type { DashboardPeriod, DashboardRentPoint } from '../../hooks/useDashboard';
import { toBRL } from '../../utils/formatters';
import { useTailwindColorSingle } from './useTailwindColorPalette';

const withAlpha = (color: string, alpha: number) => {
  if (!color) return `rgba(15, 23, 42, ${alpha})`;

  const rgbaMatch = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
};

interface AreaRent6MProps {
  data: DashboardRentPoint[];
  period: DashboardPeriod;
  height?: number;
  compact?: boolean;
  loading?: boolean;
}

const filterByPeriod = (data: DashboardRentPoint[], period: DashboardPeriod) => {
  if (!data.length) return data;

  const sorted = [...data].sort((a, b) => a.order - b.order);
  const currentYear = new Date().getFullYear();

  switch (period) {
    case 'current-month':
      return sorted.slice(-1);
    case 'last-3':
      return sorted.slice(-3);
    case 'last-6':
      return sorted.slice(-6);
    case 'ytd': {
      const yearFiltered = sorted.filter((item) => item.date?.getFullYear() === currentYear);
      return yearFiltered.length ? yearFiltered : sorted;
    }
    default:
      return sorted;
  }
};

export const AreaRent6M: React.FC<AreaRent6MProps> = ({
  data,
  period,
  height = 220,
  compact,
  loading,
}) => {
  const dueColor = useTailwindColorSingle('text-slate-400', 'rgba(148, 163, 184, 1)');
  const collectedColor = useTailwindColorSingle('text-primary', 'rgba(37, 99, 235, 1)');
  const axisColor = useMemo(() => withAlpha(dueColor, 0.85), [dueColor]);
  const gridColor = useMemo(() => withAlpha(dueColor, 0.25), [dueColor]);

  const filteredData = useMemo(() => filterByPeriod(data, period), [data, period]);

  if (loading) {
    return (
      <div
        className="rounded-lg bg-slate-100"
        style={{ height }}
        aria-hidden="true"
      >
        <div className="h-full animate-pulse rounded-lg bg-slate-200/80" />
      </div>
    );
  }

  if (!filteredData.length) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400"
        style={{ height }}
      >
        Sem registros de aluguel no período selecionado.
      </div>
    );
  }

  return (
    <div
      className="text-primary"
      style={
        {
          '--chart-due': dueColor,
          '--chart-collected': collectedColor,
          '--chart-grid': gridColor,
        } as CSSProperties
      }
    >
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={filteredData}
          margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="rentDueGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-due)" stopOpacity={1} />
              <stop offset="95%" stopColor="var(--chart-due)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rentCollectedGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-collected)" stopOpacity={1} />
              <stop offset="95%" stopColor="var(--chart-collected)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="displayLabel"
            stroke={axisColor}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={axisColor}
            tick={{
              fontSize: 12,
            }}
            tickFormatter={(value: number) => toBRL(value).replace('R$', '').trim()}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value: number) => toBRL(value)}
            itemStyle={{ color: 'var(--chart-collected)' }}
          />
          <Area
            type="monotone"
            dataKey="due"
            name="Previsto"
            stroke="var(--chart-due)"
            fill="url(#rentDueGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="collected"
            name="Recebido"
            stroke="var(--chart-collected)"
            fill="url(#rentCollectedGradient)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AreaRent6M;
