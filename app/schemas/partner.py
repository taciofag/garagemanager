from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class PartnerBase(BaseModel):
    name: str = Field(max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=255)


class PartnerCreate(PartnerBase):
    id: Optional[str] = Field(default=None, max_length=12)


class PartnerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=255)


class PartnerRead(PartnerBase):
    id: str

    model_config = {"from_attributes": True}
