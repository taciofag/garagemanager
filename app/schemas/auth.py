from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = Field(default=None, max_length=100)
    is_admin: bool = False


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=100)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: Optional[str] = None
    scopes: list[str] = Field(default_factory=list)
