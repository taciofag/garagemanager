import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CashApi, CashCategoriesApi, RentalsApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { CashTxn, CashCategory } from '../types';
import { cashTypeLabel } from '../utils/labels';
import { CashCategoryManager } from '../components/CashCategoryManager';

interface CashForm {
  date: string;
  type: CashTxn['type'];
  category_id: string;
  amount: number;
  method?: string;
  related_vehicle_id?: string;
  related_rental_id?: string;
  notes?: string;
}

const buildDefaultValues = (): CashForm => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'Inflow',
  category_id: '',
  amount: 0,
  method: '',
  related_vehicle_id: '',
  related_rental_id: '',
  notes: '',
});

const Cash: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const cashQuery = useQuery({
    queryKey: ['cash'],
    queryFn: () => CashApi.list({ order_by: 'date', order_dir: 'desc', page_size: 200 }),
  });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'cash'], queryFn: () => VehiclesApi.list({ page_size: 100 }) });
  const rentalsQuery = useQuery({ queryKey: ['rentals', 'cash'], queryFn: () => RentalsApi.list({ page_size: 100 }) });
  const categoriesQuery = useQuery({ queryKey: ['cash-categories'], queryFn: () => CashCategoriesApi.list() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const vehiclesById = useMemo(() => {
    const dictionary: Record<string, { plate?: string; make?: string; model?: string }> = {};
    vehiclesQuery.data?.items.forEach((vehicle) => {
      dictionary[vehicle.id] = { plate: vehicle.plate, make: vehicle.make, model: vehicle.model };
    });
    return dictionary;
  }, [vehiclesQuery.data]);

  const rentalOptions = useMemo(() => {
    return (
      rentalsQuery.data?.items.map((rental) => {
        const vehicle = vehiclesById[rental.vehicle_id];
        const plate = vehicle?.plate ? vehicle.plate.toUpperCase() : null;
        const description = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
        const label = [plate, description || rental.vehicle_id].filter(Boolean).join(' — ');
        return { id: rental.id, label: label || rental.id };
      }) ?? []
    );
  }, [rentalsQuery.data, vehiclesById]);

  const { register, handleSubmit, reset, setValue, watch } = useForm<CashForm>({ defaultValues: buildDefaultValues() });
  const selectedCategoryId = watch('category_id');

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  const createTxn = useMutation({
    mutationFn: (payload: Partial<CashTxn>) => CashApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      handleResetForm();
    },
  });

  const updateTxn = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CashTxn> }) => CashApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash'] });
      handleResetForm();
    },
  });

  const deleteTxn = useMutation({
    mutationFn: (id: string) => CashApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cash'] }),
  });

  const handleEdit = (txn: CashTxn) => {
    setEditingId(txn.id);
    reset({
      date: txn.date,
      type: txn.type,
      category_id: txn.category_id,
      amount: Number(txn.amount ?? 0),
      method: txn.method ?? '',
      related_vehicle_id: txn.related_vehicle_id ?? '',
      related_rental_id: txn.related_rental_id ?? '',
      notes: txn.notes ?? '',
    });
  };

  const onSubmit = (data: CashForm) => {
    const payload: Partial<CashTxn> = {
      date: data.date,
      type: data.type,
      category_id: data.category_id,
      amount: data.amount.toString(),
      method: data.method,
      related_vehicle_id: data.related_vehicle_id || undefined,
      related_rental_id: data.related_rental_id || undefined,
      notes: data.notes,
    };

    if (editingId) {
      updateTxn.mutate({ id: editingId, payload });
    } else {
      createTxn.mutate(payload);
    }
  };

  const isSaving = createTxn.isPending || updateTxn.isPending;
  const isEditing = Boolean(editingId);

  useEffect(() => {
    if (!isEditing && !selectedCategoryId && categoriesQuery.data?.length) {
      setValue('category_id', categoriesQuery.data[0].id);
    }
  }, [isEditing, selectedCategoryId, categoriesQuery.data, setValue]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livro-caixa"
        description="Registre entradas e saídas financeiras da operação."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-700">{isEditing ? 'Editar transação' : 'Nova transação'}</h2>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setCategoryManagerOpen(true)}
              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 hover:border-indigo-300 hover:bg-indigo-100"
            >
              Gerenciar categorias
            </button>
          ) : null}
        </div>
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
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('category_id', { required: true })}
              disabled={categoriesQuery.isLoading}
            >
              <option value="">Selecione...</option>
              {categoriesQuery.data?.map((category: CashCategory) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {categoriesQuery.isError ? (
              <p className="mt-1 text-xs text-red-600">Erro ao carregar categorias.</p>
            ) : !categoriesQuery.isLoading && (categoriesQuery.data?.length ?? 0) === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Cadastre pelo menos uma categoria para registrar transações.</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true, min: 0 })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Forma de pagamento</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('method')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo (opcional)</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('related_vehicle_id')}>
              <option value="">-</option>
              {vehiclesQuery.data?.items.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate?.toUpperCase()} — {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Aluguel (opcional)</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('related_rental_id')}>
              <option value="">-</option>
              {rentalOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
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
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar transação' : 'Registrar transação'}
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
              {
                header: 'Categoria',
                key: 'category',
                render: (item) => item.category?.name ?? '-',
              },
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
                        if (confirm('Excluir transação?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deleteTxn.mutate(item.id);
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
      <CashCategoryManager open={categoryManagerOpen} onClose={() => setCategoryManagerOpen(false)} />
    </div>
  );
};

export default Cash;
