"""
Ingestion Pipeline Coordinator.
Coordinates file reading, parsing (PDF/MD/ZIP), 
text splitting, and Qdrant index execution.
"""

import logging
from typing import List, Dict, Any
from app.services.ingestion.pdf import extract_text_from_pdf
from app.services.ingestion.markdown import parse_markdown_content, extract_markdown_from_zip
from app.services.ingestion.splitter import RecursiveCharacterTextSplitter
from app.services.vector_db import vector_db

logger = logging.getLogger(__name__)


class IngestionManager:
    """
    Orchestrates the ingestion pipeline:
    Receives raw files, extracts text, chunks it, and indexes the chunks in Qdrant.
    """

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    def ingest_document(
        self,
        organization_id: int,
        document_id: int,
        filename: str,
        file_type: str,  # 'pdf', 'md', 'zip'
        file_bytes: bytes,
    ) -> int:
        """
        Processes a document or archive, extracts text, chunks it, 
        and indexes it. Returns the number of chunks indexed.
        """
        logger.info(f"Ingesting file '{filename}' ({file_type}) for org {organization_id}")
        raw_documents = []

        # Step 1: Parse and extract text/metadata based on file type
        if file_type == "pdf":
            text = extract_text_from_pdf(file_bytes)
            raw_documents.append({
                "text": text,
                "metadata": {"source": filename}
            })
        elif file_type == "md":
            content = file_bytes.decode("utf-8", errors="ignore")
            parsed = parse_markdown_content(content, filename)
            raw_documents.append(parsed)
        elif file_type == "zip":
            # For ZIP, it returns multiple parsed documents
            raw_documents = extract_markdown_from_zip(file_bytes)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        if not raw_documents:
            logger.warning(f"No documents extracted from file {filename}")
            return 0

        # Step 2: Split text into chunks
        chunks_to_upsert = []
        for raw_doc in raw_documents:
            text_body = raw_doc["text"]
            doc_metadata = raw_doc["metadata"]

            if not text_body.strip():
                continue

            text_chunks = self.splitter.split_text(text_body)
            for idx, chunk_text in enumerate(text_chunks):
                # Build rich metadata for search responses
                chunk_metadata = {
                    **doc_metadata,
                    "chunk_index": idx,
                    "filename": filename,
                }
                chunks_to_upsert.append({
                    "text": chunk_text,
                    "metadata": chunk_metadata
                })

        if not chunks_to_upsert:
            logger.warning("No chunks generated from extracted text")
            return 0

        # Step 3: Index chunks in Qdrant
        vector_db.upsert_chunks(
            organization_id=organization_id,
            document_id=document_id,
            chunks=chunks_to_upsert,
        )

        logger.info(f"Successfully indexed {len(chunks_to_upsert)} chunks for document {document_id}")
        return len(chunks_to_upsert)


# Global ingestion manager instance
ingestion_manager = IngestionManager()
