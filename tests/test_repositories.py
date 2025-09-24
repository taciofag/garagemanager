import pytest
from datetime import date
from decimal import Decimal

from app.repositories.driver import DriverRepository
from app.repositories.vehicle import VehicleRepository
from app.models.driver import DriverStatus


@pytest.mark.anyio
async def test_vehicle_repository_create(session):
    driver_repo = DriverRepository(session)
    driver = await driver_repo.create_driver(
        {
            "name": "Repo Driver",
            "cpf": "111.111.111-11",
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
            "plate": "REP1234",
            "renavam": "RENAREP123",
            "vin": "VINREP1234567",
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
