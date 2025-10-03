from __future__ import annotations

import asyncio
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import DBAPIError

from .config import settings
from .db import AsyncSessionLocal, dispose_engine, warm_db
from .repositories.user import UserRepository
from .routers import (
    auth,
    billing,
    cash,
    capital,
    documents,
    drivers,
    expenses,
    partners,
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
app.include_router(partners.router)
app.include_router(expenses.router)
app.include_router(rentals.router)
app.include_router(rent_payments.router)
app.include_router(capital.router)
app.include_router(cash.router)
app.include_router(summary.router)
app.include_router(billing.router)
app.include_router(documents.router)


@app.on_event("startup")
async def startup() -> None:
    # Aquece o DB para a primeira request não falhar abrindo conexão
    await warm_db()

    # Garante usuário admin com 1x retry se a conexão do pool vier invalidada
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        for attempt in (1, 2):
            try:
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
                break
            except DBAPIError as e:
                if getattr(e, "connection_invalidated", False) and attempt == 1:
                    # fecha a sessão, espera um instante e tenta de novo
                    await session.close()
                    await asyncio.sleep(0.2)
                    continue
                raise


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await dispose_engine()


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["misc"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
