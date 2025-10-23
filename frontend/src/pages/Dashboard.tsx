import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

import { useDashboard, type DashboardPeriod } from '../hooks/useDashboard';
import { KpiCard } from '../components/ui/KpiCard';
import { Section } from '../components/ui/Section';
import { AreaRent6M } from '../components/charts/AreaRent6M';
import { DonutFleet } from '../components/charts/DonutFleet';
import { toBRL, toInt } from '../utils/formatters';
import { vehicleStatusLabel } from '../utils/labels';
import type { RentPayment } from '../types';

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: 'current-month', label: 'Mês atual' },
  { value: 'last-3', label: 'Últimos 3' },
  { value: 'last-6', label: 'Últimos 6' },
  { value: 'ytd', label: 'YTD' },
];

const KPI_TITLES = [
  { id: 'fleet-total', title: 'Frota total' },
  { id: 'fleet-stock', title: 'Em estoque' },
  { id: 'fleet-rented', title: 'Alugados' },
  { id: 'rent-forecast', title: 'Aluguel previsto (mês)' },
  { id: 'rent-ytd', title: 'Receita de aluguel (YTD)' },
  { id: 'rent-collected-month', title: 'Recebido (mês)' },
  { id: 'cash-balance', title: 'Saldo em caixa' },
  { id: 'maintenance-forecast', title: 'Previsto em manutenção (mês)' },
];

const KPI_PLACEHOLDER = KPI_TITLES.map((item) => ({ ...item, value: '--' }));

const getErrorMessage = (error: unknown) => {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro inesperado.';
};

const formatPeriodRange = (payment: RentPayment) => {
  try {
    const start = new Date(payment.period_start);
    const end = new Date(payment.period_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return `${payment.period_start} - ${payment.period_end}`;
    }

    return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM", { locale: ptBR })}`;
  } catch {
    return `${payment.period_start} - ${payment.period_end}`;
  }
};

const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-200/70" />
    ))}
  </div>
);

const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState<DashboardPeriod>('current-month');
  const [isCompact, setIsCompact] = useState(false);

  const {
    kpis,
    rentSeries6M,
    fleetBreakdown,
    recentVehicles,
    openBillings,
    outstandingTotal,
    loading,
    isFetching,
    errors,
  } = useDashboard();

  const displayKpis = kpis.length ? kpis : KPI_PLACEHOLDER;
  const chartHeight = isCompact ? 200 : 220;
  const fleetTotal = useMemo(
    () => fleetBreakdown.reduce((acc, item) => acc + item.value, 0),
    [fleetBreakdown]
  );

  const rentSeriesLoading = loading && rentSeries6M.length === 0;
  const fleetLoading = loading && fleetBreakdown.length === 0;
  const vehiclesLoading = loading && recentVehicles.length === 0;
  const billingsLoading = loading && openBillings.length === 0;

  const summaryError = getErrorMessage(errors.summary);
  const vehiclesError = getErrorMessage(errors.vehicles);
  const billingsError = getErrorMessage(errors.billings);

  const periodLabel =
    PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? 'Período';

  const visibleVehicles = recentVehicles.slice(0, 5);
  const visibleBillings = openBillings.slice(0, 5);

  return (
    <div className={`dashboard-page min-h-full ${isCompact ? 'is-compact' : ''}`}>
      <div className="flex flex-col gap-6 pt-4 sm:gap-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 sm:pb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Visão geral</h1>
            <p className="text-sm text-slate-500">
              Acompanhe métricas-chave da frota e fluxos de receita em tempo real.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Período</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Exportar
            </button>
            <label className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-600 transition hover:border-slate-200">
              <input
                type="checkbox"
                checked={isCompact}
                onChange={(event) => setIsCompact(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="font-medium text-slate-700">Compacto</span>
            </label>
          </div>
        </header>

        <section aria-labelledby="dashboard-kpis">
          <h2 id="dashboard-kpis" className="sr-only">
            Indicadores principais
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 sm:gap-4">
            {displayKpis.map((item) => (
              <KpiCard
                key={item.id}
                title={item.title}
                value={item.value}
                loading={(loading || isFetching) && !kpis.length}
              />
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section
            title="Aluguel previsto x recebido"
            description={`Período: ${periodLabel}`}
            roleLabel="Gráfico de arrecadação de aluguel"
          >
            {summaryError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {summaryError}
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                    Previsto
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    Recebido
                  </span>
                </div>
                <AreaRent6M
                  data={rentSeries6M}
                  period={period}
                  height={chartHeight}
                  compact={isCompact}
                  loading={rentSeriesLoading}
                />
              </>
            )}
          </Section>

          <Section
            title="Distribuição da frota"
            description="Status atuais dos veículos"
            actions={
              fleetTotal ? (
                <span className="text-sm font-medium text-slate-600">
                  Total: {toInt(fleetTotal)} veículos
                </span>
              ) : undefined
            }
            roleLabel="Gráfico de distribuição da frota"
          >
            {summaryError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {summaryError}
              </div>
            ) : (
              <DonutFleet
                data={fleetBreakdown}
                height={chartHeight}
                loading={fleetLoading}
              />
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Atividade recente</h2>
            {isFetching && !loading ? (
              <span className="text-xs uppercase tracking-wide text-slate-400">Atualizando…</span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section
              title="Novos veículos"
              description="Últimas entradas no estoque"
              actions={
                <Link
                  to="/vehicles"
                  className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  ver tudo
                </Link>
              }
            >
              {vehiclesError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {vehiclesError}
                </div>
              ) : vehiclesLoading ? (
                <SkeletonList rows={4} />
              ) : visibleVehicles.length ? (
                <>
                  <div className="hidden overflow-hidden rounded-lg border border-slate-200 shadow-sm md:block">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">ID</th>
                          <th className="px-4 py-3 font-semibold">Modelo</th>
                          <th className="px-4 py-3 font-semibold">Marca</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">Compra</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {visibleVehicles.map((vehicle) => (
                          <tr key={vehicle.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{vehicle.id}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{vehicle.model}</td>
                            <td className="px-4 py-3 text-slate-600">{vehicle.make}</td>
                            <td className="px-4 py-3 text-slate-600">{vehicleStatusLabel(vehicle.status)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-800">
                              {toBRL(vehicle.acquisition_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden" role="list" aria-label="Novos veículos">
                    {visibleVehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        role="listitem"
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="text-xs uppercase tracking-wide text-slate-400">#{vehicle.id}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {vehicle.make} {vehicle.model}
                        </div>
                        <dl className="mt-2 space-y-1 text-xs text-slate-500">
                          <div className="flex items-center justify-between">
                            <dt>Status</dt>
                            <dd className="font-medium text-slate-700">{vehicleStatusLabel(vehicle.status)}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt>Compra</dt>
                            <dd className="font-semibold text-slate-800">{toBRL(vehicle.acquisition_price)}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  Nenhum veículo recente.
                </div>
              )}
            </Section>

            <Section
              title="Cobranças em aberto"
              description="Pagamentos de aluguel pendentes"
              actions={
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">
                    Saldo: {outstandingTotal}
                  </span>
                  <Link
                    to="/rent-payments"
                    className="text-sm font-medium text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    ver tudo
                  </Link>
                </div>
              }
            >
              {billingsError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {billingsError}
                </div>
              ) : billingsLoading ? (
                <SkeletonList rows={4} />
              ) : visibleBillings.length ? (
                <>
                  <div className="hidden overflow-hidden rounded-lg border border-slate-200 shadow-sm md:block">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">ID</th>
                          <th className="px-4 py-3 font-semibold">Período</th>
                          <th className="px-4 py-3 font-semibold text-center">Semanas</th>
                          <th className="px-4 py-3 font-semibold text-right">Valor devido</th>
                          <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {visibleBillings.map((billing) => (
                          <tr key={billing.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-600">{billing.id}</td>
                            <td className="px-4 py-3 text-slate-600">{formatPeriodRange(billing)}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{billing.weeks}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{toBRL(billing.due_amount)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-500">
                              {toBRL(billing.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden" role="list" aria-label="Cobranças em aberto">
                    {visibleBillings.map((billing) => (
                      <div
                        key={billing.id}
                        role="listitem"
                        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                      >
                        <div className="text-xs uppercase tracking-wide text-slate-400">#{billing.id}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {formatPeriodRange(billing)}
                        </div>
                        <dl className="mt-2 space-y-1 text-xs text-slate-500">
                          <div className="flex items-center justify-between">
                            <dt>Semanas</dt>
                            <dd className="font-medium text-slate-700">{billing.weeks}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt>Devido</dt>
                            <dd className="font-semibold text-slate-800">{toBRL(billing.due_amount)}</dd>
                          </div>
                          <div className="flex items-center justify-between">
                            <dt>Saldo</dt>
                            <dd className="font-semibold text-red-500">{toBRL(billing.balance)}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  Nenhuma cobrança pendente no momento.
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
