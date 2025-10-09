from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models.cash import CashCategory, CashTxn
from app.models.maintenance import (
    MaintenanceFrequency,
    MaintenanceOccurrence,
    MaintenanceOccurrenceStatus,
    MaintenanceSeries,
)
from app.services.maintenance import MaintenanceService
from app.services.security import create_access_token
from app.schemas.common import PaginationParams


@pytest.fixture()
async def maintenance_service(session):
    return MaintenanceService(session)


async def _create_series(
    service: MaintenanceService,
    vehicle_id: str,
    *,
    title: str,
    frequency: MaintenanceFrequency,
    start_date: date,
    day_rule: str = "same_day",
    amount: Decimal = Decimal("100"),
) -> MaintenanceSeries:
    series = await service.create_series(
        {
            "vehicle_id": vehicle_id,
            "title": title,
            "category": "Test",
            "frequency": frequency,
            "start_date": start_date,
            "amount": amount,
            "day_rule": day_rule,
        }
    )
    return series


@pytest.mark.anyio
async def test_ensure_occurrences_idempotent(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Mensal",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date(2024, 1, 15),
    )

    horizon = date(2024, 4, 30)
    await maintenance_service.ensure_occurrences(series.id, horizon)
    first_rows = await maintenance_service.session.execute(
        select(MaintenanceOccurrence.due_date).where(MaintenanceOccurrence.series_id == series.id)
    )
    first_due_dates = sorted(row.due_date for row in first_rows)

    await maintenance_service.ensure_occurrences(series.id, horizon)
    second_rows = await maintenance_service.session.execute(
        select(MaintenanceOccurrence.due_date).where(MaintenanceOccurrence.series_id == series.id)
    )
    second_due_dates = sorted(row.due_date for row in second_rows)

    assert second_due_dates == first_due_dates
    assert len(second_due_dates) == len(set(second_due_dates))
    assert date(2024, 2, 15) in second_due_dates
    assert date(2024, 3, 15) in second_due_dates


@pytest.mark.anyio
async def test_monthly_day_31_rolls_to_month_end(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Mensal 31",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date(2024, 1, 31),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2024, 5, 31))

    rows = await maintenance_service.session.execute(
        select(MaintenanceOccurrence.due_date).where(MaintenanceOccurrence.series_id == series.id)
    )
    due_dates = sorted(row.due_date for row in rows)
    assert date(2024, 2, 29) in due_dates
    assert date(2024, 3, 31) in due_dates


@pytest.mark.anyio
async def test_yearly_leap_handling(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Anual",
        frequency=MaintenanceFrequency.YEARLY,
        start_date=date(2024, 2, 29),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2026, 12, 31))

    rows = await maintenance_service.session.execute(
        select(MaintenanceOccurrence.due_date).where(MaintenanceOccurrence.series_id == series.id)
    )
    due_dates = sorted(row.due_date for row in rows)
    assert date(2025, 2, 28) in due_dates


@pytest.mark.anyio
async def test_weekly_occurrence_spacing(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Semanal",
        frequency=MaintenanceFrequency.WEEKLY,
        start_date=date(2024, 5, 5),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2024, 8, 1))

    rows = await maintenance_service.session.execute(
        select(MaintenanceOccurrence.due_date)
        .where(MaintenanceOccurrence.series_id == series.id)
        .order_by(MaintenanceOccurrence.due_date.asc())
        .limit(6)
    )
    due_dates = [row.due_date for row in rows]
    assert due_dates[:4] == [
        date(2024, 5, 5),
        date(2024, 5, 12),
        date(2024, 5, 19),
        date(2024, 5, 26),
    ]


@pytest.mark.anyio
async def test_pay_advances_next_occurrence(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Pagamento",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date.today(),
    )

    horizon = MaintenanceService.desired_horizon(series.frequency)
    await maintenance_service.ensure_occurrences(series.id, horizon)

    occurrence_row = await maintenance_service.session.execute(
        select(MaintenanceOccurrence)
        .where(MaintenanceOccurrence.series_id == series.id)
        .order_by(MaintenanceOccurrence.due_date.asc())
        .limit(1)
    )
    occurrence = occurrence_row.scalar_one()

    result = await maintenance_service.pay_occurrence(occurrence.id, paid_at=date.today())
    assert result.occurrence.status == MaintenanceOccurrenceStatus.PAID

    await maintenance_service.session.refresh(series)
    assert series.next_due_date and series.next_due_date > occurrence.due_date

    next_exists = await maintenance_service.session.scalar(
        select(func.count()).where(
            MaintenanceOccurrence.series_id == series.id,
            MaintenanceOccurrence.due_date == series.next_due_date,
        )
    )
    assert next_exists


@pytest.mark.anyio
async def test_pay_occurrence_custom_date_and_note(maintenance_service: MaintenanceService, sample_vehicle):
    category = CashCategory(
        id="CAT-TEST",
        name="Manutenção",
        slug="manutencao-test",
        is_active=True,
        is_system=False,
    )
    maintenance_service.session.add(category)
    await maintenance_service.session.flush()

    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Pagamento custom",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date(2024, 1, 1),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2024, 3, 31))

    occ_row = await maintenance_service.session.execute(
        select(MaintenanceOccurrence)
        .where(MaintenanceOccurrence.series_id == series.id)
        .order_by(MaintenanceOccurrence.due_date.asc())
        .limit(1)
    )
    occurrence = occ_row.scalar_one()

    request_date = date(2024, 1, 10)
    note_text = "Pagamento manual"
    result = await maintenance_service.pay_occurrence(
        occurrence.id,
        paid_at=request_date,
        note=note_text,
        cash_category_id=category.id,
        payment_method="PIX",
    )

    assert result.occurrence.status == MaintenanceOccurrenceStatus.PAID
    assert result.occurrence.note == note_text
    assert result.occurrence.paid_at is not None
    assert result.occurrence.paid_at.date() == request_date
    assert result.occurrence.cash_category_id == category.id
    assert result.occurrence.cash_payment_method == "PIX"

    db_occurrence = await maintenance_service.session.get(MaintenanceOccurrence, occurrence.id)
    assert db_occurrence is not None
    assert db_occurrence.note == note_text
    assert db_occurrence.paid_at.date() == request_date
    assert db_occurrence.cash_txn_id is not None

    cash_txn = await maintenance_service.session.get(CashTxn, db_occurrence.cash_txn_id)
    assert cash_txn is not None
    assert cash_txn.amount == occurrence.amount
    assert cash_txn.method == "PIX"


@pytest.mark.anyio
async def test_history_scope_skips_open_items(maintenance_service: MaintenanceService, sample_vehicle):
    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="History",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date(2024, 1, 1),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2024, 6, 30))

    occ_row = await maintenance_service.session.execute(
        select(MaintenanceOccurrence)
        .where(MaintenanceOccurrence.series_id == series.id)
        .order_by(MaintenanceOccurrence.due_date.asc())
        .limit(1)
    )
    occurrence = occ_row.scalar_one()
    await maintenance_service.pay_occurrence(occurrence.id, paid_at=date(2024, 1, 5))

    params = PaginationParams(page=1, page_size=50)
    response = await maintenance_service.list_occurrences(
        params,
        scope="history",
        days=30,
    )

    assert all(item.status != MaintenanceOccurrenceStatus.OPEN for item in response.items)


@pytest.mark.anyio
async def test_reopen_occurrence_removes_cash_txn(maintenance_service: MaintenanceService, sample_vehicle):
    category = CashCategory(
        id="CAT-TEST2",
        name="Manutenção teste",
        slug="manutencao-teste",
        is_active=True,
        is_system=False,
    )
    maintenance_service.session.add(category)
    await maintenance_service.session.flush()

    series = await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="Reabrir",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=date(2024, 1, 1),
    )

    await maintenance_service.ensure_occurrences(series.id, date(2024, 3, 31))

    occ_row = await maintenance_service.session.execute(
        select(MaintenanceOccurrence)
        .where(MaintenanceOccurrence.series_id == series.id)
        .order_by(MaintenanceOccurrence.due_date.asc())
        .limit(1)
    )
    occurrence = occ_row.scalar_one()

    await maintenance_service.pay_occurrence(
        occurrence.id,
        paid_at=date(2024, 1, 2),
        note="Pago",
        cash_category_id=category.id,
        payment_method="transfer",
    )

    await maintenance_service.session.flush()
    db_occurrence = await maintenance_service.session.get(MaintenanceOccurrence, occurrence.id)
    assert db_occurrence and db_occurrence.cash_txn_id
    cash_txn_id = db_occurrence.cash_txn_id

    result = await maintenance_service.reopen_occurrence(occurrence.id)
    assert result.occurrence.status == MaintenanceOccurrenceStatus.OPEN
    assert result.occurrence.paid_at is None
    assert result.occurrence.note is None

    refreshed = await maintenance_service.session.get(MaintenanceOccurrence, occurrence.id)
    assert refreshed is not None
    assert refreshed.cash_txn_id is None
    assert refreshed.paid_at is None

    assert cash_txn_id is not None
    removed_txn = await maintenance_service.session.get(CashTxn, cash_txn_id)
    assert removed_txn is None
    assert result.occurrence.cash_txn_id is None


@pytest.mark.anyio
async def test_get_upcoming_occurrences(client, admin_user, maintenance_service: MaintenanceService, sample_vehicle):
    start = date.today() + timedelta(days=5)
    await _create_series(
        maintenance_service,
        sample_vehicle.id,
        title="API",
        frequency=MaintenanceFrequency.MONTHLY,
        start_date=start,
        amount=Decimal("50"),
    )
    await maintenance_service.session.commit()

    token = create_access_token(admin_user.email, ["user", "admin"])
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.get(
        "/maintenance/occurrences",
        params={"scope": "upcoming", "days": 30},
        headers=headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert "summary" in payload
    assert payload["page"] == 1
    assert payload["page_size"] > 0
    assert payload["total"] >= len(payload["items"])

    items = payload["items"]
    assert items
    horizon = date.today() + timedelta(days=30)
    for item in items:
        due = date.fromisoformat(item["due_date"])
        assert due <= horizon
        assert item["status"] == MaintenanceOccurrenceStatus.OPEN.value
