from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.capital import CapitalEntry, CapitalType
from ..models.cash import CashTxn, CashTxnType
from ..models.common import quantize_decimal
from ..models.expense import Expense
from ..models.rent_payment import RentPayment
from ..models.vehicle import Vehicle, VehicleStatus
from ..schemas.summary import (
    SummaryPartnerBalance,
    SummaryRentSeriesPoint,
    SummaryResponse,
    SummaryValuePoint,
    SummaryVehicleStatus,
)


def _month_start(reference: date) -> date:
    return date(reference.year, reference.month, 1)


def _next_month_start(reference: date) -> date:
    if reference.month == 12:
        return date(reference.year + 1, 1, 1)
    return date(reference.year, reference.month + 1, 1)


def _previous_month_start(reference: date) -> date:
    if reference.month == 1:
        return date(reference.year - 1, 12, 1)
    return date(reference.year, reference.month - 1, 1)


def _recent_month_starts(today: date, months: int = 6) -> list[date]:
    current = _month_start(today)
    sequence: list[date] = []
    for _ in range(months):
        sequence.append(current)
        current = _previous_month_start(current)
    sequence.reverse()
    return sequence


def _month_label(reference: date) -> str:
    return reference.strftime("%b/%y")


async def get_summary(session: AsyncSession, today: date | None = None) -> SummaryResponse:
    today = today or date.today()
    year_start = date(today.year, 1, 1)

    total_stock = await session.scalar(select(func.count()).where(Vehicle.status == VehicleStatus.STOCK))
    vehicles_rented = await session.scalar(select(func.count()).where(Vehicle.status == VehicleStatus.RENTED))
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

    # Vehicle status breakdown (ensure all statuses are represented)
    status_counts = {status.value: 0 for status in VehicleStatus}
    status_rows = await session.execute(
        select(Vehicle.status, func.count()).group_by(Vehicle.status)
    )
    for status, count in status_rows:
        key = status.value if isinstance(status, VehicleStatus) else str(status)
        status_counts[key] = int(count or 0)
    vehicle_status_breakdown = [
        SummaryVehicleStatus(status=status_key, count=count)
        for status_key, count in status_counts.items()
    ]

    # Cash balance
    cash_in = await session.scalar(
        select(func.coalesce(func.sum(CashTxn.amount), 0)).where(CashTxn.type == CashTxnType.INFLOW)
    )
    cash_out = await session.scalar(
        select(func.coalesce(func.sum(CashTxn.amount), 0)).where(CashTxn.type == CashTxnType.OUTFLOW)
    )
    cash_balance = quantize_decimal(Decimal(cash_in or 0) - Decimal(cash_out or 0)) or Decimal("0")

    # Outstanding rent
    open_rows = (
        await session.execute(
            select(RentPayment.due_amount, RentPayment.late_fee, RentPayment.paid_amount).where(
                (RentPayment.due_amount + RentPayment.late_fee) > RentPayment.paid_amount
            )
        )
    ).all()
    outstanding_total = Decimal("0")
    for due, late_fee, paid in open_rows:
        due_val = Decimal(due or 0)
        late_val = Decimal(late_fee or 0)
        paid_val = Decimal(paid or 0)
        balance = due_val + late_val - paid_val
        if balance > 0:
            outstanding_total += balance
    outstanding_rent_total = quantize_decimal(outstanding_total) or Decimal("0")
    open_rent_payments = len(open_rows)

    # Monthly series (last 6 months)
    month_starts = _recent_month_starts(today)
    range_start = month_starts[0]

    due_map: defaultdict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
    collected_map: defaultdict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
    expense_map: defaultdict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))

    rent_due_rows = (
        await session.execute(
            select(RentPayment.period_start, RentPayment.due_amount, RentPayment.late_fee).where(
                RentPayment.period_start >= range_start
            )
        )
    ).all()
    for period_start, due_amount, late_fee in rent_due_rows:
        if not period_start:
            continue
        key = (period_start.year, period_start.month)
        due_val = Decimal(due_amount or 0)
        late_val = Decimal(late_fee or 0)
        due_map[key] += due_val + late_val

    rent_paid_rows = (
        await session.execute(
            select(RentPayment.payment_date, RentPayment.paid_amount).where(
                and_(
                    RentPayment.payment_date.is_not(None),
                    RentPayment.payment_date >= range_start,
                )
            )
        )
    ).all()
    for payment_date, paid_amount in rent_paid_rows:
        if not payment_date:
            continue
        key = (payment_date.year, payment_date.month)
        collected_map[key] += Decimal(paid_amount or 0)

    expense_rows = (
        await session.execute(
            select(Expense.date, Expense.amount).where(Expense.date >= range_start)
        )
    ).all()
    for expense_date, amount in expense_rows:
        if not expense_date:
            continue
        key = (expense_date.year, expense_date.month)
        expense_map[key] += Decimal(amount or 0)

    rent_collection_last_6_months: list[SummaryRentSeriesPoint] = []
    expenses_last_6_months: list[SummaryValuePoint] = []
    for month_start in month_starts:
        key = (month_start.year, month_start.month)
        rent_collection_last_6_months.append(
            SummaryRentSeriesPoint(
                label=_month_label(month_start),
                due=quantize_decimal(due_map[key]) or Decimal("0"),
                collected=quantize_decimal(collected_map[key]) or Decimal("0"),
            )
        )
        expenses_last_6_months.append(
            SummaryValuePoint(
                label=_month_label(month_start),
                value=quantize_decimal(expense_map[key]) or Decimal("0"),
            )
        )

    # Expenses grouped by category (YTD)
    category_rows = (
        await session.execute(
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0)).where(
                and_(Expense.date >= year_start, Expense.date <= today)
            ).group_by(Expense.category)
        )
    ).all()
    expenses_by_category_ytd = [
        SummaryValuePoint(
            label=category.value if hasattr(category, "value") else str(category),
            value=quantize_decimal(Decimal(total or 0)) or Decimal("0"),
        )
        for category, total in category_rows
    ]

    # Capital balance per partner
    capital_rows = (
        await session.execute(
            select(
                CapitalEntry.partner,
                CapitalEntry.type,
                func.coalesce(func.sum(CapitalEntry.amount), 0),
            ).group_by(CapitalEntry.partner, CapitalEntry.type)
        )
    ).all()
    capital_totals: dict[str, dict[str, Decimal]] = {}
    for partner, entry_type, amount in capital_rows:
        bucket = capital_totals.setdefault(partner, {"contribution": Decimal("0"), "withdrawal": Decimal("0")})
        decimal_amount = Decimal(amount or 0)
        if entry_type == CapitalType.CONTRIBUTION:
            bucket["contribution"] += decimal_amount
        else:
            bucket["withdrawal"] += decimal_amount
    capital_balance_by_partner = [
        SummaryPartnerBalance(
            partner=partner,
            contribution_total=quantize_decimal(values["contribution"]) or Decimal("0"),
            withdrawal_total=quantize_decimal(values["withdrawal"]) or Decimal("0"),
            balance=quantize_decimal(values["contribution"] - values["withdrawal"]) or Decimal("0"),
        )
        for partner, values in sorted(capital_totals.items())
    ]

    return SummaryResponse(
        total_vehicles_stock=int(total_stock or 0),
        vehicles_rented=int(vehicles_rented or 0),
        vehicles_sold_ytd=int(vehicles_sold_ytd or 0),
        capital_in_total=quantize_decimal(capital_in_total) or Decimal("0"),
        capital_out_total=quantize_decimal(capital_out_total) or Decimal("0"),
        rent_collected_ytd=quantize_decimal(rent_collected_ytd) or Decimal("0"),
        profit_realized_sales_ytd=quantize_decimal(profit_realized_sales_ytd) or Decimal("0"),
        outstanding_rent_total=outstanding_rent_total,
        open_rent_payments=open_rent_payments,
        cash_balance=cash_balance,
        vehicle_status_breakdown=vehicle_status_breakdown,
        rent_collection_last_6_months=rent_collection_last_6_months,
        expenses_last_6_months=expenses_last_6_months,
        expenses_by_category_ytd=expenses_by_category_ytd,
        capital_balance_by_partner=capital_balance_by_partner,
    )
