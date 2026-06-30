import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Document
from app.schemas.document import DocumentResponse
from app.services.ingestion.manager import ingestion_manager
from app.services.vector_db import vector_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a document (PDF, MD, or ZIP of Markdown files) and index its contents.
    """
    filename = file.filename
    # Extract file extension
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ["pdf", "md", "markdown", "zip"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload PDF, MD, or ZIP files.",
        )
    
    file_type = "md" if ext in ["md", "markdown"] else ext
    
    # Read file content
    file_bytes = await file.read()
    
    # Create Document record in DB
    new_doc = Document(
        filename=filename,
        file_type=file_type,
        organization_id=current_user.organization_id,
    )
    db.add(new_doc)
    await db.flush()  # Populate new_doc.id

    try:
        # Index document contents into Qdrant (synchronously for MVP)
        chunks_indexed = ingestion_manager.ingest_document(
            organization_id=current_user.organization_id,
            document_id=new_doc.id,
            filename=filename,
            file_type=file_type,
            file_bytes=file_bytes,
        )
        
        if chunks_indexed == 0:
            # If no content could be indexed, raise an error (and roll back DB entry)
            raise ValueError("No text content could be extracted or indexed from the uploaded file.")
            
        await db.commit()
        await db.refresh(new_doc)
        return new_doc
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to process uploaded file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and index document: {str(e)}"
        )


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all uploaded documents for the organization.
    """
    result = await db.execute(
        select(Document)
        .filter(Document.organization_id == current_user.organization_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a document and all its indexed vector chunks.
    """
    result = await db.execute(
        select(Document).filter(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id
        )
    )
    doc = result.scalars().first()
    
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    # 1. Delete chunks from Qdrant
    vector_db.delete_document_chunks(
        organization_id=current_user.organization_id,
        document_id=document_id,
    )
    
    # 2. Delete document record from Postgres
    await db.delete(doc)
    await db.commit()
    return
