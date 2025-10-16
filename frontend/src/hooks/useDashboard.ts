import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { SummaryApi, VehiclesApi, RentPaymentsApi } from '../api/resources';
import { vehicleStatusLabel } from '../utils/labels';
import { toBRL, toInt, toMonthLabel, toMonthName } from '../utils/formatters';
import type { RentPayment, SummaryMetrics, Vehicle } from '../types';

export type DashboardPeriod = 'current-month' | 'last-3' | 'last-6' | 'ytd';

export interface DashboardKpi {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  sparklineData?: number[];
}

export interface DashboardRentPoint {
  label: string;
  month: string;
  date: Date | null;
  displayLabel: string;
  due: number;
  collected: number;
  order: number;
}

export interface DashboardFleetSlice {
  id: string;
  label: string;
  value: number;
  percentage: number;
}

export interface DashboardData {
  kpis: DashboardKpi[];
  rentSeries6M: DashboardRentPoint[];
  fleetBreakdown: DashboardFleetSlice[];
  recentVehicles: Vehicle[];
  openBillings: RentPayment[];
  outstandingTotal: string;
  loading: boolean;
  isFetching: boolean;
  errors: {
    summary?: unknown;
    vehicles?: unknown;
    billings?: unknown;
  };
  summary?: SummaryMetrics;
}

const parseCurrencyNumber = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Number(numeric) : 0;
};

const parseMonthLabelToDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return new Date(direct.getFullYear(), direct.getMonth(), 1);
  }

  const isoMonth = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonth) {
    const [, year, month] = isoMonth;
    return new Date(Number(year), Number(month) - 1, 1);
  }

  const slashMonth = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMonth) {
    const [, month, year] = slashMonth;
    return new Date(Number(year), Number(month) - 1, 1);
  }

  return null;
};

export const useDashboard = (): DashboardData => {
  const summaryQuery = useQuery({
    queryKey: ['summary'],
    queryFn: SummaryApi.get,
  });

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'latest'],
    queryFn: () =>
      VehiclesApi.list({
        page_size: 5,
        order_by: 'created_at',
        order_dir: 'desc',
      }),
  });

  const chargesQuery = useQuery({
    queryKey: ['rent-payments', 'open'],
    queryFn: () =>
      RentPaymentsApi.list({
        open_only: true,
        page_size: 5,
      }),
  });

  const summary = summaryQuery.data;

  const fleetBreakdown = useMemo<DashboardFleetSlice[]>(() => {
    if (!summary?.vehicle_status_breakdown?.length) return [];

    const total = summary.vehicle_status_breakdown.reduce(
      (acc, item) => acc + (item.count ?? 0),
      0
    );

    return summary.vehicle_status_breakdown.map((item) => {
      const count = item.count ?? 0;
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return {
        id: item.status,
        label: vehicleStatusLabel(item.status),
        value: count,
        percentage,
      };
    });
  }, [summary]);

  const rentSeries6M = useMemo<DashboardRentPoint[]>(() => {
    if (!summary?.rent_collection_last_6_months?.length) return [];

    return summary.rent_collection_last_6_months.map((point, index) => {
      const label = point.label ?? '';
      const date = parseMonthLabelToDate(point.label);
      const monthLabel = toMonthLabel(date ?? label) || label;
      const monthName = toMonthName(date ?? label) || monthLabel;
      return {
        label: monthLabel,
        month: label,
        date,
        displayLabel: monthName,
        due: parseCurrencyNumber(point.due),
        collected: parseCurrencyNumber(point.collected),
        order: index,
      };
    });
  }, [summary]);

  const outstandingTotal = useMemo(
    () => toBRL(summary?.outstanding_rent_total ?? 0),
    [summary]
  );

  const totalFleet = useMemo(
    () => fleetBreakdown.reduce((acc, slice) => acc + slice.value, 0),
    [fleetBreakdown]
  );

  const kpis = useMemo<DashboardKpi[]>(() => {
    if (!summary) return [];

    return [
      {
        id: 'fleet-total',
        title: 'Frota total',
        value: toInt(totalFleet),
      },
      {
        id: 'fleet-stock',
        title: 'Em estoque',
        value: toInt(summary.total_vehicles_stock ?? 0),
      },
      {
        id: 'fleet-rented',
        title: 'Alugados',
        value: toInt(summary.vehicles_rented ?? 0),
      },
      {
        id: 'rent-forecast',
        title: 'Aluguel previsto (mês)',
        value: toBRL(summary.rent_due_current_month ?? 0),
      },
      {
        id: 'rent-ytd',
        title: 'Receita de aluguel (YTD)',
        value: toBRL(summary.rent_collected_ytd ?? 0),
      },
      {
        id: 'rent-collected-month',
        title: 'Recebido (mês)',
        value: toBRL(summary.rent_collected_current_month ?? 0),
      },
      {
        id: 'cash-balance',
        title: 'Saldo em caixa',
        value: toBRL(summary.cash_balance ?? 0),
      },
      {
        id: 'maintenance-forecast',
        title: 'Previsto em manutenção (mês)',
        value: toBRL(summary.maintenance_month_estimated ?? 0),
      },
    ];
  }, [summary, totalFleet]);

  const recentVehicles = vehiclesQuery.data?.items ?? [];
  const openBillings = chargesQuery.data?.items ?? [];

  const loading =
    summaryQuery.isLoading ||
    vehiclesQuery.isLoading ||
    chargesQuery.isLoading;

  const isFetching =
    summaryQuery.isFetching ||
    vehiclesQuery.isFetching ||
    chargesQuery.isFetching;

  return {
    kpis,
    rentSeries6M,
    fleetBreakdown,
    recentVehicles,
    openBillings,
    outstandingTotal,
    loading,
    isFetching,
    errors: {
      summary: summaryQuery.error,
      vehicles: vehiclesQuery.error,
      billings: chargesQuery.error,
    },
    summary,
  };
};
