import { api, apiBaseURL } from './client';
import {
  CapitalEntry,
  CashTxn,
  Driver,
  Vendor,
  Expense,
  PaginatedResponse,
  RentPayment,
  Rental,
  SummaryMetrics,
  Vehicle,
  DocumentItem,
  VehicleFinancialSummary,
} from '../types';

export const VehiclesApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Vehicle>>('/vehicles', { params })).data,
  create: async (payload: Partial<Vehicle>) => (await api.post<Vehicle>('/vehicles', payload)).data,
  update: async (id: string, payload: Partial<Vehicle>) =>
    (await api.patch<Vehicle>(`/vehicles/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/vehicles/${id}`),
  sell: async (id: string, payload: { sale_date: string; sale_price: string; sale_fees: string }) =>
    (await api.post<Vehicle>(`/vehicles/${id}/sell`, payload)).data,
  financial: async (id: string) =>
    (await api.get<VehicleFinancialSummary>(`/vehicles/${id}/financial`)).data,
};

export const DriversApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Driver>>('/drivers', { params })).data,
  create: async (payload: Partial<Driver>) => (await api.post<Driver>('/drivers', payload)).data,
  update: async (id: string, payload: Partial<Driver>) =>
    (await api.patch<Driver>(`/drivers/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/drivers/${id}`),
};

export const VendorsApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Vendor>>('/vendors', { params })).data,
  create: async (payload: Partial<Vendor>) => (await api.post<Vendor>('/vendors', payload)).data,
  update: async (id: string, payload: Partial<Vendor>) =>
    (await api.patch<Vendor>(`/vendors/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/vendors/${id}`),
};

export const PartnersApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Partner>>('/partners', { params })).data,
  create: async (payload: Partial<Partner>) => (await api.post<Partner>('/partners', payload)).data,
  update: async (id: string, payload: Partial<Partner>) =>
    (await api.patch<Partner>(`/partners/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/partners/${id}`),
};

export const RentalsApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Rental>>('/rentals', { params })).data,
  create: async (payload: Partial<Rental>) => (await api.post<Rental>('/rentals', payload)).data,
  update: async (id: string, payload: Partial<Rental>) =>
    (await api.patch<Rental>(`/rentals/${id}`, payload)).data,
  close: async (id: string, payload: { end_date: string }) =>
    (await api.post<Rental>(`/rentals/${id}/close`, payload)).data,
  remove: async (id: string) => api.delete(`/rentals/${id}`),
};

export const ExpensesApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<Expense>>('/expenses', { params })).data,
  create: async (payload: Partial<Expense>) => (await api.post<Expense>('/expenses', payload)).data,
  update: async (id: string, payload: Partial<Expense>) =>
    (await api.patch<Expense>(`/expenses/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/expenses/${id}`),
};

export const RentPaymentsApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<RentPayment>>('/rent-payments', { params })).data,
  create: async (payload: Partial<RentPayment>) =>
    (await api.post<RentPayment>('/rent-payments', payload)).data,
  update: async (id: string, payload: Partial<RentPayment>) =>
    (await api.patch<RentPayment>(`/rent-payments/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/rent-payments/${id}`),
};

export const CapitalApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<CapitalEntry>>('/capital', { params })).data,
  create: async (payload: Partial<CapitalEntry>) => (await api.post<CapitalEntry>('/capital', payload)).data,
  update: async (id: string, payload: Partial<CapitalEntry>) =>
    (await api.patch<CapitalEntry>(`/capital/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/capital/${id}`),
};

export const CashApi = {
  list: async (params: Record<string, unknown> = {}) =>
    (await api.get<PaginatedResponse<CashTxn>>('/cash', { params })).data,
  create: async (payload: Partial<CashTxn>) => (await api.post<CashTxn>('/cash', payload)).data,
  update: async (id: string, payload: Partial<CashTxn>) =>
    (await api.patch<CashTxn>(`/cash/${id}`, payload)).data,
  remove: async (id: string) => api.delete(`/cash/${id}`),
};

export const SummaryApi = {
  get: async () => (await api.get<SummaryMetrics>('/summary')).data,
};

export const BillingApi = {
  run: async () => (await api.post<{ generated: string[] }>('/billing/run', {})).data,
};

export const DocumentsApi = {
  list: async (entity_type: 'vehicle' | 'driver' | 'rental', entity_id: string) =>
    (await api.get<{ items: DocumentItem[] }>('/documents', { params: { entity_type, entity_id } })).data.items,
  upload: async (entity_type: 'vehicle' | 'driver' | 'rental', entity_id: string, file: File) => {
    const formData = new FormData();
    formData.append('entity_type', entity_type);
    formData.append('entity_id', entity_id);
    formData.append('file', file);
    const response = await api.post<DocumentItem>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  remove: async (id: string) => api.delete(`/documents/${id}`),
  downloadUrl: (id: string) => `${apiBaseURL}/documents/${id}/download`,
};

