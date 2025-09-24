from __future__ import annotations

from pathlib import Path
from typing import Sequence
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.document import Document, DocumentEntityType
from .base import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    model = Document

    def __init__(self, session: AsyncSession):
        super().__init__(session)
        self.base_path = settings.uploads_dir

    async def list_by_entity(self, entity_type: DocumentEntityType, entity_id: str) -> Sequence[Document]:
        stmt = select(Document).where(
            Document.entity_type == entity_type,
            Document.entity_id == entity_id,
        )
        result = await self.session.execute(stmt.order_by(Document.created_at.desc()))
        return result.scalars().all()

    async def create_document(
        self,
        *,
        entity_type: DocumentEntityType,
        entity_id: str,
        original_name: str,
        content_type: str,
        data: bytes,
    ) -> Document:
        stored_name = f"{uuid4().hex}{Path(original_name).suffix}"
        relative_path = Path(entity_type.value) / entity_id / stored_name
        absolute_path = self.base_path / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)

        absolute_path.write_bytes(data)
        document = Document(
            id=str(uuid4()),
            entity_type=entity_type,
            entity_id=entity_id,
            original_name=original_name,
            stored_name=stored_name,
            content_type=content_type or "application/octet-stream",
            size_bytes=len(data),
            storage_path=str(relative_path.as_posix()),
        )
        await self.create(document)
        return document

    async def delete_document(self, document: Document) -> None:
        file_path = settings.uploads_dir / Path(document.storage_path)
        if file_path.exists():
            file_path.unlink()
        await self.delete(document)

    async def get(self, doc_id: str) -> Document | None:  # override to eager load nothing
        return await super().get(doc_id)

