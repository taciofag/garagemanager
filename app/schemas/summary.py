from __future__ import annotations

from decimal import Decimal
from typing import List

from pydantic import BaseModel


class SummaryVehicleStatus(BaseModel):
    status: str
    count: int


class SummaryRentSeriesPoint(BaseModel):
    label: str
    due: Decimal
    collected: Decimal


class SummaryValuePoint(BaseModel):
    label: str
    value: Decimal


class SummaryPartnerBalance(BaseModel):
    partner: str
    contribution_total: Decimal
    withdrawal_total: Decimal
    balance: Decimal


class SummaryResponse(BaseModel):
    total_vehicles_stock: int
    vehicles_rented: int
    vehicles_sold_ytd: int
    capital_in_total: Decimal
    capital_out_total: Decimal
    rent_collected_ytd: Decimal
    rent_due_current_month: Decimal
    rent_collected_current_month: Decimal
    profit_realized_sales_ytd: Decimal
    vehicle_purchase_outflow_ytd: Decimal
    vehicle_sale_revenue_ytd: Decimal
    outstanding_rent_total: Decimal
    open_rent_payments: int
    cash_balance: Decimal
    maintenance_open_total: int
    maintenance_overdue_total: int
    maintenance_month_estimated: Decimal
    vehicle_status_breakdown: List[SummaryVehicleStatus]
    rent_collection_last_6_months: List[SummaryRentSeriesPoint]
    expenses_last_6_months: List[SummaryValuePoint]
    expenses_by_category_ytd: List[SummaryValuePoint]
    expenses_by_category_ytd_total: Decimal
    capital_balance_by_partner: List[SummaryPartnerBalance]

    model_config = {
        "json_encoders": {Decimal: lambda v: str(v)},
    }
