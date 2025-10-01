import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { DriversApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { DocumentManager } from '../components/DocumentManager';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import type { Driver } from '../types';
import { driverStatusLabel, driverStatusOptions } from '../utils/labels';

interface DriverForm {
  name: string;
  cpf: string;
  phone?: string;
  start_date: string;
  weekly_rate: number;
  commission_pct: number;
  deposit_held: number;
  status: Driver['status'];
  notes?: string;
}

const buildDefaultValues = (): DriverForm => ({
  name: '',
  cpf: '',
  phone: '',
  start_date: new Date().toISOString().slice(0, 10),
  weekly_rate: 0,
  commission_pct: 0,
  deposit_held: 0,
  status: 'ACTIVE',
  notes: '',
});

const Drivers: React.FC = () => {
  const queryClient = useQueryClient();
  const driversQuery = useQuery({ queryKey: ['drivers'], queryFn: () => DriversApi.list() });
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<DriverForm>({
    defaultValues: buildDefaultValues(),
  });

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  const createDriver = useMutation({
    mutationFn: (payload: Partial<Driver>) => DriversApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      handleResetForm();
      setSelectedDriverId(null);
      setSelectedDriverName('');
      setDocumentsOpen(false);
    },
  });

  const updateDriver = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Driver> }) => DriversApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      handleResetForm();
    },
  });

  const deleteDriver = useMutation({
    mutationFn: (id: string) => DriversApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const handleEdit = (driver: Driver) => {
    setEditingId(driver.id);
    reset({
      name: driver.name,
      cpf: driver.cpf,
      phone: driver.phone ?? '',
      start_date: driver.start_date,
      weekly_rate: Number(driver.weekly_rate ?? 0),
      commission_pct: Number(driver.commission_pct ?? 0),
      deposit_held: Number(driver.deposit_held ?? 0),
      status: driver.status,
      notes: driver.notes ?? '',
    });
  };

  const onSubmit = (data: DriverForm) => {
    const payload: Partial<Driver> = {
      name: data.name,
      cpf: data.cpf,
      phone: data.phone,
      start_date: data.start_date,
      weekly_rate: data.weekly_rate.toString(),
      commission_pct: (data.commission_pct ?? 0).toString(),
      deposit_held: (data.deposit_held ?? 0).toString(),
      status: data.status,
      notes: data.notes,
    };

    if (editingId) {
      updateDriver.mutate({ id: editingId, payload });
    } else {
      createDriver.mutate(payload);
    }
  };

  const isSaving = createDriver.isPending || updateDriver.isPending;
  const isEditing = Boolean(editingId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Cadastre e acompanhe motoristas parceiros."
        variant="soft"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar motorista' : 'Novo motorista'}</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('name', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">CPF</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('cpf', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Telefone</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('phone')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Início contrato</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('start_date', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Semanal (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('weekly_rate', { valueAsNumber: true, required: true, min: 0 })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Caução (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('deposit_held', { valueAsNumber: true, required: true, min: 0 })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('status', { required: true })}>
              {driverStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Observações</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('notes')} />
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar motorista' : 'Adicionar motorista'}
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

      <DocumentManager
        entityType="driver"
        entityId={selectedDriverId}
        isOpen={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title={selectedDriverId ? `Documentos do motorista ${selectedDriverName || selectedDriverId}` : 'Documentos do motorista'}
        emptyMessage="Selecione um motorista para anexar documentos."
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Lista de motoristas</h2>
        {driversQuery.isLoading ? (
          <Loading label="Carregando motoristas..." />
        ) : driversQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar motoristas.</div>
        ) : (
          <DataTable<Driver>
            data={driversQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Nome', key: 'name' },
              { header: 'Telefone', key: 'phone' },
              {
                header: 'Status',
                key: 'status',
                render: (item) => driverStatusLabel(item.status),
              },
              {
                header: 'Semanal',
                key: 'weekly_rate',
                render: (item) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.weekly_rate)),
              },
              {
                header: 'Ações',
                key: 'actions',
                render: (item) => (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      onClick={() => handleEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        setSelectedDriverId(item.id);
                        setSelectedDriverName(item.name);
                        setDocumentsOpen(true);
                      }}
                    >
                      Documentos
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Excluir motorista?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deleteDriver.mutate(item.id);
                          if (selectedDriverId === item.id) {
                            setSelectedDriverId(null);
                            setSelectedDriverName('');
                            setDocumentsOpen(false);
                          }
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

export default Drivers;
