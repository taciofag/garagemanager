import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  type TooltipProps,
} from 'recharts';

import { SummaryApi, VehiclesApi, RentPaymentsApi } from '../api/resources';
import { vehicleStatusLabel } from '../utils/labels';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { StatCard } from '../components/StatCard';
import type { RentPayment, Vehicle } from '../types';

const currency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const STATUS_COLORS = ['#2563eb', '#0ea5e9', '#9333ea', '#6366f1'];

const renderFleetTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload?.length) {
    return null;
  }

  const { name, value, payload: datum } = payload[0];
  const percentage = datum?.percentage as number | undefined;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
      <p className="text-sm font-semibold text-slate-700">{name}</p>
      <p className="mt-1 text-slate-600">
        {value} veículos{percentage != null ? ` · ${percentage}%` : ''}
      </p>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: SummaryApi.get });
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'latest'],
    queryFn: () => VehiclesApi.list({ page_size: 5, order_by: 'created_at', order_dir: 'desc' }),
  });
  const chargesQuery = useQuery({
    queryKey: ['rent-payments', 'open'],
    queryFn: () => RentPaymentsApi.list({ open_only: true, page_size: 5 }),
  });

  const summary = summaryQuery.data;

  const vehicleStatusData = useMemo(() => {
    if (!summary) {
      return [] as Array<{ name: string; value: number; color: string; percentage: number }>;
    }

    const total = summary.vehicle_status_breakdown.reduce((acc, item) => acc + item.count, 0);

    return summary.vehicle_status_breakdown.map((item, index) => {
      const count = item.count;
      const percentage = total ? Math.round((count / total) * 100) : 0;
      return {
        name: vehicleStatusLabel(item.status),
        value: count,
        color: STATUS_COLORS[index % STATUS_COLORS.length],
        percentage,
      };
    });
  }, [summary]);

  const totalFleet = useMemo(
    () => vehicleStatusData.reduce((acc, item) => acc + item.value, 0),
    [vehicleStatusData]
  );

  const rentSeries = useMemo(() => {
    if (!summary) {
      return [] as Array<{ label: string; Previsto: number; Recebido: number }>;
    }
    return summary.rent_collection_last_6_months.map((item) => ({
      label: item.label,
      Previsto: Number(item.due ?? 0),
      Recebido: Number(item.collected ?? 0),
    }));
  }, [summary]);

  const expenseSeries = useMemo(() => {
    if (!summary) {
      return [] as Array<{ label: string; Valor: number }>;
    }
    return summary.expenses_last_6_months.map((item) => ({
      label: item.label,
      Valor: Number(item.value ?? 0),
    }));
  }, [summary]);

  const expenseCategorySeries = useMemo(() => {
    if (!summary) {
      return [] as Array<{ label: string; Valor: number }>;
    }
    return summary.expenses_by_category_ytd.map((item) => ({
      label: item.label,
      Valor: Number(item.value ?? 0),
    }));
  }, [summary]);

  const partnerBalances = useMemo(() => {
    if (!summary) {
      return [] as Array<{ partner: string; Saldo: number; Aportes: number; Retiradas: number }>;
    }
    return summary.capital_balance_by_partner.map((item) => ({
      partner: item.partner,
      Saldo: Number(item.balance ?? 0),
      Aportes: Number(item.contribution_total ?? 0),
      Retiradas: Number(item.withdrawal_total ?? 0),
    }));
  }, [summary]);

  const hasVehicleStatusData = vehicleStatusData.some((item) => item.value > 0);
  const hasRentSeriesData = rentSeries.some((item) => item.Previsto > 0 || item.Recebido > 0);
  const hasExpenseSeriesData = expenseSeries.some((item) => item.Valor > 0);
  const hasExpenseCategoryData = expenseCategorySeries.some((item) => item.Valor > 0);
  const hasPartnerData = partnerBalances.length > 0;

  if (summaryQuery.isError) {
    return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{String(summaryQuery.error)}</div>;
  }
  if (summaryQuery.isLoading || !summary) {
    return <Loading label="Carregando dados do painel..." />;
  }

  const heroHighlights = [
    { label: 'Frota total', value: totalFleet },
    { label: 'Veículos em estoque', value: summary.total_vehicles_stock },
    { label: 'Veículos alugados', value: summary.vehicles_rented },
    { label: 'Receita de aluguel (YTD)', value: currency(summary.rent_collected_ytd) },
  ];

  const operationalStats = [
    { title: 'Veículos em estoque', value: summary.total_vehicles_stock },
    { title: 'Veículos alugados', value: summary.vehicles_rented, tone: 'success' as const },
    { title: 'Vendidos no ano', value: summary.vehicles_sold_ytd, tone: 'warning' as const },
    {
      title: 'Aluguéis em aberto',
      value: summary.open_rent_payments,
      subtitle: `Saldo: ${currency(summary.outstanding_rent_total)}`,
      tone: 'warning' as const,
    },
  ];

  const financialStats = [
    { title: 'Capital aportado', value: currency(summary.capital_in_total) },
    { title: 'Capital retirado', value: currency(summary.capital_out_total), tone: 'warning' as const },
    { title: 'Receita de aluguel (YTD)', value: currency(summary.rent_collected_ytd), tone: 'success' as const },
    { title: 'Lucro em vendas (YTD)', value: currency(summary.profit_realized_sales_ytd) },
    {
      title: 'Saldo em caixa',
      value: currency(summary.cash_balance),
      tone: Number(summary.cash_balance) >= 0 ? ('success' as const) : ('warning' as const),
    },
  ];

  return (
    <div className="space-y-8">
      <header className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-slate-800 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Visão geral do portfólio</h1>
            <p className="text-sm text-indigo-100">
              Acompanhe o desempenho da frota, receitas de aluguel e saúde financeira em tempo real.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {heroHighlights.map((highlight) => (
              <div key={highlight.label} className="rounded-lg bg-white/10 px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-wide text-indigo-100">{highlight.label}</p>
                <p className="text-lg font-semibold text-white">{highlight.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-700">Indicadores operacionais</h2>
            <p className="text-sm text-slate-500">Visão rápida dos números que movimentam a frota.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {operationalStats.map((item) => (
                <StatCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} tone={item.tone} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-700">Indicadores financeiros</h2>
            <p className="text-sm text-slate-500">Aporte de capital, receitas e liquidez do negócio.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {financialStats.map((item) => (
                <StatCard key={item.title} title={item.title} value={item.value} subtitle={item.subtitle} tone={item.tone} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Arrecadação de aluguel (últimos 6 meses)</h3>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Previsto
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Recebido
              </span>
            </div>
          </div>
          <div className="h-72">
            {hasRentSeriesData ? (
              <ResponsiveContainer>
                <AreaChart data={rentSeries} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="rentPrevisto" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rentRecebido" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => currency(value).replace('R$', '').trim()} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Area type="monotone" dataKey="Previsto" stroke="#94a3b8" fill="url(#rentPrevisto)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Recebido" stroke="#2563eb" fill="url(#rentRecebido)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem registros de aluguel no período.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Distribuição da frota</h3>
            <span className="text-xs uppercase tracking-wide text-slate-400">Total: {totalFleet}</span>
          </div>
          <div className="h-72">
            {hasVehicleStatusData ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={vehicleStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {vehicleStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={renderFleetTooltip} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem dados de frota disponíveis.</div>
            )}
          </div>
          {hasVehicleStatusData ? (
            <ul className="mt-4 grid gap-2 text-sm text-slate-600">
              {vehicleStatusData.map((item) => (
                <li key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-700">
                    {item.value} veículos <span className="text-xs text-slate-400">({item.percentage}%)</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Despesas recentes</h3>
            <span className="text-xs uppercase tracking-wide text-slate-400">Últimos 6 meses</span>
          </div>
          <div className="h-64">
            {hasExpenseSeriesData ? (
              <ResponsiveContainer>
                <BarChart data={expenseSeries} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => currency(value).replace('R$', '').trim()} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="Valor" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem despesas registradas no período.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-700">Despesas por categoria (YTD)</h3>
          <div className="h-64">
            {hasExpenseCategoryData ? (
              <ResponsiveContainer>
                <BarChart data={expenseCategorySeries} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={(value) => currency(value).replace('R$', '').trim()} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Bar dataKey="Valor" fill="#14b8a6" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem lançamentos no ano.</div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-slate-700">Saldo por sócio</h3>
        <div className="h-64">
          {hasPartnerData ? (
            <ResponsiveContainer>
              <BarChart data={partnerBalances} layout="vertical" margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(value) => currency(value).replace('R$', '').trim()} stroke="#94a3b8" />
                <YAxis type="category" dataKey="partner" width={140} tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip formatter={(value: number) => currency(value)} />
                <Bar dataKey="Saldo" fill="#f97316" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem movimentos de capital registrados.</div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Novos veículos</h3>
            <span className="text-xs uppercase tracking-wide text-slate-400">Atualizados recentemente</span>
          </div>
          {vehiclesQuery.isLoading ? (
            <Loading label="Carregando veículos..." />
          ) : vehiclesQuery.isError ? (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar veículos.</div>
          ) : (
            <DataTable<Vehicle>
              data={vehiclesQuery.data?.items ?? []}
              columns={[
                { header: 'ID', key: 'id' },
                { header: 'Modelo', key: 'model' },
                { header: 'Marca', key: 'make' },
                {
                  header: 'Status',
                  key: 'status',
                  render: (item) => vehicleStatusLabel(item.status),
                },
                {
                  header: 'Compra',
                  key: 'acquisition_price',
                  render: (item) => currency(item.acquisition_price),
                },
              ]}
            />
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Cobranças em aberto</h3>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Saldo: {currency(summary.outstanding_rent_total)}
            </span>
          </div>
          {chargesQuery.isLoading ? (
            <Loading label="Carregando cobranças..." />
          ) : chargesQuery.isError ? (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar cobranças.</div>
          ) : (
            <DataTable<RentPayment>
              data={chargesQuery.data?.items ?? []}
              columns={[
                { header: 'ID', key: 'id' },
                {
                  header: 'Período',
                  key: 'period_start',
                  render: (item) => `${format(new Date(item.period_start), 'dd/MM')} - ${format(new Date(item.period_end), 'dd/MM')}`,
                },
                { header: 'Semanas', key: 'weeks' },
                {
                  header: 'Valor devido',
                  key: 'due_amount',
                  render: (item) => currency(item.due_amount),
                },
                {
                  header: 'Saldo',
                  key: 'balance',
                  render: (item) => (
                    <span className="font-semibold text-red-500">{currency(item.balance)}</span>
                  ),
                },
              ]}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
