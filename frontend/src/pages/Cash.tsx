import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { CashApi, RentalsApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { CashTxn } from '../types';
import { cashTypeLabel } from '../utils/labels';

interface CashForm {
  date: string;
  type: CashTxn['type'];
  category: string;
  amount: number;
  method?: string;
  related_vehicle_id?: string;
  related_rental_id?: string;
  notes?: string;
}

const Cash: React.FC = () => {
  const queryClient = useQueryClient();
  const cashQuery = useQuery({ queryKey: ['cash'], queryFn: () => CashApi.list() });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'cash'], queryFn: () => VehiclesApi.list({ page_size: 100 }) });
  const rentalsQuery = useQuery({ queryKey: ['rentals', 'cash'], queryFn: () => RentalsApi.list({ page_size: 100 }) });

  const { register, handleSubmit, reset } = useForm<CashForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), type: 'Inflow' },
  });

  const createTxn = useMutation({
    mutationFn: (payload: Partial<CashTxn>) => CashApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      reset({ date: new Date().toISOString().slice(0, 10), type: 'Inflow' });
    },
  });

  const deleteTxn = useMutation({
    mutationFn: (id: string) => CashApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash'] }),
  });

  const onSubmit = (data: CashForm) => {
    createTxn.mutate({
      ...data,
      amount: data.amount.toString(),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Livro-caixa</h1>
        <p className="text-sm text-slate-500">Registre entradas e saídas financeiras da operação.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Nova transação</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('date', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('type', { required: true })}>
              <option value="Inflow">Entrada</option>
              <option value="Outflow">Saída</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('category', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Forma pagamento</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('method')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo (opcional)</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('related_vehicle_id')}>
              <option value="">-</option>
              {vehiclesQuery.data?.items.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Aluguel (opcional)</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('related_rental_id')}>
              <option value="">-</option>
              {rentalsQuery.data?.items.map((rental) => (
                <option key={rental.id} value={rental.id}>
                  {rental.id}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('notes')} />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={createTxn.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createTxn.isPending ? 'Salvando...' : 'Registrar transação'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Lançamentos recentes</h2>
        {cashQuery.isLoading ? (
          <Loading label="Carregando transações..." />
        ) : cashQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar transações.</div>
        ) : (
          <DataTable<CashTxn>
            data={cashQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              {
                header: 'Tipo',
                key: 'type',
                render: (item) => cashTypeLabel(item.type),
              },
              { header: 'Categoria', key: 'category' },
              {
                header: 'Valor',
                key: 'amount',
                render: (item) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.amount)),
              },
              {
                header: 'Ações',
                key: 'actions',
                render: (item) => (
                  <button
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Excluir transação ${item.id}?`)) {
                        deleteTxn.mutate(item.id);
                      }
                    }}
                  >
                    Excluir
                  </button>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
};

export default Cash;
