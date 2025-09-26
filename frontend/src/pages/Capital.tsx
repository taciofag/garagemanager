import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { CapitalApi, PartnersApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import type { CapitalEntry, Partner } from '../types';
import { capitalTypeLabel } from '../utils/labels';

interface CapitalForm {
  partner: string;
  date: string;
  type: CapitalEntry['type'];
  amount: number;
  notes?: string;
}

const buildDefaultValues = (): CapitalForm => ({
  partner: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'Contribution',
  amount: 0,
  notes: '',
});

const Capital: React.FC = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch } = useForm<CapitalForm>({ defaultValues: buildDefaultValues() });
  const capitalQuery = useQuery({ queryKey: ['capital'], queryFn: () => CapitalApi.list() });
  const partnersQuery = useQuery({ queryKey: ['partners'], queryFn: () => PartnersApi.list({ page_size: 200 }) });
  const partnerOptions = partnersQuery.data?.items ?? [];
  const [newPartnerName, setNewPartnerName] = useState('');
  const createPartner = useMutation({
    mutationFn: (payload: Partial<Partner>) => PartnersApi.create(payload),
    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setValue('partner', partner.name);
      setNewPartnerName('');
    },
    onError: (error: Error) => {
      window.alert(error.message);
    },
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedPartnerName = watch('partner');
  const partnerOptionsWithSelection =
    selectedPartnerName && !partnerOptions.some((item) => item.name === selectedPartnerName)
      ? [...partnerOptions, { id: selectedPartnerName, name: selectedPartnerName } as Partner]
      : partnerOptions;

  const handleCreatePartner = () => {
    const trimmedName = newPartnerName.trim();
    if (!trimmedName || createPartner.isPending) {
      return;
    }
    createPartner.mutate({ name: trimmedName });
  };

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  const createEntry = useMutation({
    mutationFn: (payload: Partial<CapitalEntry>) => CapitalApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital'] });
      handleResetForm();
    },
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CapitalEntry> }) => CapitalApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital'] });
      handleResetForm();
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => CapitalApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['capital'] }),
  });

  const handleEdit = (entry: CapitalEntry) => {
    setEditingId(entry.id);
    reset({
      partner: entry.partner,
      date: entry.date,
      type: entry.type,
      amount: Number(entry.amount ?? 0),
      notes: entry.notes ?? '',
    });
  };

  const onSubmit = (data: CapitalForm) => {
    const payload: Partial<CapitalEntry> = {
      partner: data.partner,
      date: data.date,
      type: data.type,
      amount: data.amount.toString(),
      notes: data.notes,
    };

    if (editingId) {
      updateEntry.mutate({ id: editingId, payload });
    } else {
      createEntry.mutate(payload);
    }
  };

  const isSaving = createEntry.isPending || updateEntry.isPending;
  const isEditing = Boolean(editingId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Movimentações de capital</h1>
        <p className="text-sm text-slate-500">Controle aportes e retiradas de sócios.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Sócio</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('partner', { required: true })}
              disabled={partnersQuery.isLoading || partnerOptionsWithSelection.length === 0}
            >
              <option value="">{partnersQuery.isLoading ? 'Carregando sócios...' : 'Selecione um sócio'}</option>
              {partnerOptionsWithSelection.map((partner) => (
                <option key={partner.id} value={partner.name}>
                  {partner.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
              <input
                type="text"
                value={newPartnerName}
                onChange={(event) => setNewPartnerName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleCreatePartner();
                  }
                }}
                placeholder="Cadastrar novo sócio"
                className="w-full rounded-md border border-slate-300 px-3 py-2 md:w-auto"
              />
              <button
                type="button"
                onClick={handleCreatePartner}
                disabled={createPartner.isPending || !newPartnerName.trim()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-70"
              >
                {createPartner.isPending ? 'Adicionando...' : 'Adicionar sócio'}
              </button>
            </div>
            {partnersQuery.isError ? (
              <p className="mt-2 text-xs text-red-600">Erro ao carregar sócios.</p>
            ) : null}
            {partnerOptionsWithSelection.length === 0 && !partnersQuery.isLoading ? (
              <p className="mt-2 text-xs text-slate-500">Cadastre um sócio acima para liberar os lançamentos.</p>
            ) : null}
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
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true, required: true, min: 0 })} />
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
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar lanÃ§amento' : 'Salvar lanÃ§amento'}
            </button>
            {isEditing ? (
              <button
                type="button"
                onClick={handleResetForm}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar ediÃ§Ã£o
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">HistÃ³rico</h2>
        {capitalQuery.isLoading ? (
          <Loading label="Carregando capital..." />
        ) : capitalQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar histÃ³rico.</div>
        ) : (
          <DataTable<CapitalEntry>
            data={capitalQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'SÃ³cio', key: 'partner' },
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
                header: 'AÃ§Ãµes',
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
                        if (confirm('Excluir lanÃ§amento?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deleteEntry.mutate(item.id);
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

export default Capital;
