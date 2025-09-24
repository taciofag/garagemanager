from __future__ import annotations

from typing import Any, Generic, Optional, Sequence, Type, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from ..schemas.common import PaginatedResult, PaginationParams

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    model: Type[ModelT]

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, obj_id: Any) -> Optional[ModelT]:
        return await self.session.get(self.model, obj_id)

    async def list(
        self,
        params: PaginationParams,
        filters: Sequence[Any] | None = None,
        options: Sequence[Any] | None = None,
    ) -> PaginatedResult[ModelT]:
        query: Select[Any] = select(self.model)
        if options:
            for opt in options:
                query = query.options(opt)
        if filters:
            for flt in filters:
                query = query.where(flt)
        total_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(total_query)).scalar_one()

        order_by_attr = self.default_order_attr(params)
        if params.order_by:
            custom_attr = getattr(self.model, params.order_by, None)
            if isinstance(custom_attr, InstrumentedAttribute):
                order_by_attr = custom_attr
        if params.order_dir == "desc":
            query = query.order_by(order_by_attr.desc())
        else:
            query = query.order_by(order_by_attr.asc())

        offset = (params.page - 1) * params.page_size
        query = query.offset(offset).limit(params.page_size)
        items = (await self.session.execute(query)).scalars().all()
        return PaginatedResult(total=total, items=items, page=params.page, page_size=params.page_size)

    @classmethod
    def default_order_attr(cls, params: PaginationParams) -> InstrumentedAttribute[Any]:
        return getattr(cls.model, "created_at")

    async def create(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)

    async def generate_id(self, prefix: str) -> str:
        like_pattern = f"{prefix}-%"
        result = await self.session.execute(
            select(self.model.id).where(self.model.id.like(like_pattern)).order_by(self.model.id.desc()).limit(1)
        )
        last_id = result.scalar_one_or_none()
        if not last_id:
            return f"{prefix}-0001"
        try:
            number = int(str(last_id).split("-")[1])
        except (IndexError, ValueError):
            number = 0
        return f"{prefix}-{number + 1:04d}"
