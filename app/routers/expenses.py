from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import Response, APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..dependencies import get_pagination_params
from ..models.expense import ExpenseCategory
from ..repositories.expense import ExpenseRepository
from ..schemas.common import PaginationParams
from ..schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from ..services.security import get_current_active_user, get_current_admin

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=dict)
async def list_expenses(
    pagination: PaginationParams = Depends(get_pagination_params),
    vehicle_id: Optional[str] = Query(default=None),
    category: Optional[ExpenseCategory] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> dict:
    repo = ExpenseRepository(session)
    result = await repo.list_expenses(
        pagination,
        vehicle_id=vehicle_id,
        category=category,
        start_date=start_date,
        end_date=end_date,
    )
    items = [ExpenseRead.model_validate(expense) for expense in result.items]
    await session.commit()
    return {
        "total": result.total,
        "page": result.page,
        "page_size": result.page_size,
        "items": items,
    }


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> ExpenseRead:
    repo = ExpenseRepository(session)
    expense = await repo.create_expense(payload.model_dump(exclude_none=True))
    await session.commit()
    return ExpenseRead.model_validate(expense)


@router.get("/{expense_id}", response_model=ExpenseRead)
async def get_expense(
    expense_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> ExpenseRead:
    repo = ExpenseRepository(session)
    expense = await repo.get(expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await session.commit()
    return ExpenseRead.model_validate(expense)


@router.patch("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> ExpenseRead:
    repo = ExpenseRepository(session)
    expense = await repo.get(expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    updated = await repo.update_expense(expense, payload.model_dump(exclude_none=True))
    await session.commit()
    return ExpenseRead.model_validate(updated)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> Response:
    repo = ExpenseRepository(session)
    expense = await repo.get(expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await repo.delete_expense(expense)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

