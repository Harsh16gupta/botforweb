import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Document, Organization
from app.workers.tasks import process_document_ingestion_async
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.documents.process_document_ingestion")
@patch("app.workers.tasks.ingestion_manager.ingest_document")
async def test_async_document_upload_and_ingestion(
    mock_ingest,
    mock_upload_task,
    client: AsyncClient,
    db: AsyncSession,
):
    """
    Verifies that:
    1. Uploading a document returns 202 Accepted.
    2. The document is initially saved in the DB with status 'processing'.
    3. The Celery task successfully executes, indexes content, and updates status to 'active'.
    """
    # 1. Mock ingestion behavior to return 3 chunks
    mock_ingest.return_value = 3

    # 2. Signup and log in to get a valid authentication token
    await client.post("/api/v1/auth/signup", json={
        "email": "async_dev@acme.com",
        "password": "securepassword",
        "organization_name": "Async Testing Corp"
    })

    login_response = await client.post("/api/v1/auth/login", data={
        "username": "async_dev@acme.com",
        "password": "securepassword"
    })
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Post a dummy markdown document to `/docs/upload`
    files = {"file": ("deployment.md", b"# Production Deployments\nRun build then run deploy.", "text/markdown")}
    upload_response = await client.post("/api/v1/docs/upload", files=files, headers=headers)
    
    assert upload_response.status_code == 202
    doc_data = upload_response.json()
    assert doc_data["filename"] == "deployment.md"
    assert doc_data["status"] == "processing"
    
    doc_id = doc_data["id"]
    
    # Assert that Celery delay was called once
    mock_upload_task.delay.assert_called_once()
    
    # 4. Assert the document exists in the DB with status 'processing'
    db_result = await db.execute(select(Document).filter(Document.id == doc_id))
    document_record = db_result.scalars().first()
    assert document_record is not None
    assert document_record.status == "processing"

    # Fetch user's organization id
    user_org_id = document_record.organization_id

    # 5. Run the Celery task synchronously, pointing its database context to the Test session engine
    with patch("app.workers.tasks.async_session_maker", TestSessionLocal):
        # We await the async task body directly
        chunks = await process_document_ingestion_async(
            organization_id=user_org_id,
            document_id=doc_id,
            filename="deployment.md",
            file_type="md",
            file_bytes_hex=b"# Production Deployments\nRun build then run deploy.".hex()
        )
        
        assert chunks == 3

    # 6. Re-fetch document from DB and assert its status is now 'active'
    await db.refresh(document_record)
    assert document_record.status == "active"
