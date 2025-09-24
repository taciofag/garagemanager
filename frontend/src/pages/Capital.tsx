import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { CapitalApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { CapitalEntry } from '../types';
import { capitalTypeLabel } from '../utils/labels';

interface CapitalForm {
  partner: string;
  date: string;
  type: CapitalEntry['type'];
  amount: number;
  notes?: string;
}

const Capital: React.FC = () => {
  const queryClient = useQueryClient();
  const capitalQuery = useQuery({ queryKey: ['capital'], queryFn: () => CapitalApi.list() });
  const { register, handleSubmit, reset } = useForm<CapitalForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10), type: 'Contribution' },
  });

  const createEntry = useMutation({
    mutationFn: (payload: Partial<CapitalEntry>) => CapitalApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital'] });
      reset({ date: new Date().toISOString().slice(0, 10), type: 'Contribution' });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => CapitalApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['capital'] }),
  });

  const onSubmit = (data: CapitalForm) => {
    createEntry.mutate({ ...data, amount: data.amount.toString() });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Movimentações de capital</h1>
        <p className="text-sm text-slate-500">Controle aportes e retiradas de sócios.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Novo lançamento</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Sócio</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('partner', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('date', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('type', { required: true })}>
              <option value="Contribution">Aporte</option>
              <option value="Withdrawal">Retirada</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true })} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('notes')} />
          </div>
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={createEntry.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createEntry.isPending ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Histórico</h2>
        {capitalQuery.isLoading ? (
          <Loading label="Carregando capital..." />
        ) : capitalQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar histórico.</div>
        ) : (
          <DataTable<CapitalEntry>
            data={capitalQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Sócio', key: 'partner' },
              {
                header: 'Tipo',
                key: 'type',
                render: (item) => capitalTypeLabel(item.type),
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
                  <button
                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Excluir lançamento ${item.id}?`)) {
                        deleteEntry.mutate(item.id);
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

export default Capital;
