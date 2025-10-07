from __future__ import annotations

from ..models.user import User
from ..schemas.auth import UserRead


def serialize_user(user: User) -> UserRead:
    avatar_url = f"/users/{user.id}/avatar" if user.avatar_path else None
    base = UserRead.model_validate(user)
    return base.model_copy(update={"avatar_url": avatar_url})

