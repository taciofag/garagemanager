import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { BillingApi, RentPaymentsApi, RentalsApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { RentPayment } from '../types';

interface RentPaymentForm {
  rental_id: string;
  period_start: string;
  period_end: string;
  weekly_rate: number;
  weeks: number;
  paid_amount?: number;
  payment_date?: string;
  late_fee?: number;
  method?: string;
  notes?: string;
}

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const buildDefaultValues = (): RentPaymentForm => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    rental_id: '',
    period_start: today,
    period_end: today,
    weekly_rate: 0,
    weeks: 1,
    paid_amount: 0,
    payment_date: today,
    late_fee: 0,
    method: '',
    notes: '',
  };
};

const RentPayments: React.FC = () => {
  const queryClient = useQueryClient();
  const paymentsQuery = useQuery({ queryKey: ['rent-payments'], queryFn: () => RentPaymentsApi.list() });
  const rentalsQuery = useQuery({ queryKey: ['rentals', 'select'], queryFn: () => RentalsApi.list({ page_size: 100 }) });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'lookup'], queryFn: () => VehiclesApi.list({ page_size: 200 }) });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<RentPaymentForm>({
    defaultValues: buildDefaultValues(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const vehiclesById = useMemo(() => {
    const dictionary: Record<string, { plate?: string; label: string }> = {};
    vehiclesQuery.data?.items.forEach((vehicle) => {
      const label = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || vehicle.model || vehicle.make || vehicle.id;
      dictionary[vehicle.id] = { plate: vehicle.plate, label };
    });
    return dictionary;
  }, [vehiclesQuery.data]);

  const watchedRentalId = watch('rental_id');
  const watchedWeeklyRate = watch('weekly_rate', 0);
  const watchedWeeks = watch('weeks', 1);
  const watchedPeriodStart = watch('period_start');
  const watchedPeriodEnd = watch('period_end');
  const projectedDue = (watchedWeeklyRate || 0) * (watchedWeeks || 1);

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  useEffect(() => {
    if (!watchedRentalId) {
      setValue('weekly_rate', 0, { shouldValidate: true });
      return;
    }
    if (editingId) {
      return;
    }
    const rental = rentalsQuery.data?.items.find((item) => item.id === watchedRentalId);
    const weekly = rental ? Number(rental.weekly_rate || 0) : 0;
    setValue('weekly_rate', weekly, { shouldValidate: true });
  }, [watchedRentalId, rentalsQuery.data, setValue, editingId]);

  useEffect(() => {
    if (!watchedPeriodStart || !watchedPeriodEnd) {
      return;
    }
    const start = new Date(watchedPeriodStart);
    const end = new Date(watchedPeriodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }
    const diffDays = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000)) + 1;
    const computedWeeks = Math.max(1, Math.ceil(diffDays / 7));
    setValue('weeks', computedWeeks, { shouldValidate: true });
  }, [watchedPeriodStart, watchedPeriodEnd, setValue]);

  const createPayment = useMutation({
    mutationFn: (payload: Partial<RentPayment>) => RentPaymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-payments'] });
      handleResetForm();
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RentPayment> }) => RentPaymentsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-payments'] });
      handleResetForm();
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) => RentPaymentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rent-payments'] }),
  });

  const runBilling = useMutation({
    mutationFn: () => BillingApi.run(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rent-payments'] }),
  });

  const handleEdit = (payment: RentPayment) => {
    setEditingId(payment.id);
    reset({
      rental_id: payment.rental_id,
      period_start: payment.period_start,
      period_end: payment.period_end,
      weekly_rate: Number(payment.weekly_rate ?? 0),
      weeks: payment.weeks ?? 1,
      paid_amount: Number(payment.paid_amount ?? 0),
      payment_date: payment.payment_date ?? '',
      late_fee: Number(payment.late_fee ?? 0),
      method: payment.method ?? '',
      notes: payment.notes ?? '',
    });
  };

  const onSubmit = (data: RentPaymentForm) => {
    const weeks = data.weeks > 0 ? data.weeks : 1;
    const dueAmount = data.weekly_rate * weeks;
    const payload: Partial<RentPayment> = {
      rental_id: data.rental_id,
      period_start: data.period_start,
      period_end: data.period_end,
      weekly_rate: data.weekly_rate.toString(),
      weeks,
      due_amount: dueAmount.toString(),
      paid_amount: (data.paid_amount ?? 0).toString(),
      payment_date: data.payment_date || undefined,
      late_fee: (data.late_fee ?? 0).toString(),
      method: data.method,
      notes: data.notes,
    };

    if (editingId) {
      updatePayment.mutate({ id: editingId, payload });
    } else {
      createPayment.mutate(payload);
    }
  };

  const isSaving = createPayment.isPending || updatePayment.isPending;
  const isEditing = Boolean(editingId);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Cobranças de aluguel</h1>
          <p className="text-sm text-slate-500">Gere faturas semanais, registre pagamentos e acompanhe saldos.</p>
        </div>
        <button
          onClick={() => runBilling.mutate()}
          className="rounded-md border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
        >
          {runBilling.isPending ? 'Gerando...' : 'Gerar cobranças do dia'}
        </button>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar cobrança' : 'Novo lançamento'}</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Contrato</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('rental_id', { required: true })}>
              <option value="">Selecione...</option>
              {rentalsQuery.data?.items.map((rental) => {
                const vehicleInfo = vehiclesById[rental.vehicle_id];
                const displayPlate = vehicleInfo?.plate ? vehicleInfo.plate.toUpperCase() : rental.vehicle_id;
                const displayLabel = vehicleInfo?.label ?? rental.vehicle_id;

                return (
                  <option key={rental.id} value={rental.id}>
                    {displayPlate} — {displayLabel}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Início</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('period_start', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Fim</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('period_end', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Semanal (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('weekly_rate', { valueAsNumber: true, required: true, min: 0 })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Semanas</label>
            <input
              type="number"
              min={1}
              readOnly
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
              {...register('weeks', { valueAsNumber: true, required: true, min: 1 })}
            />
            <p className="mt-1 text-xs text-slate-400">Calculado automaticamente pelo período informado.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor devido</label>
            <input
              readOnly
              value={projectedDue ? formatCurrency(projectedDue) : ''}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-400">Calculado automaticamente (semanas x semanal).</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Pago (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('paid_amount', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data do pagamento</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('payment_date')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Multa (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('late_fee', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Forma pagamento</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('method')} />
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
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar cobrança' : 'Registrar cobrança'}
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
            {createPayment.isError ? (
              <span className="text-sm text-red-600">{String(createPayment.error)}</span>
            ) : null}
            {updatePayment.isError ? (
              <span className="text-sm text-red-600">{String(updatePayment.error)}</span>
            ) : null}
            {createPayment.isSuccess && !isEditing ? (
              <span className="text-sm text-emerald-600">Cobrança registrada!</span>
            ) : null}
            {updatePayment.isSuccess && isEditing ? (
              <span className="text-sm text-emerald-600">Cobrança atualizada!</span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Lançamentos</h2>
        {paymentsQuery.isLoading ? (
          <Loading label="Carregando cobranças..." />
        ) : paymentsQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar cobranças.</div>
        ) : (
          <DataTable<RentPayment>
            data={paymentsQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Contrato', key: 'rental_id' },
              { header: 'Semanas', key: 'weeks' },
              {
                header: 'Devido',
                key: 'due_amount',
                render: (item) => formatCurrency(item.due_amount),
              },
              {
                header: 'Saldo',
                key: 'balance',
                render: (item) => formatCurrency(item.balance),
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
                        if (confirm('Excluir cobrança?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deletePayment.mutate(item.id);
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

export default RentPayments;
