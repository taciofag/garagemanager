import { useQuery } from '@tanstack/react-query';

import { SummaryApi } from '../api/resources';
import { Loading } from '../components/Loading';
import { StatCard } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';

const currency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const Summary: React.FC = () => {
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: SummaryApi.get });

  if (summaryQuery.isLoading) {
    return <Loading label="Calculando resumo..." />;
  }
  if (summaryQuery.isError) {
    return <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar resumo.</div>;
  }

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resumo financeiro"
        description="Indicadores calculados em tempo real com base na base de dados."
        variant="soft"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Veículos em estoque" value={summary.total_vehicles_stock} />
        <StatCard title="Veículos alugados" value={summary.vehicles_rented} tone="success" />
        <StatCard title="Veículos vendidos YTD" value={summary.vehicles_sold_ytd} tone="warning" />
        <StatCard title="Capital aportado" value={currency(summary.capital_in_total)} />
        <StatCard title="Capital retirado" value={currency(summary.capital_out_total)} tone="warning" />
        <StatCard
          title="Receita de aluguel YTD"
          value={currency(summary.rent_collected_ytd)}
          subtitle={`Lucro líquido em vendas YTD: ${currency(summary.profit_realized_sales_ytd)}`}
          tone="success"
        />
      </div>
    </div>
  );
};

export default Summary;
