from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..models.document import DocumentEntityType
from ..repositories.document import DocumentRepository
from ..repositories.driver import DriverRepository
from ..repositories.rental import RentalRepository
from ..repositories.vehicle import VehicleRepository
from ..schemas.document import DocumentDeleteResponse, DocumentList, DocumentRead
from ..services.security import get_current_active_user

router = APIRouter(prefix="/documents", tags=["documents"])

ENTITY_REPOSITORIES = {
    DocumentEntityType.VEHICLE: VehicleRepository,
    DocumentEntityType.DRIVER: DriverRepository,
    DocumentEntityType.RENTAL: RentalRepository,
}


async def ensure_entity_exists(
    session: AsyncSession,
    entity_type: DocumentEntityType,
    entity_id: str,
) -> None:
    repo_cls = ENTITY_REPOSITORIES.get(entity_type)
    if not repo_cls:
        raise HTTPException(status_code=400, detail="Tipo de entidade inválido")
    repo = repo_cls(session)
    entity = await repo.get(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entidade não encontrada")


@router.get("", response_model=DocumentList)
async def list_documents(
    entity_type: DocumentEntityType,
    entity_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> DocumentList:
    repo = DocumentRepository(session)
    documents = await repo.list_by_entity(entity_type, entity_id)
    await session.commit()
    return DocumentList(items=[DocumentRead.model_validate(doc) for doc in documents])


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    entity_type: DocumentEntityType = Form(...),
    entity_id: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> DocumentRead:
    await ensure_entity_exists(session, entity_type, entity_id)
    repo = DocumentRepository(session)
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo vazio")

    document = await repo.create_document(
        entity_type=entity_type,
        entity_id=entity_id,
        original_name=file.filename or "arquivo",
        content_type=file.content_type or "application/octet-stream",
        data=data,
    )
    await session.commit()
    return DocumentRead.model_validate(document)


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> FileResponse:
    repo = DocumentRepository(session)
    document = await repo.get(document_id)
    if not document:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    file_path = settings.uploads_dir / Path(document.storage_path)
    if not file_path.exists():
        await session.rollback()
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    await session.commit()
    return FileResponse(
        path=file_path,
        filename=document.original_name,
        media_type=document.content_type,
    )


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: str,
    session: AsyncSession = Depends(get_db),
    _: None = Depends(get_current_active_user),
) -> DocumentDeleteResponse:
    repo = DocumentRepository(session)
    document = await repo.get(document_id)
    if not document:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    await repo.delete_document(document)
    await session.commit()
    return DocumentDeleteResponse()

