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
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { SummaryApi, VehiclesApi, RentPaymentsApi } from '../api/resources';
import { vehicleStatusLabel } from '../utils/labels';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { StatCard } from '../components/StatCard';
import type { RentPayment, Vehicle } from '../types';

const currency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const STATUS_COLORS = ['#2563eb', '#0ea5e9', '#9333ea'];

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
      return [];
    }
    return summary.vehicle_status_breakdown.map((item, index) => ({
      name: vehicleStatusLabel(item.status),
      value: item.count,
      color: STATUS_COLORS[index % STATUS_COLORS.length],
    }));
  }, [summary]);

  const rentSeries = useMemo(() => {
    if (!summary) {
      return [];
    }
    return summary.rent_collection_last_6_months.map((item) => ({
      label: item.label,
      Previsto: Number(item.due ?? 0),
      Recebido: Number(item.collected ?? 0),
    }));
  }, [summary]);

  const expenseSeries = useMemo(() => {
    if (!summary) {
      return [];
    }
    return summary.expenses_last_6_months.map((item) => ({
      label: item.label,
      Valor: Number(item.value ?? 0),
    }));
  }, [summary]);

  const expenseCategorySeries = useMemo(() => {
    if (!summary) {
      return [];
    }
    return summary.expenses_by_category_ytd.map((item) => ({
      label: item.label,
      Valor: Number(item.value ?? 0),
    }));
  }, [summary]);

  const partnerBalances = useMemo(() => {
    if (!summary) {
      return [];
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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Indicadores principais</h2>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard title="Veículos em estoque" value={summary.total_vehicles_stock} />
          <StatCard title="Veículos alugados" value={summary.vehicles_rented} tone="success" />
          <StatCard title="Vendidos no ano" value={summary.vehicles_sold_ytd} tone="warning" />
          <StatCard title="Aluguéis em aberto" value={summary.open_rent_payments} subtitle={`Saldo: ${currency(summary.outstanding_rent_total)}`} tone="warning" />
          <StatCard title="Capital aportado" value={currency(summary.capital_in_total)} />
          <StatCard title="Capital retirado" value={currency(summary.capital_out_total)} tone="warning" />
          <StatCard title="Receita de aluguel (YTD)" value={currency(summary.rent_collected_ytd)} tone="success" />
          <StatCard title="Lucro em vendas (YTD)" value={currency(summary.profit_realized_sales_ytd)} />
          <StatCard title="Saldo em caixa" value={currency(summary.cash_balance)} tone={Number(summary.cash_balance) >= 0 ? 'success' : 'warning'} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Distribuição da frota</h3>
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total: {vehicleStatusData.reduce((acc, item) => acc + item.value, 0)}
            </span>
          </div>
          <div className="h-64">
            {hasVehicleStatusData ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={vehicleStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={4}>
                    {vehicleStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, 'Veículos']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem dados de frota.</div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Cobranças x recebimentos (6 meses)</h3>
          </div>
          <div className="h-64">
            {hasRentSeriesData ? (
              <ResponsiveContainer>
                <AreaChart data={rentSeries} margin={{ top: 10, left: 0, right: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rentDue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="rentCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currency(value).replace('R$', '').trim()} tick={{ fill: '#475569', fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="Previsto" stroke="#f97316" fill="url(#rentDue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Recebido" stroke="#22c55e" fill="url(#rentCollected)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Nenhuma cobrança registrada no período.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Despesas operacionais (6 meses)</h3>
          </div>
          <div className="h-64">
            {hasExpenseSeriesData ? (
              <ResponsiveContainer>
                <BarChart data={expenseSeries} margin={{ top: 10, left: 0, right: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => currency(value).replace('R$', '').trim()} tick={{ fill: '#475569', fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value: number) => currency(value)} />
                  <Legend />
                  <Bar dataKey="Valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem despesas registradas no período.</div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-700">Despesas por categoria (YTD)</h3>
            <div className="h-40">
              {hasExpenseCategoryData ? (
                <ResponsiveContainer>
                  <BarChart data={expenseCategorySeries} layout="vertical" margin={{ top: 5, left: 0, right: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(value) => currency(value).replace('R$', '').trim()} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip formatter={(value: number) => currency(value)} />
                    <Bar dataKey="Valor" fill="#6366f1" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem lançamentos no ano.</div>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-700">Saldo por sócio</h3>
            <div className="h-40">
              {hasPartnerData ? (
                <ResponsiveContainer>
                  <BarChart data={partnerBalances} layout="vertical" margin={{ top: 5, left: 0, right: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(value) => currency(value).replace('R$', '').trim()} />
                    <YAxis type="category" dataKey="partner" width={120} tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip formatter={(value: number) => currency(value)} />
                    <Bar dataKey="Saldo" fill="#10b981" radius={[4, 4, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem movimentos de capital.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-700">Novos veículos</h3>
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
        <div>
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
