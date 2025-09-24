from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.capital import CapitalEntry, CapitalType
from ..models.rent_payment import RentPayment
from ..models.vehicle import Vehicle, VehicleStatus
from ..schemas.summary import SummaryResponse


async def get_summary(session: AsyncSession, today: date | None = None) -> SummaryResponse:
    today = today or date.today()
    year_start = date(today.year, 1, 1)

    total_stock = await session.scalar(
        select(func.count()).where(Vehicle.status == VehicleStatus.STOCK)
    )
    vehicles_rented = await session.scalar(
        select(func.count()).where(Vehicle.status == VehicleStatus.RENTED)
    )
    vehicles_sold_ytd = await session.scalar(
        select(func.count()).where(
            and_(
                Vehicle.status == VehicleStatus.SOLD,
                Vehicle.sale_date >= year_start,
                Vehicle.sale_date <= today,
            )
        )
    )

    capital_in_total = await session.scalar(
        select(func.coalesce(func.sum(CapitalEntry.amount), 0)).where(CapitalEntry.type == CapitalType.CONTRIBUTION)
    )
    capital_out_total = await session.scalar(
        select(func.coalesce(func.sum(CapitalEntry.amount), 0)).where(CapitalEntry.type == CapitalType.WITHDRAWAL)
    )

    rent_collected_ytd = await session.scalar(
        select(func.coalesce(func.sum(RentPayment.paid_amount), 0)).where(
            and_(
                RentPayment.payment_date.is_not(None),
                RentPayment.payment_date >= year_start,
                RentPayment.payment_date <= today,
            )
        )
    )

    sold_stmt = (
        select(Vehicle)
        .options(selectinload(Vehicle.expenses))
        .where(
            and_(
                Vehicle.status == VehicleStatus.SOLD,
                Vehicle.sale_date >= year_start,
                Vehicle.sale_date <= today,
            )
        )
    )
    sold_vehicles = (await session.execute(sold_stmt)).scalars().all()
    profit_realized_sales_ytd = Decimal("0")
    for vehicle in sold_vehicles:
        vehicle.sync_status()
        profit = vehicle.profit
        if profit:
            profit_realized_sales_ytd += profit

    return SummaryResponse(
        total_vehicles_stock=int(total_stock or 0),
        vehicles_rented=int(vehicles_rented or 0),
        vehicles_sold_ytd=int(vehicles_sold_ytd or 0),
        capital_in_total=Decimal(capital_in_total or 0),
        capital_out_total=Decimal(capital_out_total or 0),
        rent_collected_ytd=Decimal(rent_collected_ytd or 0),
        profit_realized_sales_ytd=profit_realized_sales_ytd,
    )

