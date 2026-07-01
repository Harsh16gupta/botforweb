"""
Main FastAPI Application Entrypoint.
Sets up the API instance, CORS middleware, API v1 routes, 
and automatically handles database tables creation on startup.
"""

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base, init_rls_policies
from app.api.v1.api import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup and shutdown lifecycle events.
    For the local development MVP, we automatically initialize the PostgreSQL tables on startup.
    """
    logger.info("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await init_rls_policies(conn)
    
    logger.info("Database tables initialized successfully.")
    yield
    
    logger.info("Closing database engine connections...")
    await engine.dispose()
    logger.info("Database engine closed.")


from app.core.observability import init_observability

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-tenant Documentation Chatbot SaaS API",
    version="1.0.0",
    lifespan=lifespan,
)

# Initialize observability (OpenTelemetry & Langfuse)
init_observability(app)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint to check service health."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }
