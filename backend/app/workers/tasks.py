"""
Celery Asynchronous Tasks.
Defines tasks for background processing, such as document parsing and ingestion.
"""

import asyncio
import logging
import threading
from app.workers.celery_app import celery_app
from app.core.database import async_session_maker
from app.models.models import Document
from app.services.ingestion.manager import ingestion_manager

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper to run async coroutines in the synchronous Celery worker thread."""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # If an event loop is already running in the current thread (e.g. during tests),
        # run the coroutine in a separate thread with its own loop.
        result = []
        exception = []
        
        def target():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                res = loop.run_until_complete(coro)
                result.append(res)
                loop.close()
            except Exception as e:
                exception.append(e)

        thread = threading.Thread(target=target)
        thread.start()
        thread.join()
        
        if exception:
            raise exception[0]
        return result[0]


async def process_document_ingestion_async(
    organization_id: int,
    document_id: int,
    filename: str,
    file_type: str,
    file_bytes_hex: str,
) -> int:
    """
    Asynchronous implementation of document ingestion.
    Can be awaited directly in tests to avoid thread loop conflicts.
    """
    logger.info("Starting ingestion task for document %s", document_id)
    file_bytes = bytes.fromhex(file_bytes_hex)

    try:
        chunks_indexed = ingestion_manager.ingest_document(
            organization_id=organization_id,
            document_id=document_id,
            filename=filename,
            file_type=file_type,
            file_bytes=file_bytes,
        )

        async with async_session_maker() as db:
            doc = await db.get(Document, document_id)
            if doc:
                if chunks_indexed > 0:
                    doc.status = "active"
                else:
                    doc.status = "failed"
                await db.commit()
        
        logger.info("Successfully completed ingestion for document %s", document_id)
        return chunks_indexed

    except Exception as e:
        logger.error("Failed ingestion task for document %s: %s", document_id, str(e))
        # Mark the document status as failed in PostgreSQL
        try:
            async with async_session_maker() as db:
                doc = await db.get(Document, document_id)
                if doc:
                    doc.status = "failed"
                    await db.commit()
        except Exception as db_err:
            logger.error("Failed to set document status to failed in database: %s", str(db_err))
        raise e
    finally:
        from app.core.database import engine
        await engine.dispose()


@celery_app.task(name="tasks.process_document_ingestion")
def process_document_ingestion(
    organization_id: int,
    document_id: int,
    filename: str,
    file_type: str,
    file_bytes_hex: str,
) -> int:
    """
    Background task to parse a document, generate dense/sparse embeddings,
    index it in Qdrant, and update the PostgreSQL document status.
    """
    return run_async(process_document_ingestion_async(
        organization_id=organization_id,
        document_id=document_id,
        filename=filename,
        file_type=file_type,
        file_bytes_hex=file_bytes_hex,
    ))
