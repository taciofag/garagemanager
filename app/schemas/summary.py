from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total_vehicles_stock: int
    vehicles_rented: int
    vehicles_sold_ytd: int
    capital_in_total: Decimal
    capital_out_total: Decimal
    rent_collected_ytd: Decimal
    profit_realized_sales_ytd: Decimal

    model_config = {
        "json_encoders": {Decimal: lambda v: str(v)},
    }
