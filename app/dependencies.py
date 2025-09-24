from __future__ import annotations

from fastapi import Depends, Query

from .schemas.common import PaginationParams


async def get_pagination_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    order_by: str | None = Query(None),
    order_dir: str = Query("asc", pattern="^(asc|desc)$"),
) -> PaginationParams:
    return PaginationParams(page=page, page_size=page_size, order_by=order_by, order_dir=order_dir)

