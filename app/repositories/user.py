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

