from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from .config import settings
from .db import AsyncSessionLocal, dispose_engine
from .repositories.user import UserRepository
from .routers import (
    auth,
    billing,
    cash,
    capital,
    documents,
    drivers,
    expenses,
    rent_payments,
    rentals,
    summary,
    vehicles,
    vendors,
)
from .services.security import get_password_hash

app = FastAPI(
    title=settings.app_name,
    description=(
        "Garage Manager API para controle de veículos de leilão, motoristas, despesas, capital, "
        "cobranças e documentos complementares."
    ),
)

app.include_router(auth.router)
app.include_router(vehicles.router)
app.include_router(drivers.router)
app.include_router(vendors.router)
app.include_router(expenses.router)
app.include_router(rentals.router)
app.include_router(rent_payments.router)
app.include_router(capital.router)
app.include_router(cash.router)
app.include_router(summary.router)
app.include_router(billing.router)
app.include_router(documents.router)


@app.on_event("startup")
async def ensure_admin_user() -> None:
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        existing = await repo.get_by_email(settings.default_admin_email)
        if not existing:
            await repo.create_user(
                {
                    "email": settings.default_admin_email,
                    "hashed_password": get_password_hash(settings.default_admin_password),
                    "full_name": "Administrator",
                    "is_admin": True,
                    "is_active": True,
                }
            )
            await session.commit()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await dispose_engine()


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["misc"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
