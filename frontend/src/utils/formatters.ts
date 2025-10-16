const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toBRL = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

export const toInt = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(toNumber(value)));

export const toPct = (
  value: string | number | null | undefined,
  options?: Intl.NumberFormatOptions
) => {
  const base = toNumber(value);
  const formatted = Number.isFinite(base)
    ? base > 1
      ? base / 100
      : base
    : 0;

  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(formatted);
};

const parseMonthInput = (value: string | Date | null | undefined) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const isoMonth = trimmed.match(/^(\d{4})-(\d{1,2})$/);
    if (isoMonth) {
      const [, year, month] = isoMonth;
      return new Date(Number(year), Number(month) - 1, 1);
    }

    const shortMonth = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
    if (shortMonth) {
      const [, month, year] = shortMonth;
      return new Date(Number(year), Number(month) - 1, 1);
    }
  }

  return null;
};

export const toMonthLabel = (value: string | Date | null | undefined) => {
  const date = parseMonthInput(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
  }).format(date);
};

export const toMonthName = (
  value: string | Date | null | undefined,
  width: 'short' | 'long' | 'narrow' = 'short'
) => {
  const date = parseMonthInput(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    month: width,
  }).format(date);
};

// Backwards compatibility alias (to be removed once legacy imports are updated).
export const currencyBRL = toBRL;
