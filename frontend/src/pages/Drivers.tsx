import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { DriversApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { DocumentManager } from '../components/DocumentManager';
import { Loading } from '../components/Loading';
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

const Drivers: React.FC = () => {
  const queryClient = useQueryClient();
  const driversQuery = useQuery({ queryKey: ['drivers'], queryFn: () => DriversApi.list() });
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverName, setSelectedDriverName] = useState<string>('');
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm<DriverForm>({
    defaultValues: {
      start_date: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
    },
  });

  const createDriver = useMutation({
    mutationFn: (payload: Partial<Driver>) => DriversApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      reset({
        start_date: new Date().toISOString().slice(0, 10),
        status: 'ACTIVE',
      });
      setSelectedDriverId(null);
      setSelectedDriverName('');
      setDocumentsOpen(false);
    },
  });

  const deleteDriver = useMutation({
    mutationFn: (id: string) => DriversApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const onSubmit = (data: DriverForm) => {
    createDriver.mutate({
      ...data,
      weekly_rate: data.weekly_rate.toString(),
      commission_pct: data.commission_pct.toString(),
      deposit_held: data.deposit_held.toString(),
    });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Motoristas</h1>
        <p className="text-sm text-slate-500">Cadastre e acompanhe motoristas parceiros.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Novo motorista</h2>
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
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('weekly_rate', { valueAsNumber: true, required: true })} />
          </div>
          {/* <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Comissao (%)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('commission_pct', { valueAsNumber: true, required: true })} />
          </div> */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Caucao (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('deposit_held', { valueAsNumber: true, required: true })} />
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
          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={createDriver.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {createDriver.isPending ? 'Salvando...' : 'Adicionar motorista'}
            </button>
          </div>
        </form>
      </section>

      <DocumentManager
        entityType="driver"
        entityId={selectedDriverId}
        isOpen={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title={selectedDriverId ? `Documentos de ${selectedDriverName}` : 'Documentos do motorista'}
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
                  <div className="flex gap-2">
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
                        if (confirm(`Excluir motorista ${item.name}?`)) {
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
