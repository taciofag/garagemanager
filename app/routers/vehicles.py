from __future__ import annotations

from typing import Optional

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.vehicle import VehicleStatus
from ..repositories.vehicle import VehicleRepository
from ..schemas.common import PaginatedResult, PaginationParams
from ..schemas.expense import ExpenseRead
from ..schemas.rent_payment import RentPaymentRead
from ..schemas.vehicle import VehicleCreate, VehicleFinancialSummary, VehicleRead, VehicleRentalSummary, VehicleSell, VehicleUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def serialize_vehicle(vehicle) -> VehicleRead:
    vehicle.sync_status()
    return VehicleRead.model_validate(vehicle)


@router.get("", response_model=dict)
async def list_vehicles(
    pagination: PaginationParams = Depends(get_pagination_params),
    status: Optional[VehicleStatus] = Query(default=None),
    make: Optional[str] = Query(default=None),
    model: Optional[str] = Query(default=None),
    year_from: Optional[int] = Query(default=None),
    year_to: Optional[int] = Query(default=None),
    in_stock: Optional[bool] = Query(default=None),
    rented: Optional[bool] = Query(default=None),
    sold: Optional[bool] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = VehicleRepository(session)
    result: PaginatedResult = await repo.list_vehicles(
        pagination,
        status=status,
        make=make,
        model=model,
        year_from=year_from,
        year_to=year_to,
        in_stock=in_stock,
        rented=rented,
        sold=sold,
    )
    items = [serialize_vehicle(vehicle) for vehicle in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=VehicleRead, status_code=status.HTTP_201_CREATED)
async def create_vehicle(
    payload: VehicleCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    try:
        vehicle = await repo.create_vehicle(payload.model_dump(exclude_none=True))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Placa, Renavam e chassi devem ser únicos.") from exc
    return serialize_vehicle(vehicle)


@router.get("/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await session.commit()
    return serialize_vehicle(vehicle)

@router.get("/{vehicle_id}/financial", response_model=VehicleFinancialSummary)
async def get_vehicle_financial(
    vehicle_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> VehicleFinancialSummary:
    repo = VehicleRepository(session)
    vehicle = await repo.get_with_financials(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")

    expenses = sorted(vehicle.expenses, key=lambda exp: exp.date)
    expenses_read = [
        ExpenseRead.model_validate(expense) for expense in expenses
    ]
    total_expenses = sum((expense.amount or Decimal('0')) for expense in expenses)

    rentals = sorted(vehicle.rentals, key=lambda rental: rental.start_date)
    rental_summaries = []
    total_rent_paid = Decimal('0')
    total_rent_due = Decimal('0')
    total_late_fee = Decimal('0')

    for rental in rentals:
        payments = sorted(rental.payments, key=lambda payment: payment.period_start)
        payment_reads = [RentPaymentRead.model_validate(payment) for payment in payments]
        rental_due = sum((payment.due_amount or Decimal('0')) for payment in payments)
        rental_paid = sum((payment.paid_amount or Decimal('0')) for payment in payments)
        rental_late = sum((payment.late_fee or Decimal('0')) for payment in payments)
        total_rent_paid += rental_paid
        total_rent_due += rental_due
        total_late_fee += rental_late
        rental_summaries.append({
            "id": rental.id,
            "driver_id": rental.driver_id,
            "start_date": rental.start_date,
            "end_date": rental.end_date,
            "status": rental.status,
            "payments": payment_reads,
            "total_due": rental_due,
            "total_paid": rental_paid,
            "total_late_fee": rental_late,
        })

    acquisition_price = vehicle.acquisition_price or Decimal('0')
    total_cost = acquisition_price + total_expenses
    sale_net = vehicle.sale_net or Decimal('0')
    sale_price = vehicle.sale_price or None
    sale_fees = vehicle.sale_fees or None
    total_income = total_rent_paid + total_late_fee + sale_net
    profit = total_income - total_cost

    summary = VehicleFinancialSummary(
        vehicle=VehicleRead.model_validate(vehicle),
        acquisition_price=acquisition_price,
        total_expenses=total_expenses,
        expenses=expenses_read,
        rentals=[VehicleRentalSummary(**r) for r in rental_summaries],
        total_rent_paid=total_rent_paid,
        total_rent_due=total_rent_due,
        total_late_fee=total_late_fee,
        sale_price=sale_price,
        sale_fees=sale_fees,
        sale_net=vehicle.sale_net,
        total_cost=total_cost,
        total_income=total_income,
        profit=profit,
    )
    await session.commit()
    return summary


@router.patch("/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(
    vehicle_id: str,
    payload: VehicleUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        updated = await repo.update_vehicle(vehicle, payload.model_dump(exclude_none=True))
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Placa, Renavam e chassi devem ser únicos.") from exc
    return serialize_vehicle(updated)


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await repo.delete(vehicle)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{vehicle_id}/sell", response_model=VehicleRead)
async def sell_vehicle(
    vehicle_id: str,
    payload: VehicleSell,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> VehicleRead:
    repo = VehicleRepository(session)
    vehicle = await repo.get(vehicle_id)
    if not vehicle:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Vehicle not found")
    updated = await repo.sell_vehicle(vehicle, payload)
    await session.commit()
    return serialize_vehicle(updated)

