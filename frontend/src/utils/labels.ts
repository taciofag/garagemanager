type Option<T> = { value: T; label: string };

export const vendorTypeOptions: Option<'DEALER' | 'MECHANIC' | 'AUCTION' | 'PARTS' | 'SERVICE' | 'OTHER'>[] = [
  { value: 'DEALER', label: 'Revenda' },
  { value: 'MECHANIC', label: 'Oficina mecânica' },
  { value: 'AUCTION', label: 'Leilão' },
  { value: 'PARTS', label: 'Autopeças' },
  { value: 'SERVICE', label: 'Prestador de serviço' },
  { value: 'OTHER', label: 'Outro' },
];

export const vendorTypeLabel = (value: string | null | undefined): string =>
  vendorTypeOptions.find((option) => option.value === value)?.label ?? (value ?? '-');

export const expenseCategoryOptions: Option<
  'Parts' | 'Repair' | 'Towing' | 'Docs' | 'AuctionFee' | 'Transfer' | 'Inspection' | 'Other'
>[] = [
  { value: 'Parts', label: 'Peças' },
  { value: 'Repair', label: 'Reparo' },
  { value: 'Towing', label: 'Guincho' },
  { value: 'Docs', label: 'Documentação' },
  { value: 'AuctionFee', label: 'Taxa de leilão' },
  { value: 'Transfer', label: 'Transferência' },
  { value: 'Inspection', label: 'Inspeção' },
  { value: 'Other', label: 'Outro' },
];

export const expenseCategoryLabel = (value: string | null | undefined): string =>
  expenseCategoryOptions.find((option) => option.value === value)?.label ?? (value ?? '-');

export const driverStatusOptions: Option<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>[] = [
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'INACTIVE', label: 'Inativo' },
  { value: 'SUSPENDED', label: 'Suspenso' },
];

export const driverStatusLabel = (value: string | null | undefined): string =>
  driverStatusOptions.find((option) => option.value === value)?.label ?? (value ?? '-');

export const vehicleStatusLabel = (value: string | null | undefined): string => {
  const labels: Record<string, string> = {
    STOCK: 'Estoque',
    RENTED: 'Alugado',
    SOLD: 'Vendido',
  };
  return value ? labels[value] ?? value : '-';
};

export const rentalStatusLabel = (value: string | null | undefined): string => {
  const labels: Record<string, string> = {
    Active: 'Ativo',
    Paused: 'Pausado',
    Closed: 'Encerrado',
  };
  return value ? labels[value] ?? value : '-';
};

export const billingDayOptions: Option<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'>[] = [
  { value: 'Mon', label: 'Segunda-feira' },
  { value: 'Tue', label: 'Terça-feira' },
  { value: 'Wed', label: 'Quarta-feira' },
  { value: 'Thu', label: 'Quinta-feira' },
  { value: 'Fri', label: 'Sexta-feira' },
  { value: 'Sat', label: 'Sábado' },
  { value: 'Sun', label: 'Domingo' },
];

export const capitalTypeLabel = (value: string | null | undefined): string => {
  const labels: Record<string, string> = {
    Contribution: 'Aporte',
    Withdrawal: 'Retirada',
  };
  return value ? labels[value] ?? value : '-';
};

export const cashTypeLabel = (value: string | null | undefined): string => {
  const labels: Record<string, string> = {
    Inflow: 'Entrada',
    Outflow: 'Saída',
  };
  return value ? labels[value] ?? value : '-';
};
