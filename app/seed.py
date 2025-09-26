from __future__ import annotations

import asyncio
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select

from .db import AsyncSessionLocal
from .models.capital import CapitalType
from .models.cash import CashTxnType
from .models.driver import DriverStatus
from .models.expense import ExpenseCategory
from .models.rental import BillingDay, RentalStatus
from .models.vehicle import Vehicle, VehicleStatus
from .models.vendor import VendorType
from .repositories.capital import CapitalRepository
from .repositories.partner import PartnerRepository
from .repositories.cash import CashRepository
from .repositories.driver import DriverRepository
from .repositories.expense import ExpenseRepository
from .repositories.rent_payment import RentPaymentRepository
from .repositories.rental import RentalRepository
from .repositories.vehicle import VehicleRepository
from .repositories.vendor import VendorRepository


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        vehicles_count = await session.scalar(select(func.count()).select_from(Vehicle))
        if vehicles_count and vehicles_count > 0:
            print("Database already seeded.")
            return

        vehicle_repo = VehicleRepository(session)
        driver_repo = DriverRepository(session)
        vendor_repo = VendorRepository(session)
        expense_repo = ExpenseRepository(session)
        rental_repo = RentalRepository(session)
        payment_repo = RentPaymentRepository(session)
        partner_repo = PartnerRepository(session)
        capital_repo = CapitalRepository(session)
        cash_repo = CashRepository(session)

        driver1 = await driver_repo.create_driver(
            {
                "id": "DRV-0001",
                "name": "João Silva",
                "cpf": "123.456.789-00",
                "phone": "+55 11 99999-1111",
                "start_date": date.today() - timedelta(days=90),
                "weekly_rate": Decimal("500"),
                "commission_pct": Decimal("0.1"),
                "deposit_held": Decimal("1000"),
                "status": DriverStatus.ACTIVE,
                "notes": "Motorista destaque",
            }
        )
        driver2 = await driver_repo.create_driver(
            {
                "id": "DRV-0002",
                "name": "Maria Souza",
                "cpf": "987.654.321-00",
                "phone": "+55 11 98888-2222",
                "start_date": date.today() - timedelta(days=30),
                "weekly_rate": Decimal("480"),
                "commission_pct": Decimal("0.08"),
                "deposit_held": Decimal("800"),
                "status": DriverStatus.ACTIVE,
                "notes": None,
            }
        )

        vendor1 = await vendor_repo.create_vendor(
            {"id": "VND-0001", "name": "Auto Peas Center", "type": VendorType.PARTS}
        )
        vendor2 = await vendor_repo.create_vendor(
            {"id": "VND-0002", "name": "Oficina Turbo", "type": VendorType.MECHANIC}
        )

        partner1 = await partner_repo.create_partner(
            {"id": "PRT-0001", "name": "Sócio A"}
        )
        partner2 = await partner_repo.create_partner(
            {"id": "PRT-0002", "name": "Sócio B"}
        )

        vehicle1 = await vehicle_repo.create_vehicle(
            {
                "id": "CAR-0001",
                "plate": "ABC1D23",
                "renavam": "00123456789",
                "vin": "9BWZZZ377VT004251",
                "manufacture_year": 2020,
                "model_year": 2021,
                "make": "Hyundai",
                "model": "HB20",
                "color": "Prata",
                "acquisition_date": date.today() - timedelta(days=120),
                "acquisition_price": Decimal("45000"),
                "current_driver_id": driver1.id,
                "odometer_in": 32000,
                "notes": "Veículo em ótimo estado",
            }
        )
        vehicle2 = await vehicle_repo.create_vehicle(
            {
                "id": "CAR-0002",
                "plate": "DEF4G56",
                "renavam": "00123456790",
                "vin": "9BWZZZ377VT004252",
                "manufacture_year": 2019,
                "model_year": 2020,
                "make": "Toyota",
                "model": "Corolla",
                "color": "Preto",
                "acquisition_date": date.today() - timedelta(days=200),
                "acquisition_price": Decimal("70000"),
                "current_driver_id": None,
                "odometer_in": 45000,
                "notes": None,
            }
        )
        vehicle3 = await vehicle_repo.create_vehicle(
            {
                "id": "CAR-0003",
                "plate": "GHI7J89",
                "renavam": "00123456791",
                "vin": "9BWZZZ377VT004253",
                "manufacture_year": 2018,
                "model_year": 2019,
                "make": "Volkswagen",
                "model": "Golf",
                "color": "Branco",
                "acquisition_date": date.today() - timedelta(days=250),
                "acquisition_price": Decimal("60000"),
                "sale_date": date.today() - timedelta(days=10),
                "sale_price": Decimal("72000"),
                "sale_fees": Decimal("2000"),
                "current_driver_id": None,
                "odometer_in": 60000,
                "notes": "Vendido com garantia",
            }
        )

        await expense_repo.create_expense(
            {
                "id": "EXP-0001",
                "vehicle_id": vehicle1.id,
                "date": date.today() - timedelta(days=60),
                "vendor_id": vendor1.id,
                "category": ExpenseCategory.PARTS,
                "description": "Troca de pneus",
                "invoice_no": "NF123",
                "amount": Decimal("1500"),
                "paid_with": "Cartão",
            }
        )
        await expense_repo.create_expense(
            {
                "id": "EXP-0002",
                "vehicle_id": vehicle1.id,
                "date": date.today() - timedelta(days=30),
                "vendor_id": vendor2.id,
                "category": ExpenseCategory.REPAIR,
                "description": "Revisão",
                "invoice_no": "NF124",
                "amount": Decimal("800"),
                "paid_with": "Dinheiro",
            }
        )
        await expense_repo.create_expense(
            {
                "id": "EXP-0003",
                "vehicle_id": vehicle2.id,
                "date": date.today() - timedelta(days=20),
                "vendor_id": vendor2.id,
                "category": ExpenseCategory.REPAIR,
                "description": "Troca de pastilhas",
                "invoice_no": "NF125",
                "amount": Decimal("600"),
                "paid_with": "Cartão",
            }
        )

        rental = await rental_repo.create_rental(
            {
                "id": "RENT-0001",
                "vehicle_id": vehicle1.id,
                "driver_id": driver1.id,
                "start_date": date.today() - timedelta(days=45),
                "weekly_rate": Decimal("500"),
                "deposit": Decimal("1000"),
                "billing_day": BillingDay.MON,
                "status": RentalStatus.ACTIVE,
                "notes": "Contrato ativo",
            }
        )

        await payment_repo.create_payment(
            {
                "id": "PAY-0001",
                "rental_id": rental.id,
                "period_start": date.today() - timedelta(days=21),
                "period_end": date.today() - timedelta(days=15),
                "weekly_rate": Decimal("500"),
                "paid_amount": Decimal("500"),
                "payment_date": date.today() - timedelta(days=14),
                "late_fee": Decimal("0"),
                "method": "Pix",
            }
        )
        await payment_repo.create_payment(
            {
                "id": "PAY-0002",
                "rental_id": rental.id,
                "period_start": date.today() - timedelta(days=14),
                "period_end": date.today() - timedelta(days=8),
                "weekly_rate": Decimal("500"),
                "paid_amount": Decimal("0"),
                "late_fee": Decimal("50"),
                "method": None,
            }
        )

        await capital_repo.create_capital(
            {
                "id": "CAP-0001",
                "partner": "Sócio A",
                "date": date.today() - timedelta(days=100),
                "type": CapitalType.CONTRIBUTION,
                "amount": Decimal("50000"),
            }
        )
        await capital_repo.create_capital(
            {
                "id": "CAP-0002",
                "partner": "Sócio A",
                "date": date.today() - timedelta(days=10),
                "type": CapitalType.WITHDRAWAL,
                "amount": Decimal("5000"),
            }
        )

        await cash_repo.create_txn(
            {
                "id": "CSH-0001",
                "date": date.today() - timedelta(days=5),
                "type": CashTxnType.INFLOW,
                "category": "Rent",
                "amount": Decimal("500"),
                "method": "Pix",
                "related_vehicle_id": vehicle1.id,
                "related_rental_id": rental.id,
            }
        )
        await cash_repo.create_txn(
            {
                "id": "CSH-0002",
                "date": date.today() - timedelta(days=3),
                "type": CashTxnType.OUTFLOW,
                "category": "Manutenção",
                "amount": Decimal("300"),
                "method": "Cartão",
                "related_vehicle_id": vehicle2.id,
            }
        )

        await session.commit()
        print("Seed data inserted successfully.")


if __name__ == "__main__":
    asyncio.run(seed())


