import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { ExpensesApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { Expense } from '../types';
import { expenseCategoryLabel, expenseCategoryOptions } from '../utils/labels';

interface ExpenseForm {
  vehicle_id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor_id?: string;
  paid_with?: string;
  notes?: string;
}

const Expenses: React.FC = () => {
  const queryClient = useQueryClient();
  const expensesQuery = useQuery({ queryKey: ['expenses'], queryFn: () => ExpensesApi.list() });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => VehiclesApi.list({ page_size: 100 }) });

  const { register, handleSubmit, reset } = useForm<ExpenseForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), category: 'Repair' },
  });

  const createExpense = useMutation({
    mutationFn: (payload: Partial<Expense>) => ExpensesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      reset({ date: new Date().toISOString().slice(0, 10), category: 'Repair' });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => ExpensesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const onSubmit = (data: ExpenseForm) => {
    createExpense.mutate({
      ...data,
      amount: data.amount.toString(),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Despesas de veículos</h1>
        <p className="text-sm text-slate-500">Registre gastos e acompanhe o custo total por veículo.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Nova despesa</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('vehicle_id', { required: true })}>
              <option value="">Selecione...</option>
              {vehiclesQuery.data?.items.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.id} - {vehicle.model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('date', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('category', { required: true })}>
              {expenseCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('description', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('vendor_id')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Pagamento</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('paid_with')} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('notes')} />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={createExpense.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createExpense.isPending ? 'Salvando...' : 'Registrar despesa'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Despesas recentes</h2>
        {expensesQuery.isLoading ? (
          <Loading label="Carregando despesas..." />
        ) : expensesQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar despesas.</div>
        ) : (
          <DataTable<Expense>
            data={expensesQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Veículo', key: 'vehicle_id' },
              {
                header: 'Categoria',
                key: 'category',
                render: (item) => expenseCategoryLabel(item.category),
              },
              { header: 'Descrição', key: 'description' },
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
                      if (confirm(`Excluir despesa ${item.id}?`)) {
                        deleteExpense.mutate(item.id);
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

export default Expenses;
