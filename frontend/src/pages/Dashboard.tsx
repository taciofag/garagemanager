import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { SummaryApi, VehiclesApi, RentPaymentsApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { StatCard } from '../components/StatCard';
import type { RentPayment, Vehicle } from '../types';

const currency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

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

  if (summaryQuery.isLoading) {
    return <Loading label="Carregando dados do painel..." />;
  }
  if (summaryQuery.isError) {
    return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{String(summaryQuery.error)}</div>;
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Indicadores principais</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Veículos em estoque" value={summary.total_vehicles_stock} />
          <StatCard title="Veículos alugados" value={summary.vehicles_rented} tone="success" />
          <StatCard title="Vendidos no ano" value={summary.vehicles_sold_ytd} tone="warning" />
          <StatCard title="Capital aportado" value={currency(summary.capital_in_total)} />
          <StatCard title="Capital retirado" value={currency(summary.capital_out_total)} tone="warning" />
          <StatCard title="Aluguel recebido YTD" value={currency(summary.rent_collected_ytd)} tone="success" />
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
                { header: 'Status', key: 'status' },
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
