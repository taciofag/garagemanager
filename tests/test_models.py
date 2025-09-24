from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models.rent_payment import RentPayment
from app.models.vehicle import Vehicle


@pytest.mark.anyio
async def test_vehicle_financials(sample_vehicle):
    vehicle: Vehicle = sample_vehicle
    vehicle.expenses = []
    assert vehicle.status.name == "STOCK"
    assert vehicle.total_cost == Decimal("30000.00")
    assert vehicle.sale_net is None

    vehicle.sale_price = Decimal("35000")
    vehicle.sale_fees = Decimal("500")
    vehicle.sale_date = date.today()
    vehicle.expenses = []
    vehicle.sync_status()
    assert vehicle.status.name == "SOLD"
    assert vehicle.sale_net == Decimal("34500.00")


@pytest.mark.anyio
async def test_rent_payment_recompute():
    payment = RentPayment(
        id="PAY-TEST",
        rental_id="RENT-TEST",
        period_start=date.today() - timedelta(days=7),
        period_end=date.today() - timedelta(days=1),
        weekly_rate=Decimal("400"),
        paid_amount=Decimal("100"),
        late_fee=Decimal("20"),
        due_amount=Decimal("0"),
        weeks=1,
    )
    payment.recompute_totals()
    assert payment.weeks == 1
    assert payment.due_amount == Decimal("400.00")
    assert payment.balance == Decimal("320.00")
