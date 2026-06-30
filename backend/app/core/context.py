"""
Context Manager for Tenant Isolation.
Defines the request-scoped ContextVar used to store and propagate the active organization ID.
"""

import contextvars
from typing import Optional

# Request-scoped variable to hold the active organization_id
tenant_ctx: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar("tenant_ctx", default=None)
