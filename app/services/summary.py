from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models.capital import CapitalEntry, CapitalType
from ..models.cash import CashTxn, CashTxnType
from ..models.common import quantize_decimal
from ..models.expense import Expense, ExpenseCategory
from ..models.maintenance import (
    MaintenanceOccurrence,
    MaintenanceOccurrenceStatus,
)
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


def _ensure_decimal(value: Decimal | int | float | None) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


async def get_summary(session: AsyncSession, today: date | None = None) -> SummaryResponse:
    today = today or date.today()
    year_start = date(today.year, 1, 1)

    vehicles_sold_ytd = await session.scalar(
        select(func.count()).where(
            and_(
                Vehicle.status == VehicleStatus.SOLD,
                Vehicle.sale_date >= year_start,
                Vehicle.sale_date <= today,
            )
        )
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
    total_stock = status_counts.get(VehicleStatus.STOCK.value, 0)
    vehicles_rented = status_counts.get(VehicleStatus.RENTED.value, 0)

    # Cash balance
    cash_totals = await session.execute(
        select(
            func.coalesce(
                func.sum(
                    case((CashTxn.type == CashTxnType.INFLOW, CashTxn.amount), else_=0)
                ),
                0,
            ),
            func.coalesce(
                func.sum(
                    case((CashTxn.type == CashTxnType.OUTFLOW, CashTxn.amount), else_=0)
                ),
                0,
            ),
        )
    )
    cash_in_raw, cash_out_raw = cash_totals.one()
    cash_in = _ensure_decimal(cash_in_raw)
    cash_out = _ensure_decimal(cash_out_raw)
    cash_balance = quantize_decimal(cash_in - cash_out) or Decimal("0")

    # Outstanding rent
    due_expr = func.coalesce(RentPayment.due_amount, 0)
    late_fee_expr = func.coalesce(RentPayment.late_fee, 0)
    paid_expr = func.coalesce(RentPayment.paid_amount, 0)
    balance_expr = due_expr + late_fee_expr - paid_expr

    outstanding_row = await session.execute(
        select(
            func.coalesce(func.sum(case((balance_expr > 0, balance_expr), else_=0)), 0),
            func.coalesce(func.sum(case(((due_expr + late_fee_expr) > paid_expr, 1), else_=0)), 0),
        )
    )
    outstanding_total_raw, open_rent_payments_raw = outstanding_row.one()
    outstanding_total_decimal = _ensure_decimal(outstanding_total_raw)
    outstanding_rent_total = quantize_decimal(outstanding_total_decimal) or Decimal("0")
    open_rent_payments = int(open_rent_payments_raw or 0)

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
        due_val = _ensure_decimal(due_amount)
        late_val = _ensure_decimal(late_fee)
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
        collected_map[key] += _ensure_decimal(paid_amount)

    expense_rows = (
        await session.execute(
            select(Expense.date, Expense.amount).where(Expense.date >= range_start)
        )
    ).all()
    for expense_date, amount in expense_rows:
        if not expense_date:
            continue
        key = (expense_date.year, expense_date.month)
        expense_map[key] += _ensure_decimal(amount)

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
            select(Expense.category, func.coalesce(func.sum(Expense.amount), 0))
            .where(and_(Expense.date >= year_start, Expense.date <= today))
            .group_by(Expense.category)
        )
    ).all()
    expenses_by_category_ytd: list[SummaryValuePoint] = []
    expenses_by_category_ytd_total = Decimal("0")
    for category, total in category_rows:
        decimal_total = quantize_decimal(_ensure_decimal(total)) or Decimal("0")
        expenses_by_category_ytd_total += decimal_total
        label = (
            EXPENSE_CATEGORY_LABELS.get(category) if isinstance(category, ExpenseCategory) else str(category)
        )
        if not label and hasattr(category, "value"):
            label = EXPENSE_CATEGORY_LABELS.get(category, category.value)
        expenses_by_category_ytd.append(
            SummaryValuePoint(
                label=label or str(category),
                value=decimal_total,
            )
        )

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
    capital_overall = {"contribution": Decimal("0"), "withdrawal": Decimal("0")}
    for partner, entry_type, amount in capital_rows:
        bucket = capital_totals.setdefault(partner, {"contribution": Decimal("0"), "withdrawal": Decimal("0")})
        decimal_amount = _ensure_decimal(amount)
        if entry_type == CapitalType.CONTRIBUTION:
            bucket["contribution"] += decimal_amount
            capital_overall["contribution"] += decimal_amount
        else:
            bucket["withdrawal"] += decimal_amount
            capital_overall["withdrawal"] += decimal_amount
    capital_balance_by_partner = [
        SummaryPartnerBalance(
            partner=partner,
            contribution_total=quantize_decimal(values["contribution"]) or Decimal("0"),
            withdrawal_total=quantize_decimal(values["withdrawal"]) or Decimal("0"),
            balance=quantize_decimal(values["contribution"] - values["withdrawal"]) or Decimal("0"),
        )
        for partner, values in sorted(capital_totals.items())
    ]
    capital_in_total = quantize_decimal(capital_overall["contribution"]) or Decimal("0")
    capital_out_total = quantize_decimal(capital_overall["withdrawal"]) or Decimal("0")

    current_month_key = (today.year, today.month)
    rent_due_current_month = quantize_decimal(due_map[current_month_key]) or Decimal("0")
    rent_collected_current_month = quantize_decimal(collected_map[current_month_key]) or Decimal("0")

    acquisition_outflow = await session.scalar(
        select(func.coalesce(func.sum(Vehicle.acquisition_price), 0)).where(
            and_(
                Vehicle.acquisition_date >= year_start,
                Vehicle.acquisition_date <= today,
            )
        )
    )

    sale_revenue = await session.scalar(
        select(func.coalesce(func.sum(Vehicle.sale_price), 0)).where(
            and_(
                Vehicle.sale_date.is_not(None),
                Vehicle.sale_date >= year_start,
                Vehicle.sale_date <= today,
            )
        )
    )

    current_month_start = _month_start(today)
    next_month_start = _next_month_start(current_month_start)
    maintenance_stats = await session.execute(
        select(
            func.count(),
            func.coalesce(
                func.sum(case((MaintenanceOccurrence.due_date < today, 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                MaintenanceOccurrence.due_date >= current_month_start,
                                MaintenanceOccurrence.due_date < next_month_start,
                            ),
                            MaintenanceOccurrence.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        ).where(MaintenanceOccurrence.status == MaintenanceOccurrenceStatus.OPEN)
    )
    maintenance_open_raw, maintenance_overdue_raw, maintenance_month_raw = maintenance_stats.one()
    maintenance_open_total = int(maintenance_open_raw or 0)
    maintenance_overdue_total = int(maintenance_overdue_raw or 0)
    maintenance_month_estimated = quantize_decimal(_ensure_decimal(maintenance_month_raw)) or Decimal("0")

    return SummaryResponse(
        total_vehicles_stock=int(total_stock or 0),
        vehicles_rented=int(vehicles_rented or 0),
        vehicles_sold_ytd=int(vehicles_sold_ytd or 0),
        capital_in_total=quantize_decimal(capital_in_total) or Decimal("0"),
        capital_out_total=quantize_decimal(capital_out_total) or Decimal("0"),
        rent_collected_ytd=quantize_decimal(rent_collected_ytd) or Decimal("0"),
        rent_due_current_month=rent_due_current_month,
        rent_collected_current_month=rent_collected_current_month,
        profit_realized_sales_ytd=quantize_decimal(profit_realized_sales_ytd) or Decimal("0"),
        vehicle_purchase_outflow_ytd=quantize_decimal(acquisition_outflow) or Decimal("0"),
        vehicle_sale_revenue_ytd=quantize_decimal(sale_revenue) or Decimal("0"),
        outstanding_rent_total=outstanding_rent_total,
        open_rent_payments=open_rent_payments,
        cash_balance=cash_balance,
        maintenance_open_total=maintenance_open_total,
        maintenance_overdue_total=maintenance_overdue_total,
        maintenance_month_estimated=maintenance_month_estimated,
        vehicle_status_breakdown=vehicle_status_breakdown,
        rent_collection_last_6_months=rent_collection_last_6_months,
        expenses_last_6_months=expenses_last_6_months,
        expenses_by_category_ytd=expenses_by_category_ytd,
        expenses_by_category_ytd_total=quantize_decimal(expenses_by_category_ytd_total) or Decimal("0"),
        capital_balance_by_partner=capital_balance_by_partner,
    )
EXPENSE_CATEGORY_LABELS: dict[ExpenseCategory, str] = {
    ExpenseCategory.PARTS: "Peças",
    ExpenseCategory.REPAIR: "Reparo",
    ExpenseCategory.TOWING: "Guincho",
    ExpenseCategory.DOCS: "Documentação",
    ExpenseCategory.AUCTION_FEE: "Taxa de leilão",
    ExpenseCategory.TRANSFER: "Transferência",
    ExpenseCategory.INSPECTION: "Inspeção",
    ExpenseCategory.OTHER: "Outros",
}
