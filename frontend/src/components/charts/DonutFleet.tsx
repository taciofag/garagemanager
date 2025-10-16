import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';

import type { DashboardFleetSlice } from '../../hooks/useDashboard';
import { toPct, toInt } from '../../utils/formatters';

import { useTailwindColorPalette } from './useTailwindColorPalette';

interface DonutFleetProps {
  data: DashboardFleetSlice[];
  height?: number;
  loading?: boolean;
}

export const DonutFleet: React.FC<DonutFleetProps> = ({
  data,
  height = 220,
  loading,
}) => {
  const palette = useTailwindColorPalette();

  const hasData = data.some((item) => item.value > 0);

  const total = useMemo(
    () => data.reduce((acc, item) => acc + item.value, 0),
    [data]
  );

  if (loading) {
    return (
      <div
        className="rounded-lg bg-slate-100"
        style={{ height }}
        aria-hidden="true"
      >
        <div className="h-full animate-pulse rounded-lg bg-slate-200/70" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400"
        style={{ height }}
      >
        Sem dados de frota disponíveis.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={4}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.id}
                fill={palette[index % palette.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, _name, payload) => {
              const slice = payload?.payload as DashboardFleetSlice | undefined;
              const percentage = slice ? toPct(slice.percentage) : '';
              return [`${toInt(value)} veículos`, `${slice?.label ?? ''} · ${percentage}`];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        {data.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette[index % palette.length] }}
              />
              <span>{item.label}</span>
            </div>
            <span className="font-semibold text-slate-800">
              {toInt(item.value)} <span className="text-xs text-slate-500">({toPct(item.percentage)})</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Total da frota: <span className="font-semibold text-slate-700">{toInt(total)} veículos</span>
      </p>
    </div>
  );
};

export default DonutFleet;
