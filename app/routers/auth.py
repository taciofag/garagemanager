from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..repositories.user import UserRepository
from ..schemas.auth import Token, UserCreate, UserRead
from ..services.security import (
    authenticate_user,
    create_access_token,
    get_current_admin,
    get_password_hash,
)

router = APIRouter(prefix="/auth", tags=["auth"])


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
    return UserRead.model_validate(user)


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

