from unittest.mock import patch, MagicMock
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_flow(client: AsyncClient):
    """
    Test onboarding (signup), login, and retrieving authenticated user details.
    """
    signup_data = {
        "email": "admin@company.com",
        "password": "securepassword123",
        "organization_name": "Acme Corp"
    }

    # 1. Test Signup
    response = await client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201
    user_data = response.json()
    assert user_data["email"] == signup_data["email"]
    assert "organization_id" in user_data

    # 2. Test Login
    login_data = {
        "username": signup_data["email"],
        "password": signup_data["password"]
    }
    response = await client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    token_data = response.json()
    assert token_data["token_type"] == "bearer"
    assert "access_token" in token_data
    
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Test Me Endpoint
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    me_data = response.json()
    assert me_data["email"] == signup_data["email"]
    assert me_data["id"] == user_data["id"]


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.documents.process_document_ingestion")
async def test_document_upload(mock_task, client: AsyncClient):
    """
    Test uploading a document and checking metadata mapping.
    """
    # Create user & login
    await client.post("/api/v1/auth/signup", json={
        "email": "uploader@company.com",
        "password": "password123",
        "organization_name": "Upload Org"
    })
    
    login_response = await client.post("/api/v1/auth/login", data={
        "username": "uploader@company.com",
        "password": "password123"
    })
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Send a dummy markdown file
    files = {"file": ("test.md", b"# Document Header\nSome body text.", "text/markdown")}
    response = await client.post("/api/v1/docs/upload", files=files, headers=headers)
    
    assert response.status_code == 202
    mock_task.delay.assert_called_once()
    doc_data = response.json()
    assert doc_data["filename"] == "test.md"
    assert doc_data["file_type"] == "md"


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.chat.vector_db.hybrid_search")
@patch("app.api.v1.endpoints.chat.reranker.rerank")
@patch("app.api.v1.endpoints.chat.deepseek_client")
async def test_chat_query(mock_deepseek, mock_rerank, mock_hybrid, client: AsyncClient):
    """
    Test RAG chatbot query flow (in Mock Mode).
    """
    # Setup mocks
    mock_hybrid.return_value = [
        {"text": "Acme config parameter X is 42.", "metadata": {"filename": "config.md"}, "document_id": 1, "score": 0.9}
    ]
    mock_rerank.return_value = [
        {"text": "Acme config parameter X is 42.", "metadata": {"filename": "config.md"}, "document_id": 1, "score": 0.9}
    ]

    # Setup mock DeepSeek client completions
    if mock_deepseek is not None:
        mock_choice = MagicMock()
        mock_choice.message.content = "Acme config parameter X is 42."
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage.total_tokens = 100
        mock_deepseek.chat.completions.create.return_value = mock_response

    # Create user & login
    await client.post("/api/v1/auth/signup", json={
        "email": "user@company.com",
        "password": "password123",
        "organization_name": "Acme Corp"
    })
    
    login_response = await client.post("/api/v1/auth/login", data={
        "username": "user@company.com",
        "password": "password123"
    })
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Run query
    query_payload = {"query": "What is the configuration parameter X?"}
    response = await client.post("/api/v1/chat/query", json=query_payload, headers=headers)
    
    assert response.status_code == 200
    res_data = response.json()
    assert "conversation_id" in res_data
    # Checks that mock fallback generated an answer based on our mock search results
    assert "Acme config parameter X is 42." in res_data["answer"]
    assert len(res_data["citations"]) == 1
    assert res_data["citations"][0]["filename"] == "config.md"
