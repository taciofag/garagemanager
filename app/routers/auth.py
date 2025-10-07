from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..repositories.user import UserRepository
from ..schemas.auth import PasswordChange, Token, UserCreate, UserProfileUpdate, UserRead
from ..services.security import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_admin,
    get_password_hash,
    verify_password,
)
from ..config import settings
from ..utils import serialize_user

router = APIRouter(prefix="/auth", tags=["auth"])

AVATAR_DIR = settings.uploads_dir / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_admin),
) -> UserRead:
    repo = UserRepository(session)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
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


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_db),
) -> Token:
    user = await authenticate_user(session, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    scopes = ["user"]
    if user.is_admin:
        scopes.append("admin")
    access_token = create_access_token(user.email, scopes)
    await session.commit()
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user=Depends(get_current_active_user)) -> UserRead:
    return serialize_user(current_user)


@router.patch("/me", response_model=UserRead)
async def update_profile(
    payload: UserProfileUpdate,
    session: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> UserRead:
    if payload.full_name is not None:
        current_user.full_name = payload.full_name or None
    await session.flush()
    await session.commit()
    return serialize_user(current_user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> UserRead:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo vazio")
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado")
    avatar_filename = f"user_{current_user.id}{extension}"
    avatar_path = AVATAR_DIR / avatar_filename
    if current_user.avatar_path:
        previous_path = settings.uploads_dir / current_user.avatar_path
        if previous_path.exists():
            previous_path.unlink()
    with avatar_path.open("wb") as out:
        out.write(data)
    current_user.avatar_path = f"avatars/{avatar_filename}"
    await session.flush()
    await session.commit()
    return serialize_user(current_user)


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    session: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
) -> Response:
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    current_user.hashed_password = get_password_hash(payload.new_password)
    await session.flush()
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
