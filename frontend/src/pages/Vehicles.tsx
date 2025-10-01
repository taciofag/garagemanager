import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import InputMask from 'react-input-mask';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { VehiclesApi } from '../api/resources';
import { DocumentManager } from '../components/DocumentManager';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { VehicleFinancialModal } from '../components/VehicleFinancialModal';
import { PageHeader } from '../components/PageHeader';
import type { Vehicle, VehicleFinancialSummary } from '../types';
import { vehicleStatusLabel } from '../utils/labels';

interface VehicleForm {
  plate: string;
  renavam: string;
  vin: string;
  manufacture_year: number;
  model_year: number;
  make: string;
  model: string;
  color?: string;
  acquisition_date: string;
  acquisition_price: number;
  notes?: string;
}

const defaultFormValues: VehicleForm = {
  plate: '',
  renavam: '',
  vin: '',
  manufacture_year: new Date().getFullYear() - 1,
  model_year: new Date().getFullYear(),
  make: '',
  model: '',
  color: '',
  acquisition_date: format(new Date(), 'yyyy-MM-dd'),
  acquisition_price: 0,
  notes: '',
};

const currency = (value: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

const sanitizePlate = (value: string) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
const sanitizeRenavam = (value: string) => value.replace(/\D/g, '');
const sanitizeVin = (value: string) => value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
const formatPlateForMask = (value: string | undefined) => {
  if (!value) return '';
  const sanitized = sanitizePlate(value);
  const match = sanitized.match(/^([A-Z]{3})([0-9])([A-Z0-9])([0-9]{2})$/);
  return match ? `${match[1]}-${match[2]}${match[3]}${match[4]}` : value;
};

const Vehicles: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedVehicleLabel, setSelectedVehicleLabel] = useState<string>('');
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [financialOpen, setFinancialOpen] = useState(false);
  const [financialVehicleId, setFinancialVehicleId] = useState<string | null>(null);

  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: () => VehiclesApi.list() });
  const financialQuery = useQuery({
    queryKey: ['vehicle-financial', financialVehicleId],
    queryFn: () => VehiclesApi.financial(financialVehicleId as string),
    enabled: Boolean(financialVehicleId),
  });

  useEffect(() => {
    if (financialVehicleId) {
      setFinancialOpen(true);
    } else {
      setFinancialOpen(false);
    }
  }, [financialVehicleId]);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleForm>({
    defaultValues: defaultFormValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const createVehicle = useMutation({
    mutationFn: (payload: Partial<Vehicle>) => VehiclesApi.create(payload),
  });
  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Vehicle> }) => VehiclesApi.update(id, payload),
  });
  const deleteVehicle = useMutation({
    mutationFn: (id: string) => VehiclesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });
  const sellVehicle = useMutation({
    mutationFn: ({ id, sale_date, sale_price, sale_fees }: { id: string; sale_date: string; sale_price: string; sale_fees: string }) =>
      VehiclesApi.sell(id, { sale_date, sale_price, sale_fees }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const resetForm = (values?: Partial<VehicleForm>) => {
    reset({ ...defaultFormValues, ...values });
  };

  const onSubmit = async (data: VehicleForm) => {
    const currentEditingId = editingId;
    const wasDocumentsOpen = documentsOpen;
    const payload: Partial<Vehicle> = {
      plate: sanitizePlate(data.plate),
      renavam: sanitizeRenavam(data.renavam),
      vin: sanitizeVin(data.vin),
      manufacture_year: data.manufacture_year,
      model_year: data.model_year,
      make: data.make.trim(),
      model: data.model.trim(),
      color: data.color?.trim() || undefined,
      acquisition_date: data.acquisition_date,
      acquisition_price: Number(data.acquisition_price || 0).toFixed(2),
      notes: data.notes?.trim() || undefined,
    };

    try {
      setFormError(null);
      setFormSuccess(null);

      if (editingId) {
        await updateVehicleMutation.mutateAsync({ id: editingId, payload });
        setFormSuccess('Veículo atualizado com sucesso!');
      } else {
        await createVehicle.mutateAsync(payload);
        setFormSuccess('Veículo cadastrado com sucesso!');
      }

      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setEditingId(null);
      if (currentEditingId) {
        if (wasDocumentsOpen) {
          setSelectedVehicleId(currentEditingId);
          setSelectedVehicleLabel(`${currentEditingId} - ${payload.model ?? data.model}`);
        }
      } else {
        setSelectedVehicleId(null);
        setSelectedVehicleLabel('');
        setDocumentsOpen(false);
      }
      resetForm();
    } catch (error) {
      setFormError((error as Error).message);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicleLabel(`${vehicle.id} - ${vehicle.model}`);
    setFormError(null);
    setFormSuccess(null);
    resetForm({
      plate: formatPlateForMask(vehicle.plate),
      renavam: vehicle.renavam,
      vin: vehicle.vin,
      manufacture_year: vehicle.manufacture_year,
      model_year: vehicle.model_year,
      make: vehicle.make,
      model: vehicle.model,
      color: vehicle.color ?? '',
      acquisition_date: vehicle.acquisition_date ?? format(new Date(), 'yyyy-MM-dd'),
      acquisition_price: Number(vehicle.acquisition_price ?? 0),
      notes: vehicle.notes ?? '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormError(null);
    setFormSuccess(null);
    resetForm();
  };

  const isSubmitting = createVehicle.isPending || updateVehicleMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Cadastre novos veículos, acompanhe status e realize vendas."
        variant="soft"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">{editingId ? 'Editar veículo' : 'Novo veículo'}</h2>
          {editingId ? (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancelar edio
            </button>
          ) : null}
        </div>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Placa</label>
            <Controller
              name="plate"
              control={control}
              rules={{
                required: 'Informe a placa',
                validate: (value) =>
                  /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(sanitizePlate(value || '')) || 'Placa invlida (padro Mercosul)',
              }}
              render={({ field }) => (
                <InputMask
                  {...field}
                  value={field.value ?? ''}
                  mask="aaa-9a99"
                  maskChar=""
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            />
            {errors.plate ? <p className="mt-1 text-xs text-red-600">{errors.plate.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Renavam</label>
            <Controller
              name="renavam"
              control={control}
              rules={{
                required: 'Informe o renavam',
                validate: (value) => sanitizeRenavam(value || '').length === 11 || 'Renavam deve ter 11 dígitos',
              }}
              render={({ field }) => (
                <InputMask
                  {...field}
                  value={field.value ?? ''}
                  mask="99999999999"
                  maskChar=""
                  onChange={(event) => field.onChange(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            />
            {errors.renavam ? <p className="mt-1 text-xs text-red-600">{errors.renavam.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Chassi</label>
            <Controller
              name="vin"
              control={control}
              rules={{
                required: 'Informe o chassi',
                validate: (value) =>
                  /^[A-HJ-NPR-Z0-9]{17}$/.test(sanitizeVin(value || '')) || 'Chassi deve conter 17 caracteres (sem I, O, Q)',
              }}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            />
            {errors.vin ? <p className="mt-1 text-xs text-red-600">{errors.vin.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ano fabricação</label>
            <input
              type="number"
              min={1900}
              max={2100}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('manufacture_year', {
                required: 'Informe o ano de fabricação',
                valueAsNumber: true,
                min: { value: 1900, message: 'Ano mínimo 1900' },
                max: { value: 2100, message: 'Ano máximo 2100' },
              })}
            />
            {errors.manufacture_year ? (
              <p className="mt-1 text-xs text-red-600">{errors.manufacture_year.message}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Ano modelo</label>
            <input
              type="number"
              min={1900}
              max={2100}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('model_year', {
                required: 'Informe o ano do modelo',
                valueAsNumber: true,
                min: { value: 1900, message: 'Ano mínimo 1900' },
                max: { value: 2100, message: 'Ano máximo 2100' },
              })}
            />
            {errors.model_year ? <p className="mt-1 text-xs text-red-600">{errors.model_year.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Marca</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('make', { required: 'Informe a marca', setValueAs: (value) => (value ? String(value).trim() : '') })}
            />
            {errors.make ? <p className="mt-1 text-xs text-red-600">{errors.make.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Modelo</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('model', { required: 'Informe o modelo', setValueAs: (value) => (value ? String(value).trim() : '') })}
            />
            {errors.model ? <p className="mt-1 text-xs text-red-600">{errors.model.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Cor</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('color', { setValueAs: (value) => (value ? String(value).trim() : '') })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data de aquisição</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('acquisition_date', { required: 'Informe a data de aquisição' })}
            />
            {errors.acquisition_date ? <p className="mt-1 text-xs text-red-600">{errors.acquisition_date.message}</p> : null}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor de aquisição (R$)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('acquisition_price', {
                required: 'Informe o valor de aquisição',
                valueAsNumber: true,
                min: { value: 0, message: 'Valor deve ser positivo' },
              })}
            />
            {errors.acquisition_price ? <p className="mt-1 text-xs text-red-600">{errors.acquisition_price.message}</p> : null}
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Observações</label>
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              {...register('notes', { setValueAs: (value) => (value ? String(value).trim() : '') })}
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {isSubmitting ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar veículo'}
            </button>
            {formError ? <span className="text-sm text-red-600">{formError}</span> : null}
            {formSuccess ? <span className="text-sm text-emerald-600">{formSuccess}</span> : null}
          </div>
        </form>
      </section>

      <DocumentManager
        entityType="vehicle"
        entityId={selectedVehicleId}
        isOpen={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        title={selectedVehicleId ? `Documentos do veículo ${selectedVehicleLabel}` : 'Documentos do veículo'}
        emptyMessage="Selecione um veículo na tabela para anexar documentos."
      />

      <VehicleFinancialModal
        isOpen={financialOpen}
        onClose={() => setFinancialVehicleId(null)}
        data={financialQuery.data as VehicleFinancialSummary | undefined}
        isLoading={financialQuery.isLoading}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Veículos cadastrados</h2>
          <span className="text-xs uppercase tracking-wide text-slate-400">{vehiclesQuery.data?.total ?? 0} registros</span>
        </div>
        {vehiclesQuery.isLoading ? (
          <Loading label="Carregando veículos..." />
        ) : vehiclesQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar veículos.</div>
        ) : (
          <DataTable<Vehicle>
            data={vehiclesQuery.data?.items ?? []}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Placa', key: 'plate' },
              { header: 'Modelo', key: 'model' },
              { header: 'Ano fabr.', key: 'manufacture_year' },
              { header: 'Ano modelo', key: 'model_year' },
              {
                header: 'Status',
                key: 'status',
                render: (item) => vehicleStatusLabel(item.status),
              },
              {
                header: 'Total gasto',
                key: 'total_cost',
                render: (item) => currency(item.total_cost),
              },
              {
                header: 'Ações',
                key: 'actions',
                render: (item) => (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        setSelectedVehicleId(item.id);
                        setSelectedVehicleLabel(`${item.id} - ${item.model}`);
                        setDocumentsOpen(true);
                      }}
                    >
                      Documentos
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => setFinancialVehicleId(item.id)}
                    >
                      Resumo financeiro
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => handleEdit(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                      onClick={() => {
                        const sale_price = prompt('Valor de venda (R$):', item.sale_price ?? '');
                        const sale_date = prompt('Data da venda (YYYY-MM-DD):', format(new Date(), 'yyyy-MM-dd'));
                        const sale_fees = prompt('Custos da venda (R$):', item.sale_fees ?? '0');
                        if (sale_price && sale_date && sale_fees) {
                          sellVehicle.mutate({ id: item.id, sale_price, sale_date, sale_fees });
                        }
                      }}
                    >
                      Vender
                    </button>
                    <button
                      className="rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Remover veículo ${item.id}?`)) {
                          deleteVehicle.mutate(item.id);
                          if (selectedVehicleId === item.id) {
                            setSelectedVehicleId(null);
                            setSelectedVehicleLabel('');
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

export default Vehicles;

