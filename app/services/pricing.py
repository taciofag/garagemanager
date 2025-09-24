from __future__ import annotations

from decimal import Decimal
from typing import Optional

from ..models.vehicle import Vehicle


def calculate_vehicle_financials(vehicle: Vehicle) -> dict[str, Optional[Decimal]]:
    vehicle.sync_status()
    return {
        "total_expenses": vehicle.total_expenses,
        "total_cost": vehicle.total_cost,
        "sale_net": vehicle.sale_net,
        "profit": vehicle.profit,
        "roi": vehicle.roi,
    }

