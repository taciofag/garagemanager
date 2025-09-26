import pytest
import uuid
from datetime import date
from decimal import Decimal

from app.repositories.driver import DriverRepository
from app.repositories.vehicle import VehicleRepository
from app.repositories.expense import ExpenseRepository
from app.repositories.cash import CashRepository
from app.repositories.capital import CapitalRepository
from app.repositories.partner import PartnerRepository
from app.models.driver import DriverStatus
from app.models.cash import CashTxnType
from app.models.expense import ExpenseCategory
from app.models.capital import CapitalType
from app.schemas.common import PaginationParams


@pytest.mark.anyio
async def test_vehicle_repository_create(session):
    driver_repo = DriverRepository(session)
    unique_seed = uuid.uuid4()
    cpf_suffix = f"{unique_seed.int % 90 + 10:02d}"
    tag = unique_seed.hex[:6].upper()
    driver = await driver_repo.create_driver(
        {
            "id": f"DRV-{tag[:4]}",
            "name": "Repo Driver",
            "cpf": f"111.111.111-{cpf_suffix}",
            "phone": None,
            "start_date": date.today(),
            "weekly_rate": Decimal("450"),
            "commission_pct": Decimal("0.05"),
            "deposit_held": Decimal("500"),
            "status": DriverStatus.ACTIVE,
        }
    )
    vehicle_repo = VehicleRepository(session)
    vehicle = await vehicle_repo.create_vehicle(
        {
            "id": f"CAR-{tag}",
            "plate": f"REP{tag[:4]}",
            "renavam": f"REN{tag}",
            "vin": f"VIN{uuid.uuid4().hex[:14].upper()}",
            "manufacture_year": 2020,
            "model_year": 2021,
            "make": "Repo",
            "model": "Test",
            "color": "Red",
            "acquisition_date": date.today(),
            "acquisition_price": Decimal("40000"),
            "current_driver_id": driver.id,
        }
    )
    await session.commit()

    fetched = await vehicle_repo.get(vehicle.id)
    assert fetched is not None
    assert fetched.current_driver_id == driver.id
    assert fetched.status.name == "RENTED"


@pytest.mark.anyio
async def test_expense_auto_creates_cash(session, sample_vehicle):
    expense_repo = ExpenseRepository(session)
    cash_repo = CashRepository(session)
    expense = await expense_repo.create_expense(
        {
            "vehicle_id": sample_vehicle.id,
            "date": date.today(),
            "category": ExpenseCategory.PARTS,
            "description": "Troca de oleo",
            "invoice_no": None,
            "amount": Decimal("150.00"),
            "paid_with": "Pix",
        }
    )

    txn = await cash_repo.get_by_related_expense(expense.id)
    assert txn is not None
    assert txn.type == CashTxnType.OUTFLOW
    assert txn.amount == Decimal("150.00")
    assert txn.related_vehicle_id == sample_vehicle.id

    await expense_repo.update_expense(expense, {"amount": Decimal("175.00")})
    updated_txn = await cash_repo.get_by_related_expense(expense.id)
    assert updated_txn.amount == Decimal("175.00")

    await expense_repo.delete_expense(expense)
    removed = await cash_repo.get_by_related_expense(expense.id)
    assert removed is None


@pytest.mark.anyio
async def test_capital_auto_creates_cash(session):
    capital_repo = CapitalRepository(session)
    cash_repo = CashRepository(session)
    entry = await capital_repo.create_capital(
        {
            "partner": "Socio Teste",
            "date": date.today(),
            "type": CapitalType.CONTRIBUTION,
            "amount": Decimal("2000.00"),
            "notes": "Aporte inicial",
        }
    )

    txn = await cash_repo.get_by_related_capital(entry.id)
    assert txn is not None
    assert txn.type == CashTxnType.INFLOW
    assert txn.amount == Decimal("2000.00")

    await capital_repo.update_capital(entry, {"notes": "Aporte ajustado", "type": CapitalType.WITHDRAWAL})
    updated = await cash_repo.get_by_related_capital(entry.id)
    assert updated.type == CashTxnType.OUTFLOW
    assert updated.notes and "Aporte ajustado" in updated.notes

    await capital_repo.delete_capital_entry(entry)
    removed_txn = await cash_repo.get_by_related_capital(entry.id)
    assert removed_txn is None

@pytest.mark.anyio
async def test_partner_repository_crud(session):
    repo = PartnerRepository(session)
    partner = await repo.create_partner({"name": "Repo Partner"})
    assert partner.id.startswith("PRT-")

    await repo.update_partner(partner, {"phone": "+551199999999"})
    assert partner.phone == "+551199999999"

    result = await repo.list_partners(PaginationParams(page=1, page_size=10))
    assert any(item.name == "Repo Partner" for item in result.items)
