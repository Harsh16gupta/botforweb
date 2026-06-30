from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException
from app.core.context import tenant_ctx
from app.core.security import get_tenant_id
from app.models.models import Organization

@pytest.mark.asyncio
async def test_get_tenant_id_from_api_key():
    """
    Test resolving organization ID from a valid X-API-Key header.
    """
    mock_request = MagicMock()
    mock_request.headers = {"X-API-Key": "valid_api_key"}
    
    mock_org = Organization(id=42, name="Test Org", api_key="valid_api_key")
    
    # Mock database session
    mock_db = AsyncMock()
    mock_db.bind.dialect.name = "postgresql"
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_org
    mock_db.execute.return_value = mock_result
    
    # Run dependency
    org_id = await get_tenant_id(request=mock_request, db=mock_db)
    
    assert org_id == 42
    assert tenant_ctx.get() == 42
    
    # Verify SET SQL command was executed
    assert mock_db.execute.call_count >= 2  # first for org select, second for SET context
    last_call = mock_db.execute.call_args_list[-1]
    assert "set_config" in str(last_call[0][0])
    assert last_call[0][1] == {"org_id": "42"}


@pytest.mark.asyncio
async def test_get_tenant_id_from_invalid_api_key():
    """
    Test that an invalid API key raises a 401 exception.
    """
    mock_request = MagicMock()
    mock_request.headers = {"X-API-Key": "invalid_api_key"}
    
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result
    
    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_id(request=mock_request, db=mock_db)
        
    assert exc_info.value.status_code == 401
    assert "Invalid API Key" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_tenant_id_missing_credentials():
    """
    Test that missing both JWT and API key raises a 401 exception.
    """
    mock_request = MagicMock()
    mock_request.headers = {}
    
    mock_db = AsyncMock()
    
    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_id(request=mock_request, db=mock_db)
        
    assert exc_info.value.status_code == 401
    assert "Authentication credentials" in exc_info.value.detail
