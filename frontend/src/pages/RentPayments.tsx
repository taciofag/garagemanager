import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { BillingApi, RentPaymentsApi, RentalsApi } from '../api/resources';
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
  late_fee?: number;
  method?: string;
  notes?: string;
}

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const RentPayments: React.FC = () => {
  const queryClient = useQueryClient();
  const paymentsQuery = useQuery({ queryKey: ['rent-payments'], queryFn: () => RentPaymentsApi.list() });
  const rentalsQuery = useQuery({ queryKey: ['rentals', 'select'], queryFn: () => RentalsApi.list({ page_size: 100 }) });

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<RentPaymentForm>({
    defaultValues: {
      period_start: new Date().toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      weeks: 1,
    },
  });

  const watchedWeeklyRate = watch('weekly_rate', 0);
  const watchedWeeks = watch('weeks', 1);
  const projectedDue = (watchedWeeklyRate || 0) * (watchedWeeks || 1);

  const createPayment = useMutation({
    mutationFn: (payload: Partial<RentPayment>) => RentPaymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-payments'] });
      reset({
        rental_id: '',
        period_start: new Date().toISOString().slice(0, 10),
        period_end: new Date().toISOString().slice(0, 10),
        weekly_rate: 0,
        weeks: 1,
        paid_amount: 0,
        late_fee: 0,
        method: '',
        notes: '',
      });
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

  const onSubmit = (data: RentPaymentForm) => {
    const weeks = data.weeks > 0 ? data.weeks : 1;
    const dueAmount = data.weekly_rate * weeks;
    createPayment.mutate({
      rental_id: data.rental_id,
      period_start: data.period_start,
      period_end: data.period_end,
      weekly_rate: data.weekly_rate.toString(),
      weeks,
      due_amount: dueAmount.toString(),
      paid_amount: (data.paid_amount ?? 0).toString(),
      late_fee: (data.late_fee ?? 0).toString(),
      method: data.method,
      notes: data.notes,
    });
  };

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
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Novo lançamento</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Contrato</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('rental_id', { required: true })}>
              <option value="">Selecione...</option>
              {rentalsQuery.data?.items.map((rental) => (
                <option key={rental.id} value={rental.id}>
                  {rental.id} - {rental.vehicle_id}
                </option>
              ))}
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
            <input type="number" min={1} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('weeks', { valueAsNumber: true, required: true, min: 1 })} />
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
          <div className="md:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={createPayment.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createPayment.isPending ? 'Salvando...' : 'Registrar cobrança'}
            </button>
            {createPayment.isError ? (
              <span className="text-sm text-red-600">{String(createPayment.error)}</span>
            ) : null}
            {createPayment.isSuccess ? (
              <span className="text-sm text-emerald-600">Cobrança registrada!</span>
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
                  <button
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Excluir cobrança ${item.id}?`)) {
                        deletePayment.mutate(item.id);
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

export default RentPayments;
