export interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface Vehicle {
  id: string;
  plate: string;
  renavam: string;
  vin: string;
  manufacture_year: number;
  model_year: number;
  make: string;
  model: string;
  color?: string;
  acquisition_date: string;
  acquisition_price: string;
  sale_date?: string;
  sale_price?: string;
  sale_fees?: string;
  current_driver_id?: string;
  odometer_in?: number;
  notes?: string;
  status: 'STOCK' | 'RENTED' | 'SOLD';
  total_expenses: string;
  total_cost: string;
  sale_net?: string;
  profit?: string;
  roi?: string;
}

export interface VehicleRentalSummary {
  id: string;
  driver_id: string;
  start_date: string;
  end_date?: string;
  status: 'Active' | 'Paused' | 'Closed';
  payments: RentPayment[];
  total_due: string;
  total_paid: string;
  total_late_fee: string;
}

export interface VehicleFinancialSummary {
  vehicle: Vehicle;
  acquisition_price: string;
  total_expenses: string;
  expenses: Expense[];
  rentals: VehicleRentalSummary[];
  total_rent_paid: string;
  total_rent_due: string;
  total_late_fee: string;
  sale_price?: string;
  sale_fees?: string;
  sale_net?: string;
  total_cost: string;
  total_income: string;
  profit?: string;
}

export interface Vendor {
  id: string;
  name: string;
  type: 'DEALER' | 'MECHANIC' | 'AUCTION' | 'PARTS' | 'SERVICE' | 'OTHER';
  phone?: string;
  notes?: string;
}
export interface Partner {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}


export interface Driver {
  id: string;
  name: string;
  cpf: string;
  phone?: string;
  start_date: string;
  weekly_rate: string;
  commission_pct: string;
  deposit_held: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  notes?: string;
}

export interface Rental {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_date: string;
  end_date?: string;
  weekly_rate: string;
  deposit: string;
  billing_day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  status: 'Active' | 'Paused' | 'Closed';
  notes?: string;
  minimum_term_months: number;
}

export interface Expense {
  id: string;
  vehicle_id: string;
  date: string;
  vendor_id?: string;
  category: string;
  description: string;
  invoice_no?: string;
  amount: string;
  paid_with?: string;
  notes?: string;
}

export interface RentPayment {
  id: string;
  rental_id: string;
  period_start: string;
  period_end: string;
  weekly_rate: string;
  weeks: number;
  due_amount: string;
  paid_amount: string;
  payment_date?: string;
  late_fee: string;
  balance: string;
  status: 'scheduled' | 'overdue' | 'partial' | 'paid';
  method?: string;
  notes?: string;
}

export interface CapitalEntry {
  id: string;
  partner: string;
  date: string;
  type: 'Contribution' | 'Withdrawal';
  amount: string;
  notes?: string;
}

export interface CashCategory {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  is_system: boolean;
  description?: string;
}

export interface CashTxn {
  id: string;
  date: string;
  type: 'Inflow' | 'Outflow';
  category_id: string;
  category: CashCategory;
  amount: string;
  method?: string;
  related_vehicle_id?: string;
  related_rental_id?: string;
  related_expense_id?: string;
  related_capital_id?: string;
  notes?: string;
}

export interface SummaryVehicleStatus {
  status: Vehicle['status'];
  count: number;
}

export interface SummaryRentSeriesPoint {
  label: string;
  due: string;
  collected: string;
}

export interface SummaryValuePoint {
  label: string;
  value: string;
}

export interface SummaryPartnerBalance {
  partner: string;
  contribution_total: string;
  withdrawal_total: string;
  balance: string;
}

export interface SummaryMetrics {
  total_vehicles_stock: number;
  vehicles_rented: number;
  vehicles_sold_ytd: number;
  capital_in_total: string;
  capital_out_total: string;
  rent_collected_ytd: string;
  rent_due_current_month: string;
  rent_collected_current_month: string;
  profit_realized_sales_ytd: string;
  vehicle_purchase_outflow_ytd: string;
  vehicle_sale_revenue_ytd: string;
  outstanding_rent_total: string;
  open_rent_payments: number;
  cash_balance: string;
  maintenance_open_total: number;
  maintenance_overdue_total: number;
  maintenance_month_estimated: string;
  vehicle_status_breakdown: SummaryVehicleStatus[];
  rent_collection_last_6_months: SummaryRentSeriesPoint[];
  expenses_last_6_months: SummaryValuePoint[];
  expenses_by_category_ytd: SummaryValuePoint[];
  expenses_by_category_ytd_total: string;
  capital_balance_by_partner: SummaryPartnerBalance[];
}

export interface User {
  id: number;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_admin: boolean;
  avatar_url?: string;
}

export interface DocumentItem {
  id: string;
  entity_type: 'vehicle' | 'driver' | 'rental';
  entity_id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

export type MaintenanceCategory =
  | 'Insurance'
  | 'Tracker'
  | 'OilChange'
  | 'Tires'
  | 'IPVA'
  | 'Inspection'
  | 'Service'
  | 'Other';

export type MaintenanceFrequency = 'Monthly' | 'Quarterly' | 'Semiannual' | 'Annual' | 'Kilometer' | 'OnDemand';

export type MaintenanceStatus = 'OPEN' | 'COMPLETED' | 'SKIPPED';

export interface VehicleMaintenanceTask {
  id: string;
  vehicle_id: string;
  title: string;
  category: MaintenanceCategory;
  frequency?: MaintenanceFrequency;
  due_date?: string;
  odometer_due?: number;
  amount: string;
  status: MaintenanceStatus;
  completed_at?: string;
  notes?: string;
  vendor_id?: string;
  vendor_name?: string;
  created_at: string;
  updated_at: string;
  series_id: string;
}
