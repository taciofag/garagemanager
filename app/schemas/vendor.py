from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from ..models.vendor import VendorType


class VendorBase(BaseModel):
    name: str = Field(max_length=100)
    type: VendorType = VendorType.OTHER
    phone: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=255)


class VendorCreate(VendorBase):
    id: Optional[str] = Field(default=None, max_length=12)


class VendorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    type: Optional[VendorType] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    notes: Optional[str] = Field(default=None, max_length=255)


class VendorRead(VendorBase):
    id: str

    model_config = {"from_attributes": True}
