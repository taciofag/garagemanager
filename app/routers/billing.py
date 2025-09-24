from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..services.billing import generate_weekly_charges
from ..services.security import get_current_admin

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/run", response_model=dict)
async def run_billing(
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> dict:
    created = await generate_weekly_charges(session, today=date.today())
    await session.commit()
    return {"generated": list(created)}

