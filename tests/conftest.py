import asyncio
from collections.abc import AsyncGenerator
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db import Base, get_db
from app.main import app
from app.models.driver import Driver, DriverStatus
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.security import get_password_hash


@pytest.fixture(scope="session")
def event_loop() -> AsyncGenerator[asyncio.AbstractEventLoop, None]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(settings.test_database_url, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture()
async def session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    TestingSessionLocal = async_sessionmaker(
        bind=async_engine,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
        class_=AsyncSession,
    )
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture()
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture()
async def admin_user(session: AsyncSession) -> User:
    user = User(
        email="admin@test.com",
        hashed_password=get_password_hash("password123"),
        is_admin=True,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest.fixture()
async def sample_vehicle(session: AsyncSession) -> Vehicle:
    driver = Driver(
        id="DRV-TST",
        name="Driver Test",
        cpf="000.000.000-00",
        phone=None,
        start_date=date.today(),
        weekly_rate=Decimal("400"),
        commission_pct=Decimal("0.1"),
        deposit_held=Decimal("500"),
        status=DriverStatus.ACTIVE,
    )
    session.add(driver)
    vehicle = Vehicle(
        id="CAR-TST",
        plate="TEST123",
        renavam="RENATEST",
        vin="VINTEST123456",
        manufacture_year=2021,
        model_year=2022,
        make="Test",
        model="Model",
        color="Blue",
        acquisition_date=date.today(),
        acquisition_price=Decimal("30000"),
        current_driver_id=None,
    )
    session.add(vehicle)
    await session.commit()
    return vehicle

