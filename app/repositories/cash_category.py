from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from ..models.cash import CashCategory
from .base import BaseRepository


class CashCategoryRepository(BaseRepository[CashCategory]):
    model = CashCategory

    async def list_all(self, include_inactive: bool = False) -> list[CashCategory]:
        stmt = select(CashCategory)
        if not include_inactive:
            stmt = stmt.where(CashCategory.is_active.is_(True))
        stmt = stmt.order_by(CashCategory.name.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> Optional[CashCategory]:
        stmt = select(CashCategory).where(CashCategory.slug == slug)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_category(self, data: dict) -> CashCategory:
        category = CashCategory(**data)
        await self.create(category)
        return category

    async def update_category(self, category: CashCategory, data: dict) -> CashCategory:
        for key, value in data.items():
            if hasattr(category, key) and value is not None:
                setattr(category, key, value)
        await self.session.flush()
        return category

    async def ensure_system_category(self, slug: str, name: str) -> CashCategory:
        existing = await self.get_by_slug(slug)
        if existing:
            if not existing.is_active:
                existing.is_active = True
                await self.session.flush()
            return existing
        category = CashCategory(
            id=await self.generate_id("CAT"),
            name=name,
            slug=slug,
            is_active=True,
            is_system=True,
        )
        await self.create(category)
        return category
