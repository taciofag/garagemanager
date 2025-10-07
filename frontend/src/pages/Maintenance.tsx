import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';

import { MaintenanceApi, VehiclesApi, VendorsApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import type {
  MaintenanceCategory,
  MaintenanceFrequency,
  MaintenanceStatus,
  Vehicle,
  VehicleMaintenanceTask,
  Vendor,
} from '../types';
import { useAuth } from '../context/AuthContext';

interface MaintenanceForm {
  vehicle_id: string;
  title: string;
  category: MaintenanceCategory;
  frequency?: MaintenanceFrequency;
  due_date?: string;
  odometer_due?: number;
  amount?: number;
  notes?: string;
  vendor_id?: string;
}

const CATEGORY_OPTIONS: Array<{ value: MaintenanceCategory; label: string }> = [
  { value: 'INSURANCE', label: 'Seguro' },
  { value: 'TRACKER', label: 'Rastreador' },
  { value: 'OIL_CHANGE', label: 'Troca de óleo' },
  { value: 'TIRES', label: 'Pneus' },
  { value: 'IPVA', label: 'IPVA / licenciamento' },
  { value: 'INSPECTION', label: 'Vistoria / inspeção' },
  { value: 'SERVICE', label: 'Revisão / serviço' },
  { value: 'OTHER', label: 'Outro' },
];

const FREQUENCY_OPTIONS: Array<{ value: MaintenanceFrequency; label: string }> = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'ANNUAL', label: 'Anual' },
  { value: 'KILOMETER', label: 'Por quilometragem' },
  { value: 'ON_DEMAND', label: 'Sob demanda' },
];

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  OPEN: 'Aberto',
  COMPLETED: 'Concluído',
  SKIPPED: 'Ignorado',
};

const STATUS_TONE: Record<MaintenanceStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  SKIPPED: 'bg-slate-50 text-slate-500 border border-slate-200',
};

const formatCurrency = (value: number | string | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));

const buildDefaultFormValues = (): MaintenanceForm => ({
  vehicle_id: '',
  title: '',
  category: 'SERVICE',
  frequency: undefined,
  due_date: '',
  odometer_due: undefined,
  amount: undefined,
  notes: '',
  vendor_id: '',
});

const Maintenance: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState<{
    status?: MaintenanceStatus;
    category?: MaintenanceCategory;
    vehicle_id?: string;
    vendor_id?: string;
    onlyOverdue?: boolean;
  }>({ status: 'OPEN' });

  const maintenanceQuery = useQuery({
    queryKey: ['maintenance', filters],
    queryFn: () =>
      MaintenanceApi.list({
        page: 1,
        page_size: 200,
        status: filters.status,
        category: filters.category,
        vehicle_id: filters.vehicle_id,
        vendor_id: filters.vendor_id,
        upcoming_until: filters.onlyOverdue ? new Date().toISOString().slice(0, 10) : undefined,
      }),
  });

  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'maintenance'], queryFn: () => VehiclesApi.list({ page_size: 200 }) });
  const vendorsQuery = useQuery({ queryKey: ['vendors', 'maintenance'], queryFn: () => VendorsApi.list({ page_size: 200 }) });

  const { register, handleSubmit, reset, formState } = useForm<MaintenanceForm>({
    defaultValues: buildDefaultFormValues(),
  });

  const createTask = useMutation({
    mutationFn: (payload: Partial<VehicleMaintenanceTask>) => MaintenanceApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      reset(buildDefaultFormValues());
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<VehicleMaintenanceTask> }) => MaintenanceApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  });

  const completeTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MaintenanceStatus }) =>
      MaintenanceApi.complete(id, {
        status,
        completed_at: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => MaintenanceApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  });

  const isSaving = createTask.isPending;

  const tasks = maintenanceQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];

  const vehiclesById = useMemo(() => {
    const map = new Map<string, Vehicle>();
    vehicles.forEach((vehicle) => map.set(vehicle.id, vehicle));
    return map;
  }, [vehicles]);

  const vendors = vendorsQuery.data?.items ?? [];
  const vendorsById = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((vendor) => map.set(vendor.id, vendor));
    return map;
  }, [vendors]);

  const overdueCount = useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => {
      if (task.status !== 'OPEN' || !task.due_date) {
        return false;
      }
      const due = parseISO(task.due_date);
      return isBefore(due, now);
    }).length;
  }, [tasks]);

  const monthlyPlanned = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((task) => task.due_date && task.status === 'OPEN' && parseISO(task.due_date).getMonth() === now.getMonth())
      .reduce((acc, task) => acc + Number(task.amount ?? 0), 0);
  }, [tasks]);

  const completedThisMonth = useMemo(() => {
    const now = new Date();
    return tasks
      .filter((task) => task.completed_at && parseISO(task.completed_at).getMonth() === now.getMonth())
      .reduce((acc, task) => acc + Number(task.amount ?? 0), 0);
  }, [tasks]);

  const onSubmit = (data: MaintenanceForm) => {
    const frequencyValue = data.frequency && data.frequency !== '' ? data.frequency : undefined;
    const payload: Partial<VehicleMaintenanceTask> = {
      vehicle_id: data.vehicle_id,
      title: data.title,
      category: data.category,
      frequency: frequencyValue,
      due_date: data.due_date || undefined,
      odometer_due: data.odometer_due,
      amount: data.amount != null ? data.amount.toString() : undefined,
      notes: data.notes || undefined,
      vendor_id: data.vendor_id || undefined,
    };
    createTask.mutate(payload);
  };

  const handleStatusChange = (task: VehicleMaintenanceTask, status: MaintenanceStatus) => {
    if (status === 'OPEN') {
      if (!isAdmin) return;
      updateTask.mutate({ id: task.id, payload: { status: 'OPEN', completed_at: null } });
      return;
    }
    if (!isAdmin) return;
    completeTask.mutate({ id: task.id, status });
  };

  const makeVehicleLabel = (vehicleId: string) => {
    const vehicle = vehiclesById.get(vehicleId);
    if (!vehicle) {
      return vehicleId;
    }
    const parts = [vehicle.plate?.toUpperCase(), vehicle.make, vehicle.model].filter(Boolean);
    return parts.join(' · ') || vehicleId;
  };

  const vendorLabel = (vendorId?: string, fallbackName?: string) => {
    if (!vendorId) {
      return fallbackName ?? '—';
    }
    const vendor = vendorsById.get(vendorId);
    return vendor?.name ?? fallbackName ?? vendorId;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenções e recorrências"
        description="Cadastre despesas recorrentes (seguro, rastreador, revisões) e deixe o sistema gerar os próximos vencimentos automaticamente."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700">Visão rápida</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Tarefas abertas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{tasks.filter((task) => task.status === 'OPEN').length}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-600">Atrasadas</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{overdueCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Previsto este mês</p>
            <p className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(monthlyPlanned)}</p>
            <p className="text-xs text-emerald-600">Já pago: {formatCurrency(completedThisMonth)}</p>
          </div>
        </div>
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-700">Nova recorrência / manutenção</h2>
            <button
              type="button"
              onClick={() => reset(buildDefaultFormValues())}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Limpar formulário
            </button>
          </div>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('vehicle_id', { required: true })}>
                <option value="">Selecione...</option>
                {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {makeVehicleLabel(vehicle.id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Título</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('title', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('category', { required: true })}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Frequência</label>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('frequency', {
                setValueAs: (value) => (value ? (value as MaintenanceFrequency) : undefined),
              })}
            >
              <option value="">Sob demanda</option>
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data prevista</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('due_date')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">KM prevista</label>
            <input type="number" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('odometer_due', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor estimado (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('amount', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('vendor_id')}>
              <option value="">Selecione...</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</label>
            <textarea className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" rows={2} {...register('notes')} />
          </div>
          <div className="md:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
            >
              {isSaving ? 'Salvando...' : 'Registrar manutenção'}
            </button>
            {formState.errors.vehicle_id ? (
              <span className="text-xs text-red-600">Selecione um veículo.</span>
            ) : null}
            {createTask.isError ? (
              <span className="text-xs text-red-600">{String(createTask.error)}</span>
            ) : null}
            {createTask.isSuccess ? <span className="text-xs text-emerald-600">Manutenção registrada!</span> : null}
          </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Planilha de manutenção</h2>
            <p className="text-xs text-slate-500">Filtre por status, veículo ou categoria para acompanhar os gastos contínuos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value ? (event.target.value as MaintenanceStatus) : undefined,
                }))
              }
            >
              <option value="">Todos os status</option>
              <option value="OPEN">Abertos</option>
              <option value="COMPLETED">Concluídos</option>
              <option value="SKIPPED">Ignorados</option>
            </select>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.category ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  category: event.target.value ? (event.target.value as MaintenanceCategory) : undefined,
                }))
              }
            >
              <option value="">Todas as categorias</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.vendor_id ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  vendor_id: event.target.value || undefined,
                }))
              }
            >
              <option value="">Todos os fornecedores</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.vehicle_id ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  vehicle_id: event.target.value || undefined,
                }))
              }
            >
              <option value="">Todos os veículos</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {makeVehicleLabel(vehicle.id)}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={Boolean(filters.onlyOverdue)}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    onlyOverdue: event.target.checked || undefined,
                  }))
                }
              />
              <span>Somente vencidos</span>
            </label>
          </div>
        </div>

        {maintenanceQuery.isLoading ? (
          <Loading label="Carregando manutenções..." />
        ) : maintenanceQuery.isError ? (
          <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Erro ao carregar manutenções.</div>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              O sistema mantém cada série recorrente com até 12 meses de antecedência. Ao registrar o pagamento, a próxima parcela é criada automaticamente.
            </p>
          <DataTable<VehicleMaintenanceTask>
            data={tasks}
            columns={[
              { header: 'ID', key: 'id' },
              {
                header: 'Veículo',
                key: 'vehicle_id',
                render: (item) => makeVehicleLabel(item.vehicle_id),
              },
              { header: 'Título', key: 'title' },
              {
                header: 'Categoria',
                key: 'category',
                render: (item) => CATEGORY_OPTIONS.find((option) => option.value === item.category)?.label ?? item.category,
              },
              {
                header: 'Fornecedor',
                key: 'vendor',
                render: (item) => vendorLabel(item.vendor_id, item.vendor_name),
              },
              {
                header: 'Previsto',
                key: 'due_date',
                render: (item) =>
                  item.due_date ? format(parseISO(item.due_date), 'dd/MM/yyyy') : item.odometer_due ? `${item.odometer_due} km` : '—',
              },
              {
                header: 'Frequência',
                key: 'frequency',
                render: (item) =>
                  item.frequency
                    ? FREQUENCY_OPTIONS.find((option) => option.value === item.frequency)?.label ?? item.frequency
                    : 'Sob demanda',
              },
              {
                header: 'Valor',
                key: 'amount',
                render: (item) => formatCurrency(item.amount),
              },
              {
                header: 'Status',
                key: 'status',
                render: (item) => (
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_TONE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                ),
              },
              {
                header: 'Ações',
                key: 'actions',
                render: (item) => (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {isAdmin && item.status !== 'COMPLETED' ? (
                      <button
                        className="rounded-md border border-emerald-300 px-2 py-1 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => handleStatusChange(item, 'COMPLETED')}
                      >
                        Registrar pagamento
                      </button>
                    ) : null}
                    {isAdmin && item.status === 'COMPLETED' ? (
                      <button
                        className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
                        onClick={() => handleStatusChange(item, 'OPEN')}
                      >
                        Reabrir
                      </button>
                    ) : null}
                    {isAdmin && item.status === 'OPEN' ? (
                      <button
                        className="rounded-md border border-amber-200 px-2 py-1 text-amber-600 hover:bg-amber-50"
                        onClick={() => handleStatusChange(item, 'SKIPPED')}
                      >
                        Ignorar
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button
                      className="rounded-md border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Remover manutenção?')) {
                          deleteTask.mutate(item.id);
                        }
                      }}
                    >
                      Excluir
                    </button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          </>
        )}
      </section>
    </div>
  );
};

export default Maintenance;
