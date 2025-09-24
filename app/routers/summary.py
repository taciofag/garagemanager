from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..schemas.summary import SummaryResponse
from ..services.security import get_current_active_user
from ..services.summary import get_summary

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("", response_model=SummaryResponse)
async def summary(
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> SummaryResponse:
    payload = await get_summary(session)
    await session.commit()
    return payload

