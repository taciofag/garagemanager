from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from ..models.document import DocumentEntityType


class DocumentBase(BaseModel):
    entity_type: DocumentEntityType
    entity_id: str


class DocumentUpload(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    id: str
    original_name: str
    content_type: str
    size_bytes: int
    storage_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    items: list[DocumentRead]


class DocumentDeleteResponse(BaseModel):
    status: str = Field(default="deleted")

