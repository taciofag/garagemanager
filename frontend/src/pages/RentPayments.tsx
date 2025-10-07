import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  getISODay,
  isSameMonth,
  isSameYear,
  parseISO,
} from 'date-fns';
import { useForm } from 'react-hook-form';

import { RentPaymentsApi, RentalsApi, VehiclesApi } from '../api/resources';
import { DataTable } from '../components/DataTable';
import { Loading } from '../components/Loading';
import { PageHeader } from '../components/PageHeader';
import type { RentPayment, Rental } from '../types';

interface RentPaymentForm {
  rental_id: string;
  period_start: string;
  period_end: string;
  weekly_rate: number;
  weeks: number;
  paid_amount?: number;
  payment_date?: string;
  late_fee?: number;
  method?: string;
  notes?: string;
}

interface PartneredQuickEntry {
  key: string;
  label: string;
  start: string;
  end: string;
  dueAmount: number;
  defaultAmount: number;
  weeks: number;
  isPast: boolean;
  weekNumber: number;
  isCurrent: boolean;
}

interface QuickInputState {
  amount: number;
  lateFee: number;
  paymentDate: string;
  method: string;
}

const PAYMENT_METHOD_OPTIONS = ['PIX', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência'];

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));

const BILLING_DAY_TO_ISO: Record<Rental['billing_day'], number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

type RentPaymentRow = RentPayment & {
  weekNumber?: number | null;
  dueWithLate: number;
  periodStartDate?: Date | null;
  periodEndDate?: Date | null;
};

const buildDefaultValues = (): RentPaymentForm => {
  const today = format(new Date(), 'yyyy-MM-dd');
  return {
    rental_id: '',
    period_start: today,
    period_end: today,
    weekly_rate: 0,
    weeks: 1,
    paid_amount: 0,
    payment_date: today,
    late_fee: 0,
    method: 'PIX',
    notes: '',
  };
};

const toISODate = (date: Date) => format(date, 'yyyy-MM-dd');

const RentPayments: React.FC = () => {
  const queryClient = useQueryClient();
  const paymentsQuery = useQuery({ queryKey: ['rent-payments'], queryFn: () => RentPaymentsApi.list() });
  const rentalsQuery = useQuery({ queryKey: ['rentals', 'select'], queryFn: () => RentalsApi.list({ page_size: 100 }) });
  const vehiclesQuery = useQuery({ queryKey: ['vehicles', 'lookup'], queryFn: () => VehiclesApi.list({ page_size: 200 }) });

  const { register, handleSubmit, reset, watch, setValue } = useForm<RentPaymentForm>({
    defaultValues: buildDefaultValues(),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickInputs, setQuickInputs] = useState<Record<string, QuickInputState>>({});
  const [quickSubmittingKey, setQuickSubmittingKey] = useState<string | null>(null);

  const vehiclesById = useMemo(() => {
    const dictionary: Record<string, { plate?: string; label: string }> = {};
    vehiclesQuery.data?.items.forEach((vehicle) => {
      const label = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim() || vehicle.model || vehicle.make || vehicle.id;
      dictionary[vehicle.id] = { plate: vehicle.plate, label };
    });
    return dictionary;
  }, [vehiclesQuery.data]);

  const watchedRentalId = watch('rental_id');
  const watchedWeeklyRate = watch('weekly_rate', 0);
  const watchedWeeks = watch('weeks', 1);
  const watchedPeriodStart = watch('period_start');
  const watchedPeriodEnd = watch('period_end');
  const projectedDue = (watchedWeeklyRate || 0) * (watchedWeeks || 1);

  const rentals = rentalsQuery.data?.items ?? [];
  const rental = rentals.find((item) => item.id === watchedRentalId);

  const rentalPayments = useMemo(
    () => (paymentsQuery.data?.items ?? []).filter((payment) => payment.rental_id === watchedRentalId),
    [paymentsQuery.data, watchedRentalId]
  );

  const paymentsByRental = useMemo(() => {
    const map = new Map<string, RentPayment[]>();
    (paymentsQuery.data?.items ?? []).forEach((payment) => {
      if (!map.has(payment.rental_id)) {
        map.set(payment.rental_id, []);
      }
      map.get(payment.rental_id)!.push(payment);
    });
    return map;
  }, [paymentsQuery.data]);

  const rentalById = useMemo(() => {
    const dictionary = new Map<string, Rental>();
    rentals.forEach((item) => dictionary.set(item.id, item));
    return dictionary;
  }, [rentals]);

  const paymentRows: RentPaymentRow[] = useMemo(() => {
    const rows: RentPaymentRow[] = [];
    (paymentsQuery.data?.items ?? []).forEach((payment) => {
      const rentalItem = rentalById.get(payment.rental_id);
      const periodStart = payment.period_start ? parseISO(payment.period_start) : null;
      const periodEnd = payment.period_end ? parseISO(payment.period_end) : null;
      let weekNumber: number | null = null;
      if (rentalItem && periodStart) {
        const rentalStart = parseISO(rentalItem.start_date);
        if (!Number.isNaN(rentalStart.getTime())) {
          const diffWeeks = differenceInCalendarWeeks(periodStart, rentalStart);
          weekNumber = Math.max(1, diffWeeks + 1);
        }
      }
      const dueWithLate = Number(payment.due_amount ?? 0) + Number(payment.late_fee ?? 0);
      rows.push({
        ...payment,
        weekNumber,
        dueWithLate,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
      });
    });
    return rows;
  }, [paymentsQuery.data, rentalById]);

  const rentalSummary = useMemo(() => {
    if (!rental) {
      return null;
    }
    const rentalRows = paymentRows.filter((row) => row.rental_id === rental.id);
    const weeksPaid = rentalRows.reduce((acc, item) => acc + (item.weeks ?? 1), 0);
    const due = rentalRows.reduce((acc, item) => acc + item.dueWithLate, 0);
    const paid = rentalRows.reduce((acc, item) => acc + Number(item.paid_amount ?? 0), 0);
    const balance = due - paid;
    const today = new Date();
    const currentMonthDue = rentalRows.reduce((acc, item) => {
      if (item.periodStartDate && isSameMonth(item.periodStartDate, today) && isSameYear(item.periodStartDate, today)) {
        return acc + item.dueWithLate;
      }
      return acc;
    }, 0);
    const currentMonthPaid = rentalRows.reduce((acc, item) => {
      const paymentDate = item.payment_date ? parseISO(item.payment_date) : null;
      if (paymentDate && isSameMonth(paymentDate, today) && isSameYear(paymentDate, today)) {
        return acc + Number(item.paid_amount ?? 0);
      }
      return acc;
    }, 0);
    return {
      weeksPaid,
      due,
      paid,
      balance,
      weeklyRate: Number(rental.weekly_rate ?? 0),
      currentMonthDue,
      currentMonthPaid,
    };
  }, [rental, paymentRows]);

  const pendingWeeks = useMemo(() => {
    if (!rental) {
      return [] as PartneredQuickEntry[];
    }

    const rentalStart = parseISO(rental.start_date);
    const contractEnd = rental.end_date ? parseISO(rental.end_date) : undefined;
    const weeklyRate = Number(rental.weekly_rate ?? 0);

    const existing = rentalPayments
      .map((payment) => ({
        start: parseISO(payment.period_start),
        end: parseISO(payment.period_end),
        key: `${payment.period_start}_${payment.period_end}`,
      }))
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    const takenKeys = new Set(existing.map((item) => item.key));

    const lastEnd = existing.length ? existing[existing.length - 1].end : undefined;
    let cursorStart = lastEnd ? addDays(lastEnd, 1) : rentalStart;

    const entries: PartneredQuickEntry[] = [];
    const maxRows = 8;
    const today = new Date();

    while (entries.length < maxRows) {
      if (contractEnd && cursorStart > contractEnd) {
        break;
      }

      let cursorEnd = addDays(cursorStart, 6);
      if (contractEnd && cursorEnd > contractEnd) {
        cursorEnd = contractEnd;
      }

      const startISO = toISODate(cursorStart);
      const endISO = toISODate(cursorEnd);
      const key = `${startISO}_${endISO}`;

      if (!takenKeys.has(key)) {
        const daysSpan = differenceInCalendarDays(cursorEnd, cursorStart) + 1;
        const weeks = Math.max(1, Math.round(daysSpan / 7));
        const weekNumber = Math.max(1, differenceInCalendarWeeks(cursorStart, rentalStart) + 1);
        const isCurrent = cursorStart <= today && cursorEnd >= today;
        entries.push({
          key,
          label: `${format(cursorStart, 'dd/MM')} - ${format(cursorEnd, 'dd/MM')}`,
          start: startISO,
          end: endISO,
          dueAmount: weeklyRate * weeks,
          defaultAmount: weeklyRate,
          weeks,
          isPast: cursorEnd < today,
          weekNumber,
          isCurrent,
        });
      }

      cursorStart = addDays(cursorEnd, 1);
      if (contractEnd && cursorStart > contractEnd) {
        break;
      }

      if (!contractEnd && entries.length && entries[entries.length - 1].isPast && entries.length >= maxRows) {
        break;
      }
    }

    return entries;
  }, [rental, rentalPayments]);

  const formatPeriod = (start?: string, end?: string) => {
    if (!start || !end) {
      return '—';
    }
    const parsedStart = parseISO(start);
    const parsedEnd = parseISO(end);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return '—';
    }
    return `${format(parsedStart, 'dd/MM/yyyy')} - ${format(parsedEnd, 'dd/MM/yyyy')}`;
  };

  const formatDateDisplay = (value?: string) => {
    if (!value) {
      return '—';
    }
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return '—';
    }
    return format(parsed, 'dd/MM/yyyy');
  };

  interface CurrentWeekPending {
    rental: Rental;
    periodStart: Date;
    periodEnd: Date;
    periodStartISO: string;
    periodEndISO: string;
    weeks: number;
    dueAmount: number;
    existingPayment?: RentPayment;
    vehicleInfo?: { plate?: string; label: string };
  }

  const currentWeekPending = useMemo(() => {
    const today = new Date();
    return rentals.reduce<CurrentWeekPending[]>((acc, rentalItem) => {
      const billingIso = BILLING_DAY_TO_ISO[rentalItem.billing_day];
      if (!billingIso) {
        return acc;
      }

      const rentalStart = parseISO(rentalItem.start_date);
      if (Number.isNaN(rentalStart.getTime()) || today < rentalStart) {
        return acc;
      }

      const rentalEnd = rentalItem.end_date ? parseISO(rentalItem.end_date) : null;
      if (rentalEnd && Number.isNaN(rentalEnd.getTime())) {
        return acc;
      }
      if (rentalEnd && rentalEnd < rentalStart) {
        return acc;
      }

      const isoToday = getISODay(today);
      const daysUntilBilling = (billingIso - isoToday + 7) % 7;
      const dueDate = addDays(today, daysUntilBilling);
      let periodEnd = addDays(dueDate, -1);
      let periodStart = addDays(periodEnd, -6);

      if (periodEnd < rentalStart) {
        return acc;
      }

      if (periodStart < rentalStart) {
        periodStart = rentalStart;
      }
      if (rentalEnd && periodEnd > rentalEnd) {
        periodEnd = rentalEnd;
      }
      if (rentalEnd && periodStart > rentalEnd) {
        return acc;
      }

      const payments = paymentsByRental.get(rentalItem.id) ?? [];
      const overlapping = payments.find((payment) => {
        const start = parseISO(payment.period_start);
        const end = parseISO(payment.period_end);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }
        return start <= periodEnd && end >= periodStart;
      });

      if (overlapping && overlapping.status === 'paid') {
        return acc;
      }

      const daysSpan = Math.max(0, differenceInCalendarDays(periodEnd, periodStart)) + 1;
      const weeks = Math.max(1, Math.ceil(daysSpan / 7));
      const weeklyRate = Number(rentalItem.weekly_rate ?? 0);
      const dueAmount = overlapping ? Number(overlapping.due_amount ?? 0) : weeklyRate * weeks;

      acc.push({
        rental: rentalItem,
        periodStart,
        periodEnd,
        periodStartISO: format(periodStart, 'yyyy-MM-dd'),
        periodEndISO: format(periodEnd, 'yyyy-MM-dd'),
        weeks,
        dueAmount,
        existingPayment: overlapping,
        vehicleInfo: vehiclesById[rentalItem.vehicle_id],
      });
      return acc;
    }, []);
  }, [rentals, paymentsByRental, vehiclesById]);

  const handleSelectCurrentWeek = (item: CurrentWeekPending) => {
    if (item.existingPayment) {
      const payment = item.existingPayment;
      setEditingId(payment.id);
      setValue('rental_id', payment.rental_id, { shouldValidate: true });
      setValue('period_start', payment.period_start ?? '', { shouldValidate: true });
      setValue('period_end', payment.period_end ?? '', { shouldValidate: true });
      setValue('weekly_rate', Number(payment.weekly_rate ?? 0), { shouldValidate: true });
      setValue('weeks', payment.weeks ?? 1, { shouldValidate: true });
      setValue('paid_amount', Number(payment.paid_amount ?? 0), { shouldValidate: true });
      setValue('payment_date', payment.payment_date ?? '', { shouldValidate: true });
      setValue('late_fee', Number(payment.late_fee ?? 0), { shouldValidate: true });
      setValue('method', payment.method ?? 'PIX', { shouldValidate: true });
      setValue('notes', payment.notes ?? '', { shouldValidate: true });
      return;
    }

    setEditingId(null);
    setValue('rental_id', item.rental.id, { shouldValidate: true });
    setValue('period_start', item.periodStartISO, { shouldValidate: true });
    setValue('period_end', item.periodEndISO, { shouldValidate: true });
    setValue('weekly_rate', Number(item.rental.weekly_rate ?? 0), { shouldValidate: true });
    setValue('weeks', item.weeks, { shouldValidate: true });
    setValue('paid_amount', 0, { shouldValidate: true });
    const todayIso = format(new Date(), 'yyyy-MM-dd');
    setValue('payment_date', todayIso, { shouldValidate: true });
    setValue('late_fee', 0, { shouldValidate: true });
    setValue('method', 'PIX', { shouldValidate: true });
    setValue('notes', '', { shouldValidate: true });
  };

  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setQuickInputs((prev) => {
      const next: Record<string, QuickInputState> = {};
      pendingWeeks.forEach((week) => {
        const previous = prev[week.key];
        next[week.key] = {
          amount: previous?.amount ?? week.defaultAmount,
          lateFee: previous?.lateFee ?? 0,
          paymentDate: previous?.paymentDate ?? today,
          method: previous?.method ?? 'PIX',
        };
      });
      return next;
    });
  }, [pendingWeeks]);

  const handleResetForm = () => {
    reset(buildDefaultValues());
    setEditingId(null);
  };

  useEffect(() => {
    if (!watchedRentalId) {
      setValue('weekly_rate', 0, { shouldValidate: true });
      return;
    }
    if (editingId) {
      return;
    }
    const rentalData = rentals.find((item) => item.id === watchedRentalId);
    const weekly = rentalData ? Number(rentalData.weekly_rate || 0) : 0;
    setValue('weekly_rate', weekly, { shouldValidate: true });
  }, [watchedRentalId, rentals, setValue, editingId]);

  useEffect(() => {
    if (!watchedPeriodStart || !watchedPeriodEnd) {
      return;
    }
    const start = parseISO(watchedPeriodStart);
    const end = parseISO(watchedPeriodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }
    const diffDays = Math.max(0, differenceInCalendarDays(end, start)) + 1;
    const computedWeeks = Math.max(1, Math.ceil(diffDays / 7));
    setValue('weeks', computedWeeks, { shouldValidate: true });
  }, [watchedPeriodStart, watchedPeriodEnd, setValue]);

  const createPayment = useMutation({
    mutationFn: (payload: Partial<RentPayment>) => RentPaymentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-payments'] });
      handleResetForm();
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RentPayment> }) => RentPaymentsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent-payments'] });
      handleResetForm();
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: string) => RentPaymentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rent-payments'] }),
  });

  const quickCreatePayment = useMutation({
    mutationFn: (payload: Partial<RentPayment>) => RentPaymentsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rent-payments'] }),
  });

  const handleEdit = (payment: RentPayment) => {
    setEditingId(payment.id);
    setValue('rental_id', payment.rental_id, { shouldValidate: true });
    setValue('period_start', payment.period_start ?? '', { shouldValidate: true });
    setValue('period_end', payment.period_end ?? '', { shouldValidate: true });
    setValue('weekly_rate', Number(payment.weekly_rate ?? 0), { shouldValidate: true });
    setValue('weeks', payment.weeks ?? 1, { shouldValidate: true });
    setValue('paid_amount', Number(payment.paid_amount ?? 0), { shouldValidate: true });
    setValue('payment_date', payment.payment_date ?? '', { shouldValidate: true });
    setValue('late_fee', Number(payment.late_fee ?? 0), { shouldValidate: true });
    setValue('method', payment.method ?? 'PIX', { shouldValidate: true });
    setValue('notes', payment.notes ?? '', { shouldValidate: true });
  };

  const onSubmit = (data: RentPaymentForm) => {
    const weeks = data.weeks > 0 ? data.weeks : 1;
    const dueAmount = data.weekly_rate * weeks;
    const payload: Partial<RentPayment> = {
      rental_id: data.rental_id,
      period_start: data.period_start,
      period_end: data.period_end,
      weekly_rate: data.weekly_rate.toString(),
      weeks,
      due_amount: dueAmount.toString(),
      paid_amount: (data.paid_amount ?? 0).toString(),
      payment_date: data.payment_date || undefined,
      late_fee: (data.late_fee ?? 0).toString(),
      method: data.method || 'PIX',
      notes: data.notes,
    };

    if (editingId) {
      updatePayment.mutate({ id: editingId, payload });
    } else {
      createPayment.mutate(payload);
    }
  };

  const handleQuickSubmit = async (week: PartneredQuickEntry) => {
    if (!rental || !watchedRentalId) {
      return;
    }
    const values = quickInputs[week.key];
    const fallback: QuickInputState = {
      amount: week.defaultAmount,
      lateFee: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      method: 'PIX',
    };
    const currentValues = values ?? fallback;

    if (!currentValues.amount || currentValues.amount <= 0) {
      setQuickError('Informe o valor recebido para registrar a semana.');
      return;
    }

    const payload: Partial<RentPayment> = {
      rental_id: watchedRentalId,
      period_start: week.start,
      period_end: week.end,
      weekly_rate: rental.weekly_rate,
      weeks: week.weeks,
      due_amount: week.dueAmount.toString(),
      paid_amount: currentValues.amount.toString(),
      late_fee: currentValues.lateFee.toString(),
      payment_date: currentValues.paymentDate,
      method: currentValues.method || 'PIX',
    };

    setQuickError(null);
    setQuickSubmittingKey(week.key);
    try {
      await quickCreatePayment.mutateAsync(payload);
      setQuickInputs((prev) => {
        const next = { ...prev };
        delete next[week.key];
        return next;
      });
    } catch (error) {
      setQuickError(error instanceof Error ? error.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setQuickSubmittingKey(null);
    }
  };

  const handleQuickChange = (week: PartneredQuickEntry, field: keyof QuickInputState, rawValue: string) => {
    setQuickInputs((prev) => {
      const base: QuickInputState =
        prev[week.key] ?? {
          amount: week.defaultAmount,
          lateFee: 0,
          paymentDate: format(new Date(), 'yyyy-MM-dd'),
          method: 'PIX',
        };

      const value = field === 'amount' || field === 'lateFee' ? Number(rawValue) : rawValue;

      return {
        ...prev,
        [week.key]: {
          ...base,
          [field]: value,
        },
      };
    });
  };

  const isSaving = createPayment.isPending || updatePayment.isPending;
  const isEditing = Boolean(editingId);

  const today = new Date();
  const currentMonthDueTotal = paymentRows.reduce((acc, item) => {
    if (item.periodStartDate && isSameMonth(item.periodStartDate, today) && isSameYear(item.periodStartDate, today)) {
      return acc + item.dueWithLate;
    }
    return acc;
  }, 0);

  const currentMonthPaidTotal = paymentRows.reduce((acc, item) => {
    const paymentDate = item.payment_date ? parseISO(item.payment_date) : null;
    if (paymentDate && isSameMonth(paymentDate, today) && isSameYear(paymentDate, today)) {
      return acc + Number(item.paid_amount ?? 0);
    }
    return acc;
  }, 0);

  const currentMonthBalance = currentMonthDueTotal - currentMonthPaidTotal;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobranças de aluguel"
        description="Controle as faturas semanais, registre pagamentos e acompanhe o saldo de cada contrato."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700">Semanas pendentes nesta semana</h2>
        <p className="text-xs text-slate-500">
          Lista dos contratos que ainda não têm cobrança quitada para a semana corrente.
        </p>
        {currentWeekPending.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
            Nenhum contrato pendente nesta semana.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {currentWeekPending.map((item) => {
              const existing = item.existingPayment;
              const vehicleInfo = item.vehicleInfo;
              const displayPlate = vehicleInfo?.plate ? vehicleInfo.plate.toUpperCase() : item.rental.vehicle_id;
              const displayLabel = vehicleInfo?.label ?? item.rental.vehicle_id;
              return (
                <div
                  key={`${item.rental.id}_${item.periodStartISO}`}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {item.rental.id} · {displayPlate}
                    </p>
                    <p className="text-xs text-slate-500">{displayLabel}</p>
                    <p className="text-xs text-slate-500">Período: {format(item.periodStart, 'dd/MM')} - {format(item.periodEnd, 'dd/MM')}</p>
                    <p className="text-xs text-slate-500">Previsto: {formatCurrency(item.dueAmount)}</p>
                    {existing ? (
                      <p className="text-xs text-amber-600">
                        Cobrança existente {existing.status === 'partial' ? 'parcial' : 'pendente'} · Saldo: {formatCurrency(existing.balance)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Ainda não há cobrança registrada.</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <button
                      onClick={() => handleSelectCurrentWeek(item)}
                      className="rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary/90"
                    >
                      Selecionar contrato
                    </button>
                    {existing ? (
                      <span className="text-xs text-amber-700">Lançamento pendente: {existing.id}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700">Resumo do mês atual</h2>
        <p className="text-xs text-slate-500">Previsão e recebimentos referentes às cobranças com período iniciado neste mês.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Previsto no mês</p>
            <p className="mt-1 text-xl font-semibold text-slate-800">{formatCurrency(currentMonthDueTotal)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Pago no mês</p>
            <p className="mt-1 text-xl font-semibold text-emerald-700">{formatCurrency(currentMonthPaidTotal)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs uppercase tracking-wide text-amber-600">Saldo do mês</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">{formatCurrency(currentMonthBalance)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Contrato</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                {...register('rental_id', { required: true })}
              >
                <option value="">Selecione...</option>
                {rentals.map((rentalItem) => {
                  const vehicleInfo = vehiclesById[rentalItem.vehicle_id];
                  const displayPlate = vehicleInfo?.plate ? vehicleInfo.plate.toUpperCase() : rentalItem.vehicle_id;
                  const displayLabel = vehicleInfo?.label ?? rentalItem.vehicle_id;
                  return (
                    <option key={rentalItem.id} value={rentalItem.id}>
                      {displayPlate} — {displayLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            {rentalSummary ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">Resumo do contrato</p>
                <div className="mt-2 space-y-1">
                  <p>Semanas registradas: <span className="font-semibold text-slate-800">{rentalSummary.weeksPaid}</span></p>
                  <p>Recebido: <span className="font-semibold text-emerald-600">{formatCurrency(rentalSummary.paid)}</span></p>
                  <p>Devido + multas: <span className="font-semibold text-slate-800">{formatCurrency(rentalSummary.due)}</span></p>
                  <p>
                    Saldo:
                    <span className={`ml-1 font-semibold ${rentalSummary.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {formatCurrency(rentalSummary.balance)}
                    </span>
                  </p>
                  <p className="pt-1 text-xs text-slate-500">
                    Mês atual: {formatCurrency(rentalSummary.currentMonthDue)} previsto ·{' '}
                    {formatCurrency(rentalSummary.currentMonthPaid)} recebido
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Selecione um contrato para visualizar as próximas semanas.</p>
            )}

            {quickError ? <p className="text-xs text-red-600">{quickError}</p> : null}
          </div>

          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-700">Pagamentos rápidos</h2>
            <p className="text-xs text-slate-500">Lance as próximas semanas com o valor semanal sugerido. Ajuste caso tenha recebido parcial.</p>

            {!watchedRentalId ? (
              <div className="mt-6 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Escolha um contrato para listar as semanas pendentes.
              </div>
            ) : pendingWeeks.length === 0 ? (
              <div className="mt-6 flex h-32 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">
                Nenhuma semana pendente. Todos os pagamentos desse contrato estão em dia.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {pendingWeeks.map((week, index) => {
                  const inputs = quickInputs[week.key] ?? {
                    amount: week.defaultAmount,
                    lateFee: 0,
                    paymentDate: format(new Date(), 'yyyy-MM-dd'),
                    method: 'PIX',
                  };
                  return (
                    <div
                      key={week.key}
                      className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Semana {week.weekNumber}</p>
                        <p className="text-xs text-slate-500">{week.label} · Previsto: {formatCurrency(week.dueAmount)}</p>
                        {week.isCurrent ? (
                          <p className="text-[11px] uppercase tracking-wide text-indigo-600">Semana atual</p>
                        ) : null}
                        {week.isPast && !week.isCurrent ? (
                          <p className="text-[11px] uppercase tracking-wide text-amber-600">Período vencido</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pago (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={inputs.amount}
                            onChange={(event) => handleQuickChange(week, 'amount', event.target.value)}
                            className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Multa (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={inputs.lateFee}
                            onChange={(event) => handleQuickChange(week, 'lateFee', event.target.value)}
                            className="mt-1 w-24 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data</label>
                          <input
                            type="date"
                            value={inputs.paymentDate}
                            onChange={(event) => handleQuickChange(week, 'paymentDate', event.target.value)}
                            className="mt-1 w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Forma</label>
                          <select
                            value={inputs.method}
                            onChange={(event) => handleQuickChange(week, 'method', event.target.value)}
                            className="mt-1 w-36 rounded-md border border-slate-300 px-3 py-2 text-sm"
                          >
                            {PAYMENT_METHOD_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickSubmit(week)}
                          disabled={quickCreatePayment.isPending}
                          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-70"
                        >
                          {quickCreatePayment.isPending && quickSubmittingKey === week.key ? 'Registrando...' : 'Registrar semana'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-700">{isEditing ? 'Editar cobrança' : 'Novo lançamento manual'}</h2>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
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
            <input
              type="number"
              step="1"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              {...register('weeks', { valueAsNumber: true, required: true, min: 1 })}
            />
            <p className="mt-1 text-xs text-slate-400">Calculado automaticamente pelo período informado.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Valor devido</label>
            <input
              readOnly
              value={projectedDue ? formatCurrency(projectedDue) : ''}
              className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
            />
            <p className="mt-1 text-xs text-slate-400">Calculado automaticamente (semanas × semanal).</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Pago (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('paid_amount', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Data do pagamento</label>
            <input type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('payment_date')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Multa (R$)</label>
            <input type="number" step="0.01" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('late_fee', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Forma de pagamento</label>
            <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" {...register('method')}>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
              {isSaving ? 'Salvando...' : isEditing ? 'Atualizar cobrança' : 'Registrar cobrança'}
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
            {createPayment.isError ? (
              <span className="text-sm text-red-600">{String(createPayment.error)}</span>
            ) : null}
            {updatePayment.isError ? (
              <span className="text-sm text-red-600">{String(updatePayment.error)}</span>
            ) : null}
            {createPayment.isSuccess && !isEditing ? (
              <span className="text-sm text-emerald-600">Cobrança registrada!</span>
            ) : null}
            {updatePayment.isSuccess && isEditing ? (
              <span className="text-sm text-emerald-600">Cobrança atualizada!</span>
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
          <DataTable<RentPaymentRow>
            data={paymentRows}
            columns={[
              { header: 'ID', key: 'id' },
              { header: 'Contrato', key: 'rental_id' },
              {
                header: 'Período',
                key: 'period',
                render: (item) => formatPeriod(item.period_start, item.period_end),
              },
              {
                header: 'Semana',
                key: 'weekNumber',
                render: (item) => (item.weekNumber ? `#${item.weekNumber}` : item.weeks ?? 1),
              },
              {
                header: 'Previsto',
                key: 'dueWithLate',
                render: (item) => formatCurrency(item.dueWithLate),
              },
              {
                header: 'Pago',
                key: 'paid_amount',
                render: (item) => formatCurrency(item.paid_amount),
              },
              {
                header: 'Saldo',
                key: 'balance',
                render: (item) => formatCurrency(item.balance),
              },
              {
                header: 'Pago em',
                key: 'payment_date',
                render: (item) => formatDateDisplay(item.payment_date),
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
                        if (confirm('Excluir cobrança?')) {
                          if (editingId === item.id) {
                            handleResetForm();
                          }
                          deletePayment.mutate(item.id);
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

export default RentPayments;
