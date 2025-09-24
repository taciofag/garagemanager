import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { DriversApi, RentalsApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { DocumentManager } from '../components/DocumentManager';
import { Loading } from '../components/Loading';
import type { Rental } from '../types';
import { billingDayOptions, rentalStatusLabel } from '../utils/labels';

interface RentalForm {
  vehicle_id: string;
  driver_id: string;
  start_date: string;
  weekly_rate: number;
  deposit: number;
  billing_day: Rental['billing_day'];
  notes?: string;
}

const Rentals: React.FC = () => {
  const queryClient = useQueryClient();

  const rentalsQuery = useQuery({ queryKey: ['rentals'], queryFn: () => RentalsApi.list() });
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const [selectedRentalLabel, setSelectedRentalLabel] = useState<string>('');
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'all'],
    queryFn: () => VehiclesApi.list({ page_size: 100 }),
  });
  const driversQuery = useQuery({
    queryKey: ['drivers', 'all'],
    queryFn: () => DriversApi.list({ page_size: 100 }),
  });

  const { register, handleSubmit, reset } = useForm<RentalForm>({
    defaultValues: {
      start_date: new Date().toISOString().slice(0, 10),
      billing_day: 'Mon',
    },
  });

  const createRental = useMutation({
    mutationFn: (payload: Partial<Rental>) => RentalsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      reset({
        start_date: new Date().toISOString().slice(0, 10),
        billing_day: 'Mon',
      });
      setSelectedRentalId(null);
      setSelectedRentalLabel('');
      setDocumentsOpen(false);
    },
  });

  const closeRental = useMutation({
    mutationFn: ({ id, end_date }: { id: string; end_date: string }) => RentalsApi.close(id, { end_date }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rentals'] }),
  });

  const deleteRental = useMutation({
    mutationFn: (id: string) => RentalsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rentals'] }),
  });

  const onSubmit = (data: RentalForm) => {
    createRental.mutate({
      ...data,
      weekly_rate: data.weekly_rate.toString(),
      deposit: data.deposit.toString(),
    });
  };

  const isLoadingCatalogs = vehiclesQuery.isLoading || driversQuery.isLoading;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Contratos de aluguel</h1>
        <p className="text-sm text-slate-500">Controle a alocação de veículos para motoristas e gere cobranças semanais.</p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">Novo contrato</h2>
        {isLoadingCatalogs ? (
          <Loading label="Carregando catálogos..." />
        ) : (
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
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Motorista</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('driver_id', { required: true })}>
                <option value="">Selecione...</option>
                {driversQuery.data?.items.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data início</label>
              <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('start_date', { required: true })} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Semanal (R$)</label>
              <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('weekly_rate', { valueAsNumber: true, required: true })} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Depósito (R$)</label>
              <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('deposit', { valueAsNumber: true, required: true })} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Dia cobrança</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('billing_day', { required: true })}>
                {billingDayOptions.map((option) => (
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
                disabled={createRental.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
              >
                {createRental.isPending ? 'Salvando...' : 'Criar contrato'}
              </button>
            </div>
          </form>
        )}
      </section>

      <DocumentManager
        entityType="rental"
        entityId={selectedRentalId}
        isOpen={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title={selectedRentalId ? `Documentos do contrato ${selectedRentalLabel}` : 'Documentos do contrato'}
        emptyMessage="Selecione um contrato para anexar documentos."
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-700">Contratos registrados</h2>
        {rentalsQuery.isLoading ? (
          <Loading label="Carregando contratos..." />
        ) : rentalsQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar contratos.</div>
        ) : (
          <DataTable<Rental>
            data={rentalsQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Veículo', key: 'vehicle_id' },
              { header: 'Motorista', key: 'driver_id' },
              {

                header: 'Status',

                key: 'status',

                render: (item) => rentalStatusLabel(item.status),

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
                  <div className="flex gap-2 text-xs">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        setSelectedRentalId(item.id);
                        setSelectedRentalLabel(`${item.id} - ${item.vehicle_id}`);
                        setDocumentsOpen(true);
                      }}
                    >
                      Documentos
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        const end_date = prompt('Data de encerramento (YYYY-MM-DD):');
                        if (end_date) {
                          closeRental.mutate({ id: item.id, end_date });
                        }
                      }}
                    >
                      Encerrar
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Excluir contrato ${item.id}?`)) {
                          deleteRental.mutate(item.id);
                          if (selectedRentalId === item.id) {
                            setSelectedRentalId(null);
                            setSelectedRentalLabel('');
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

export default Rentals;
