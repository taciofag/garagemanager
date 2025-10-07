from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..repositories.user import UserRepository
from ..schemas.auth import UserCreate, UserRead, UserUpdate
from ..services.security import get_current_active_user, get_current_admin, get_password_hash
from ..config import settings
from ..utils import serialize_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> list[UserRead]:
    repo = UserRepository(session)
    users = await repo.list_users()
    await session.commit()
    return [serialize_user(user) for user in users]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> UserRead:
    repo = UserRepository(session)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = await repo.create_user(
        {
            "email": payload.email,
            "hashed_password": get_password_hash(payload.password),
            "full_name": payload.full_name,
            "is_admin": payload.is_admin,
            "is_active": True,
        }
    )
    await session.commit()
    return serialize_user(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
) -> UserRead:
    repo = UserRepository(session)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    update_data = payload.model_dump(exclude_none=True)
    if "password" in update_data:
        if user.is_admin and current_admin.id != user.id:
            raise HTTPException(status_code=403, detail="Não é permitido alterar a senha de outro administrador.")
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    updated = await repo.update_user(user, update_data)
    await session.commit()
    return serialize_user(updated)


@router.get("/{user_id}/avatar")
async def get_user_avatar(
    user_id: int,
    session: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Permissões insuficientes")
    repo = UserRepository(session)
    user = await repo.get(user_id)
    if not user or not user.avatar_path:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Avatar não encontrado")
    avatar_path = settings.uploads_dir / user.avatar_path
    if not avatar_path.exists():
        await session.rollback()
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    await session.commit()
    return FileResponse(path=avatar_path, media_type="image/*")


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_db),
    current_admin=Depends(get_current_admin),
) -> None:
    repo = UserRepository(session)
    user = await repo.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Você não pode excluir o próprio usuário.")
    if user.is_admin and current_admin.id != user.id:
        raise HTTPException(status_code=403, detail="Não é permitido excluir outro administrador.")
    await repo.delete(user)
    await session.flush()
    await session.commit()
    return Response(status_code=status.HTTP_200_OK)
