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

export interface CashTxn {
  id: string;
  date: string;
  type: 'Inflow' | 'Outflow';
  category: string;
  amount: string;
  method?: string;
  related_vehicle_id?: string;
  related_rental_id?: string;
  notes?: string;
}

export interface SummaryMetrics {
  total_vehicles_stock: number;
  vehicles_rented: number;
  vehicles_sold_ytd: number;
  capital_in_total: string;
  capital_out_total: string;
  rent_collected_ytd: string;
  profit_realized_sales_ytd: string;
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
