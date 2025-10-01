import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';

import { CapitalApi, PartnersApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import type { CapitalEntry, Partner } from '../types';
import { capitalTypeLabel } from '../utils/labels';

interface CapitalForm {
  partner: string;
  date: string;
  type: CapitalEntry['type'];
  amount: number;
  notes?: string;
}

interface PartnerFormState {
  name: string;
  phone?: string;
  notes?: string;
}

const buildDefaultValues = (): CapitalForm => ({
  partner: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'Contribution',
  amount: 0,
  notes: '',
});

const emptyPartnerForm: PartnerFormState = {
  name: '',
  phone: '',
  notes: '',
};

const sanitizePartnerPayload = (values: PartnerFormState): Partial<Partner> => {
  const name = values.name.trim();
  const phone = (values.phone ?? '').trim();
  const notes = (values.notes ?? '').trim();

  return {
    name,
    phone: phone || undefined,
    notes: notes || undefined,
  };
};

const Capital: React.FC = () => {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, getValues } = useForm<CapitalForm>({
    defaultValues: buildDefaultValues(),
  });

  const capitalQuery = useQuery({ queryKey: ['capital'], queryFn: () => CapitalApi.list() });
  const partnersQuery = useQuery({ queryKey: ['partners'], queryFn: () => PartnersApi.list({ page_size: 200 }) });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPartnerManagerOpen, setPartnerManagerOpen] = useState(false);
  const [updatingPartnerId, setUpdatingPartnerId] = useState<string | null>(null);
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null);

  const partnerOptions = partnersQuery.data?.items ?? [];
  const selectedPartnerName = watch('partner');
  const partnerOptionsWithSelection = useMemo(() => {
    if (!selectedPartnerName) {
      return partnerOptions;
    }
    if (partnerOptions.some((item) => item.name === selectedPartnerName)) {
      return partnerOptions;
    }
    return [...partnerOptions, { id: selectedPartnerName, name: selectedPartnerName } as Partner];
  }, [partnerOptions, selectedPartnerName]);

  const createPartner = useMutation<Partner, Error, Partial<Partner>>({
    mutationFn: (payload: Partial<Partner>) => PartnersApi.create(payload),
    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setValue('partner', partner.name);
    },
  });

  const updatePartner = useMutation<Partner, Error, { id: string; payload: Partial<Partner>; originalName: string }>({
    mutationFn: ({ id, payload }) =>
      PartnersApi.update(id, payload),
    onSuccess: (_partner, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      if (variables.payload.name && getValues('partner') === variables.originalName) {
        setValue('partner', variables.payload.name);
      }
    },
  });

  const deletePartner = useMutation<void, Error, { id: string; name: string }>({
    mutationFn: ({ id }) => PartnersApi.remove(id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      if (getValues('partner') === variables.name) {
        setValue('partner', '');
      }
    },
  });

  const handleCreatePartner = async (values: PartnerFormState) => {
    const payload = sanitizePartnerPayload(values);
    if (!payload.name) {
      throw new Error('Informe o nome do sócio.');
    }
    await createPartner.mutateAsync(payload);
  };

  const handleUpdatePartner = async (partner: Partner, values: PartnerFormState) => {
    const payload = sanitizePartnerPayload(values);
    if (!payload.name) {
      throw new Error('Informe o nome do sócio.');
    }
    setUpdatingPartnerId(partner.id);
    try {
      await updatePartner.mutateAsync({ id: partner.id, payload, originalName: partner.name });
    } finally {
      setUpdatingPartnerId(null);
    }
  };

  const handleDeletePartner = async (partner: Partner) => {
    setDeletingPartnerId(partner.id);
    try {
      await deletePartner.mutateAsync({ id: partner.id, name: partner.name });
    } finally {
      setDeletingPartnerId(null);
    }
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
    <>
      <div className="space-y-6">
        <PageHeader
        title="Movimentações de capital"
        description="Controle aportes e retiradas de sócios."
        variant="soft"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Sócio</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
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
                <button
                  type="button"
                  onClick={() => setPartnerManagerOpen(true)}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Gerenciar sócios
                </button>
              </div>
              {partnersQuery.isError ? (
                <p className="mt-2 text-xs text-red-600">Erro ao carregar sócios.</p>
              ) : null}
              {partnerOptionsWithSelection.length === 0 && !partnersQuery.isLoading ? (
                <p className="mt-2 text-xs text-slate-500">Cadastre um sócio para liberar os lançamentos.</p>
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
                {isSaving ? 'Salvando...' : isEditing ? 'Atualizar lançamento' : 'Salvar lançamento'}
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
                          if (confirm('Excluir lançamento?')) {
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

      <PartnerManagerModal
        isOpen={isPartnerManagerOpen}
        onClose={() => setPartnerManagerOpen(false)}
        partners={partnerOptions}
        isLoading={partnersQuery.isLoading}
        onCreate={handleCreatePartner}
        onUpdate={handleUpdatePartner}
        onDelete={handleDeletePartner}
        createPending={createPartner.isPending}
        updatingPartnerId={updatingPartnerId}
        deletingPartnerId={deletingPartnerId}
      />
    </>
  );
};

interface PartnerManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  partners: Partner[];
  isLoading: boolean;
  onCreate: (values: PartnerFormState) => Promise<void>;
  onUpdate: (partner: Partner, values: PartnerFormState) => Promise<void>;
  onDelete: (partner: Partner) => Promise<void>;
  createPending: boolean;
  updatingPartnerId: string | null;
  deletingPartnerId: string | null;
}

const PartnerManagerModal: React.FC<PartnerManagerModalProps> = ({
  isOpen,
  onClose,
  partners,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  createPending,
  updatingPartnerId,
  deletingPartnerId,
}) => {
  const [createForm, setCreateForm] = useState<PartnerFormState>(emptyPartnerForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PartnerFormState>(emptyPartnerForm);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreateForm(emptyPartnerForm);
      setCreateError(null);
      setEditingId(null);
      setEditForm(emptyPartnerForm);
      setEditError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && !partners.some((partner) => partner.id === editingId)) {
      setEditingId(null);
      setEditForm(emptyPartnerForm);
    }
  }, [editingId, partners]);

  if (!isOpen) {
    return null;
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    try {
      await onCreate(createForm);
      setCreateForm(emptyPartnerForm);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Não foi possível criar o sócio.');
    }
  };

  const handleEditSave = async (partner: Partner) => {
    setEditError(null);
    try {
      await onUpdate(partner, editForm);
      setEditingId(null);
      setEditForm(emptyPartnerForm);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Não foi possível atualizar o sócio.');
    }
  };

  const handleDelete = async (partner: Partner) => {
    if (!confirm(`Excluir o sócio ${partner.name}?`)) {
      return;
    }
    setEditError(null);
    try {
      await onDelete(partner);
      if (editingId === partner.id) {
        setEditingId(null);
        setEditForm(emptyPartnerForm);
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Não foi possível excluir o sócio.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-700">Gerenciar sócios</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Adicionar sócio</h3>
              <p className="text-xs text-slate-500">Informe os dados abaixo para cadastrar um novo sócio.</p>
            </div>
            <form className="space-y-3" onSubmit={handleCreate}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome *</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    value={createForm.name}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</label>
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                    value={createForm.phone}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
                >
                  {createPending ? 'Adicionando...' : 'Adicionar sócio'}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Sócios cadastrados</h3>
              {isLoading ? <span className="text-xs text-slate-500">Carregando...</span> : null}
            </div>
            {partners.length === 0 && !isLoading ? (
              <p className="text-sm text-slate-500">Nenhum sócio cadastrado até o momento.</p>
            ) : (
              <div className="space-y-3">
                {partners.map((partner) => {
                  const isEditingPartner = editingId === partner.id;
                  const isUpdating = updatingPartnerId === partner.id;
                  const isDeleting = deletingPartnerId === partner.id;

                  return (
                    <div key={partner.id} className="rounded-lg border border-slate-200 p-4">
                      {isEditingPartner ? (
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nome *</label>
                              <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                                value={editForm.name}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</label>
                              <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                                value={editForm.phone}
                                onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
                            <textarea
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                              value={editForm.notes}
                              onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                            />
                          </div>
                          {editError ? <p className="text-xs text-red-600">{editError}</p> : null}
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm(emptyPartnerForm);
                                setEditError(null);
                              }}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditSave(partner)}
                              disabled={isUpdating}
                              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
                            >
                              {isUpdating ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-700">{partner.name}</p>
                            {partner.phone ? <p className="text-xs text-slate-500">Telefone: {partner.phone}</p> : null}
                            {partner.notes ? <p className="text-xs text-slate-500">Notas: {partner.notes}</p> : null}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditError(null);
                                setEditingId(partner.id);
                                setEditForm({
                                  name: partner.name,
                                  phone: partner.phone ?? '',
                                  notes: partner.notes ?? '',
                                });
                              }}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(partner)}
                              disabled={isDeleting}
                              className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-70"
                            >
                              {isDeleting ? 'Excluindo...' : 'Excluir'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Capital;
