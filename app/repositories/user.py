from __future__ import annotations

from typing import Optional

from sqlalchemy import select

from ..models.user import User
from .base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def create_user(self, data: dict) -> User:
        user = User(**data)
        await self.create(user)
        return user

    async def list_users(self) -> list[User]:
        stmt = select(User).order_by(User.created_at.asc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_user(self, user: User, data: dict) -> User:
        for key, value in data.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        await self.session.flush()
        return user
