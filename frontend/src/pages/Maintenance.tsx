import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfDay } from 'date-fns';

import { CashCategoriesApi, MaintenanceApi, VehiclesApi, VendorsApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useAuth } from '../context/AuthContext';
import type {
  MaintenanceActionResponse,
  MaintenanceOccurrence,
  MaintenanceOccurrenceStatus,
  MaintenanceOccurrencesResponse,
  MaintenanceFrequency,
  MaintenanceSeries,
  MaintenanceSeriesStatus,
  MaintenanceSummary,
  MaintenancePayRequest,
  Vehicle,
  Vendor,
} from '../types';

interface PaymentFormState {
  paidAt: string;
  note: string;
  cashCategoryId: string;
  paymentMethod: string;
}

type TabScope = 'upcoming' | 'overdue' | 'history';

interface FiltersState {
  status: MaintenanceOccurrenceStatus | 'all';
  vehicleId: string;
  supplierId: string;
  category: string;
}

interface SeriesFormValues {
  vehicle_id: string;
  title: string;
  category?: string;
  supplier_id?: string;
  frequency: MaintenanceFrequency;
  start_date: string;
  end_date?: string;
  amount?: number;
  status: MaintenanceSeriesStatus;
  day_rule_mode: 'same_day' | 'fixed_day';
  fixed_day?: number;
}

const TAB_CONFIG: Array<{ value: TabScope; label: string }> = [
  { value: 'upcoming', label: 'Próximos (30d)' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'history', label: 'Histórico' },
];

const STATUS_LABELS: Record<MaintenanceOccurrenceStatus, string> = {
  open: 'Aberto',
  paid: 'Pago',
  ignored: 'Ignorado',
  canceled: 'Cancelado',
};

const STATUS_TONES: Record<MaintenanceOccurrenceStatus, string> = {
  open: 'bg-amber-50 text-amber-700 border border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  ignored: 'bg-slate-100 text-slate-500 border border-slate-200',
  canceled: 'bg-rose-50 text-rose-600 border border-rose-200',
};

const FREQUENCY_LABELS: Record<MaintenanceFrequency, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
  weekly: 'Semanal',
  on_demand: 'Sob demanda',
};

const SERIES_STATUS_OPTIONS: Array<{ value: MaintenanceSeriesStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'paused', label: 'Pausado' },
  { value: 'canceled', label: 'Cancelado' },
];

const OCCURRENCE_STATUS_FILTERS: Array<{ value: MaintenanceOccurrenceStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Todos os status' },
  { value: 'open', label: 'Abertos' },
  { value: 'paid', label: 'Pagos' },
  { value: 'ignored', label: 'Ignorados' },
  { value: 'canceled', label: 'Cancelados' },
];

const FREQUENCY_OPTIONS: Array<{ value: MaintenanceFrequency; label: string }> = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'yearly', label: 'Anual' },
  { value: 'on_demand', label: 'Sob demanda' },
];

const PAGE_SIZE = 25;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const formatCurrency = (value: string | number | undefined) => currencyFormatter.format(Number(value ?? 0));

const defaultFilters: FiltersState = {
  status: 'all',
  vehicleId: '',
  supplierId: '',
  category: '',
};

const defaultFormValues: SeriesFormValues = {
  vehicle_id: '',
  title: '',
  category: '',
  supplier_id: '',
  frequency: 'monthly',
  start_date: '',
  end_date: '',
  amount: undefined,
  status: 'active',
  day_rule_mode: 'same_day',
  fixed_day: undefined,
};

function makeVehicleLabel(vehicle: Vehicle) {
  const parts = [vehicle.plate?.toUpperCase(), vehicle.make, vehicle.model].filter(Boolean);
  return parts.join(' · ') || vehicle.id;
}

function matchesFilters(
  item: MaintenanceOccurrence,
  scope: TabScope,
  filters: FiltersState,
  referenceToday: Date,
  daysWindow: number,
) {
  if (filters.status !== 'all' && item.status !== filters.status) {
    return false;
  }
  if (filters.vehicleId && item.vehicle_id !== filters.vehicleId) {
    return false;
  }
  if (filters.supplierId && item.supplier_id !== filters.supplierId) {
    return false;
  }
  if (filters.category && (item.category ?? '') !== filters.category) {
    return false;
  }

  const dueDate = startOfDay(parseISO(item.due_date));
  const horizon = addDays(referenceToday, daysWindow);

  if (scope === 'upcoming') {
    return item.status === 'open' && dueDate >= referenceToday && dueDate <= horizon;
  }
  if (scope === 'overdue') {
    return item.status === 'open' && dueDate < referenceToday;
  }
  return true;
}

const Maintenance: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<TabScope>('upcoming');
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [isPaymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<MaintenanceOccurrence | null>(null);
  const getDefaultPaymentForm = () => ({
    paidAt: format(new Date(), 'yyyy-MM-dd'),
    note: '',
    cashCategoryId: '',
    paymentMethod: '',
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(getDefaultPaymentForm);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch } = useForm<SeriesFormValues>({
    defaultValues: defaultFormValues,
  });

  const dayRuleMode = watch('day_rule_mode');

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'maintenance'],
    queryFn: () => VehiclesApi.list({ page_size: 200 }),
  });

  const vendorsQuery = useQuery({
    queryKey: ['vendors', 'maintenance'],
    queryFn: () => VendorsApi.list({ page_size: 200 }),
  });

  const cashCategoriesQuery = useQuery({
    queryKey: ['cash-categories', 'maintenance'],
    queryFn: () => CashCategoriesApi.list(true),
  });

  const vehicles = useMemo(() => vehiclesQuery.data?.items ?? [], [vehiclesQuery.data]);
  const vendors = useMemo(() => vendorsQuery.data?.items ?? [], [vendorsQuery.data]);
  const cashCategories = cashCategoriesQuery.data ?? [];
  const cashCategoriesLoading = cashCategoriesQuery.isLoading;
  const cashCategoriesError = cashCategoriesQuery.isError;

  const today = startOfDay(new Date());
  const daysWindow = 30;

  const queryKey = ['maintenance-occurrences', activeTab, filters, page] as const;

  const occurrencesQuery = useQuery({
    queryKey,
    keepPreviousData: true,
    queryFn: () =>
      MaintenanceApi.listOccurrences({
        scope: activeTab,
        days: activeTab === 'upcoming' ? daysWindow : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        vehicle_id: filters.vehicleId || undefined,
        supplier_id: filters.supplierId || undefined,
        category: filters.category || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  useEffect(() => {
    setPage(1);
  }, [activeTab, filters]);

  const updateCacheAfterAction = (data: MaintenanceActionResponse) => {
    queryClient.setQueryData<MaintenanceOccurrencesResponse>(queryKey, (previous) => {
      if (!previous) return previous;
      const updatedItems = previous.items
        .map((item) => (item.id === data.occurrence.id ? data.occurrence : item))
        .filter((item) => matchesFilters(item, activeTab, filters, today, daysWindow));
      const diff = previous.items.length - updatedItems.length;
      return {
        ...previous,
        summary: data.summary,
        items: updatedItems,
        total: Math.max(0, previous.total - diff),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['maintenance-occurrences'] });
  };

  const payMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MaintenancePayRequest }) =>
      MaintenanceApi.payOccurrence(id, payload),
    onSuccess: (response) => {
      updateCacheAfterAction(response);
      closePaymentDialog();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Não foi possível registrar o pagamento.';
      setPaymentError(message);
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      MaintenanceApi.ignoreOccurrence(id, note ? { note } : undefined),
    onSuccess: (response) => updateCacheAfterAction(response),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: number) => MaintenanceApi.reopenOccurrence(id),
    onSuccess: (response) => updateCacheAfterAction(response),
  });

  const createSeriesMutation = useMutation({
    mutationFn: (payload: Partial<MaintenanceSeries>) => MaintenanceApi.createSeries(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-occurrences'] });
      reset(defaultFormValues);
    },
  });

  const occurrences = occurrencesQuery.data?.items ?? [];
  const summary = occurrencesQuery.data?.summary ?? ({
    open: 0,
    overdue: 0,
    expected_this_month: '0',
    paid_this_month: '0',
  } as MaintenanceSummary);
  const total = occurrencesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  
  const categoryOptions = useMemo(() => {
    const unique = new Set<string>();
    occurrences.forEach((item) => {
      if (item.category) {
        unique.add(item.category);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [occurrences]);

  const isPaying = payMutation.isPending;
  const isIgnoring = ignoreMutation.isPending;
  const isReopening = reopenMutation.isPending;

  const closePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setPaymentTarget(null);
    setPaymentForm(getDefaultPaymentForm());
    setPaymentError(null);
    payMutation.reset();
  };

  const handleOpenPaymentDialog = (occurrence: MaintenanceOccurrence) => {
    setPaymentTarget(occurrence);
    setPaymentForm({
      paidAt: occurrence.paid_at ? occurrence.paid_at.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
      note: occurrence.note ?? '',
      cashCategoryId: occurrence.cash_category_id ?? '',
      paymentMethod: occurrence.cash_payment_method ?? '',
    });
    setPaymentError(null);
    setPaymentDialogOpen(true);
  };

  const handlePaymentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentTarget) {
      return;
    }
    setPaymentError(null);
    payMutation.mutate({
      id: paymentTarget.id,
      payload: {
        paid_at: paymentForm.paidAt || undefined,
        note: paymentForm.note.trim() || undefined,
        cash_category_id: paymentForm.cashCategoryId || undefined,
        payment_method: paymentForm.paymentMethod.trim() || undefined,
      },
    });
  };

  const handleIgnore = (occurrence: MaintenanceOccurrence) => {
    const note = window.prompt('Motivo (opcional)')?.trim();
    ignoreMutation.mutate({ id: occurrence.id, note: note || undefined });
  };

  const handleReopen = (occurrence: MaintenanceOccurrence) => {
    const shouldReopen = window.confirm('Reabrir esta ocorrência?');
    if (!shouldReopen) {
      return;
    }
    reopenMutation.mutate(occurrence.id);
  };

  const handleSeriesSubmit = (values: SeriesFormValues) => {
    if (!values.vehicle_id || !values.title || !values.start_date) {
      return;
    }
    const amountDecimal = values.amount != null ? Number(values.amount) : 0;
    const dayRule =
      values.day_rule_mode === 'same_day'
        ? 'same_day'
        : `fixed_day:${Math.min(Math.max(values.fixed_day ?? 1, 1), 31)}`;

    createSeriesMutation.mutate({
      vehicle_id: values.vehicle_id,
      title: values.title,
      category: values.category || undefined,
      supplier_id: values.supplier_id || undefined,
      frequency: values.frequency,
      start_date: values.start_date,
      end_date: values.end_date || undefined,
      amount: amountDecimal.toFixed(2),
      status: values.status,
      day_rule: dayRule,
    });
  };

  const handleStatusFilterChange = (value: MaintenanceOccurrenceStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleInputChange = (field: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const renderSummaryCard = (title: string, value: string, tone?: 'default' | 'warning' | 'positive') => {
    const toneClasses: Record<string, string> = {
      default: 'bg-white border-slate-200 text-slate-700',
      warning: 'bg-amber-50 border-amber-200 text-amber-700',
      positive: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    };
    const toneKey = tone ?? 'default';
    return (
      <div className={`rounded-xl border p-4 shadow-sm ${toneClasses[toneKey]}`}>
        <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </div>
    );
  };

  const renderTable = () => {
    if (occurrencesQuery.isLoading) {
      return <Loading label="Carregando manutenções..." />;
    }
    if (occurrencesQuery.isError) {
      return (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          Não foi possível carregar as ocorrências de manutenção.
        </div>
      );
    }

    return (
      <>
        <DataTable<MaintenanceOccurrence>
          data={occurrences}
          columns={[
            {
              header: 'Veículo',
              key: 'vehicle_id',
              render: (item) => <span className="font-medium text-slate-700">{item.vehicle_label}</span>,
            },
            { header: 'Título', key: 'title' },
            {
              header: 'Categoria',
              key: 'category',
              render: (item) => item.category || '—',
            },
            {
              header: 'Fornecedor',
              key: 'supplier',
              render: (item) => item.supplier_name || '—',
            },
            {
              header: 'Previsto',
              key: 'due_date',
              render: (item) => (item.due_date ? format(parseISO(item.due_date), 'dd/MM/yyyy') : '—'),
            },
            {
              header: 'Pago em',
              key: 'paid_at',
              render: (item) => (item.paid_at ? format(parseISO(item.paid_at), 'dd/MM/yyyy') : '—'),
            },
            {
              header: 'Frequência',
              key: 'frequency',
              render: (item) => FREQUENCY_LABELS[item.frequency],
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
                <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_TONES[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              ),
            },
            {
              header: 'Observação',
              key: 'note',
              render: (item) => {
                if (!item.note && !item.cash_txn_id) {
                  return '—';
                }
                return (
                  <div className="flex flex-col gap-1">
                    {item.note ? <span>{item.note}</span> : null}
                    {item.cash_txn_id ? (
                      <span className="text-[11px] text-slate-500">Caixa: {item.cash_txn_id}</span>
                    ) : null}
                  </div>
                );
              },
            },
            {
              header: 'Ações',
              key: 'actions',
              render: (item) => (
                <div className="flex flex-wrap gap-2 text-xs">
                  {isAdmin && (item.status === 'open' || item.status === 'paid') ? (
                    <button
                      className="rounded-md border border-emerald-300 px-2 py-1 text-emerald-600 transition hover:bg-emerald-50"
                      onClick={() => handleOpenPaymentDialog(item)}
                      disabled={isPaying}
                    >
                      {item.status === 'open' ? 'Registrar pagamento' : 'Editar pagamento'}
                    </button>
                  ) : null}
                  {isAdmin && item.status === 'open' ? (
                    <button
                      className="rounded-md border border-amber-200 px-2 py-1 text-amber-600 transition hover:bg-amber-50"
                      onClick={() => handleIgnore(item)}
                      disabled={isIgnoring}
                    >
                      Ignorar
                    </button>
                  ) : null}
                  {isAdmin && (item.status === 'paid' || item.status === 'ignored') ? (
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-slate-600 transition hover:bg-slate-100"
                      onClick={() => handleReopen(item)}
                      disabled={isReopening}
                    >
                      Reabrir
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>
            Página {page} de {totalPages} • {total} registros
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 transition hover:bg-slate-100 disabled:opacity-60"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1 || occurrencesQuery.isFetching}
            >
              Anterior
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 transition hover:bg-slate-100 disabled:opacity-60"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || occurrencesQuery.isFetching}
            >
              Próxima
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manutenções recorrentes"
        description="Cadastre séries de manutenção e acompanhe as próximas parcelas geradas sob demanda conforme o horizonte configurado."
      />

      <section className="grid gap-4 md:grid-cols-4">
        {renderSummaryCard('Ocorrências abertas', summary.open.toString(), summary.open ? 'warning' : undefined)}
        {renderSummaryCard('Vencidas', summary.overdue.toString(), summary.overdue ? 'warning' : undefined)}
        {renderSummaryCard('Previsto este mês', formatCurrency(summary.expected_this_month), 'positive')}
        {renderSummaryCard('Pago este mês', formatCurrency(summary.paid_this_month))}
      </section>

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-700">Nova série de manutenção</h2>
              <p className="text-xs text-slate-500">Defina a recorrência e o sistema gerará as próximas parcelas conforme o horizonte.</p>
            </div>
            <button
              type="button"
              onClick={() => reset(defaultFormValues)}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Limpar
            </button>
          </div>
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(handleSeriesSubmit)}>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Veículo</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('vehicle_id', { required: true })}
              >
                <option value="">Selecione...</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {makeVehicleLabel(vehicle)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Título</label>
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('title', { required: true })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</label>
              <input
                list="maintenance-categories"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('category')}
              />
              <datalist id="maintenance-categories">
                {categoryOptions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('supplier_id')}>
                <option value="">Selecione...</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Frequência</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('frequency')}
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Início</label>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('start_date', { required: true })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Término (opcional)</label>
              <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('end_date')} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('amount', { valueAsNumber: true, min: 0 })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('status')}>
                {SERIES_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regra do dia</label>
              <div className="mt-1 flex gap-2">
                <select
                  className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
                  {...register('day_rule_mode')}
                >
                  <option value="same_day">Mesmo dia da data inicial</option>
                  <option value="fixed_day">Dia fixo</option>
                </select>
                {dayRuleMode === 'fixed_day' ? (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-1/2 rounded-md border border-slate-300 px-3 py-2"
                    placeholder="Dia"
                    {...register('fixed_day', { valueAsNumber: true })}
                  />
                ) : null}
              </div>
            </div>
            <div className="md:col-span-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={createSeriesMutation.isPending}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-70"
              >
                {createSeriesMutation.isPending ? 'Salvando...' : 'Criar série'}
              </button>
              {createSeriesMutation.isSuccess ? (
                <span className="text-xs text-emerald-600">Série criada com sucesso.</span>
              ) : null}
              {createSeriesMutation.isError ? (
                <span className="text-xs text-red-600">Erro ao salvar série.</span>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Ocorrências geradas</h2>
            <p className="text-xs text-slate-500">
              As ocorrências são calculadas sob demanda. Altere os filtros para refinar a visão.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.status}
              onChange={(event) => handleStatusFilterChange(event.target.value as MaintenanceOccurrenceStatus | 'all')}
            >
              {OCCURRENCE_STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              list="maintenance-filter-categories"
              className="rounded-md border border-slate-300 px-2 py-1"
              placeholder="Categoria"
              value={filters.category}
              onChange={(event) => handleInputChange('category', event.target.value)}
            />
            <datalist id="maintenance-filter-categories">
              {categoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.supplierId}
              onChange={(event) => handleInputChange('supplierId', event.target.value)}
            >
              <option value="">Fornecedor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-slate-300 px-2 py-1"
              value={filters.vehicleId}
              onChange={(event) => handleInputChange('vehicleId', event.target.value)}
            >
              <option value="">Veículo</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {makeVehicleLabel(vehicle)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabScope)}>
          <TabsList>
            {TAB_CONFIG.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="mt-4 space-y-4">
            {TAB_CONFIG.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {renderTable()}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </section>

      {isPaymentDialogOpen && paymentTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => {
            if (!isPaying) {
              closePaymentDialog();
            }
          }}
        >
          <div className="absolute inset-0 bg-slate-950/40" />
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800">
              {paymentTarget.status === 'open' ? 'Registrar pagamento' : 'Editar pagamento'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Valor previsto: {formatCurrency(paymentTarget.amount)}
            </p>

            {paymentError ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {paymentError}
              </div>
            ) : null}

            <form className="mt-4 space-y-4" onSubmit={handlePaymentSubmit}>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Pago em
                </label>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={paymentForm.paidAt}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, paidAt: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Categoria de caixa
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  value={paymentForm.cashCategoryId}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, cashCategoryId: event.target.value }))
                  }
                  disabled={cashCategoriesLoading}
                >
                  <option value="">Não registrar saída</option>
                  {cashCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {cashCategoriesLoading ? (
                  <p className="text-[11px] text-slate-500">Carregando categorias...</p>
                ) : null}
                {cashCategoriesError ? (
                  <p className="text-[11px] text-red-500">Não foi possível carregar as categorias.</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Método de pagamento
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  placeholder="Ex.: PIX, Transferência"
                  value={paymentForm.paymentMethod}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, paymentMethod: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Observação
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                  rows={3}
                  value={paymentForm.note}
                  onChange={(event) =>
                    setPaymentForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                  onClick={closePaymentDialog}
                  disabled={isPaying}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                  disabled={isPaying}
                >
                  {paymentTarget.status === 'open' ? 'Confirmar pagamento' : 'Atualizar pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Maintenance;
