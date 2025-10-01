import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { ExpensesApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
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

const buildDefaultValues = (): ExpenseForm => ({
  vehicle_id: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'Repair',
  description: '',
  amount: 0,
  vendor_id: '',
  paid_with: '',
  notes: '',
});

const Expenses: React.FC = () => {
  const queryClient = useQueryClient();
  const expensesQuery = useQuery({ queryKey: ['expenses'], queryFn: () => ExpensesApi.list() });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'all'], queryFn: () => VehiclesApi.list({ page_size: 100 }) });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<ExpenseForm>({ defaultValues: buildDefaultValues() });

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  const createExpense = useMutation({
    mutationFn: (payload: Partial<Expense>) => ExpensesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      handleResetForm();
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Expense> }) => ExpensesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      handleResetForm();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id: string) => ExpensesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    reset({
      vehicle_id: expense.vehicle_id,
      date: expense.date,
      category: expense.category,
      description: expense.description,
      amount: Number(expense.amount ?? 0),
      vendor_id: expense.vendor_id ?? '',
      paid_with: expense.paid_with ?? '',
      notes: expense.notes ?? '',
    });
  };

  const onSubmit = (data: ExpenseForm) => {
    const payload: Partial<Expense> = {
      vehicle_id: data.vehicle_id,
      date: data.date,
      category: data.category,
      description: data.description,
      amount: data.amount.toString(),
      vendor_id: data.vendor_id,
      paid_with: data.paid_with,
      notes: data.notes,
    };

    if (editingId) {
      updateExpense.mutate({ id: editingId, payload });
    } else {
      createExpense.mutate(payload);
    }
  };

  const isSaving = createExpense.isPending || updateExpense.isPending;
  const isEditing = Boolean(editingId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Despesas de veículos"
        description="Registre gastos e acompanhe o custo total por veículo."
        variant="soft"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar despesa' : 'Nova despesa'}</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('vehicle_id', { required: true })}>
              <option value="">Selecione...</option>
              {vehiclesQuery.data?.items.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} — {vehicle.make} {vehicle.model}
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
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true, min: 0 })} />
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
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar despesa' : 'Registrar despesa'}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={handleResetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar edição
              </button>
            ) : null}
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
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => handleEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Excluir despesa?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deleteExpense.mutate(item.id);
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
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
