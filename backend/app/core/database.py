"""
Database Connection Manager.
Establishes the async SQLAlchemy engine connection with PostgreSQL and 
exposes the async session context managers and ORM base model.
"""

import logging
from typing import AsyncGenerator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncConnection
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from app.core.context import tenant_ctx

logger = logging.getLogger(__name__)

# Create async database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    future=True,
    pool_pre_ping=True,
)

# Async session factory
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models"""
    pass


async def init_rls_policies(conn: AsyncConnection) -> None:
    """
    Enables PostgreSQL Row-Level Security (RLS) on documents, conversations, and messages.
    Only executed if the database dialect is PostgreSQL.
    """
    if conn.dialect.name != "postgresql":
        logger.info(
            "Non-PostgreSQL dialect detected (%s). Skipping Row-Level Security (RLS) setup.",
            conn.dialect.name,
        )
        return

    logger.info("Setting up PostgreSQL Row-Level Security (RLS) policies...")

    # Enable and Force RLS
    await conn.execute(text("ALTER TABLE documents ENABLE ROW LEVEL SECURITY;"))
    await conn.execute(text("ALTER TABLE documents FORCE ROW LEVEL SECURITY;"))
    await conn.execute(text("ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;"))
    await conn.execute(text("ALTER TABLE conversations FORCE ROW LEVEL SECURITY;"))
    await conn.execute(text("ALTER TABLE messages ENABLE ROW LEVEL SECURITY;"))
    await conn.execute(text("ALTER TABLE messages FORCE ROW LEVEL SECURITY;"))

    # Drop old policies
    await conn.execute(text("DROP POLICY IF EXISTS org_isolation_policy ON documents;"))
    await conn.execute(text("DROP POLICY IF EXISTS org_isolation_policy ON conversations;"))
    await conn.execute(text("DROP POLICY IF EXISTS org_isolation_policy ON messages;"))

    # Create new policies
    await conn.execute(text(
        "CREATE POLICY org_isolation_policy ON documents "
        "USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::integer);"
    ))
    await conn.execute(text(
        "CREATE POLICY org_isolation_policy ON conversations "
        "USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::integer);"
    ))
    await conn.execute(text(
        "CREATE POLICY org_isolation_policy ON messages "
        "USING (EXISTS ("
        "  SELECT 1 FROM conversations "
        "  WHERE conversations.id = messages.conversation_id "
        "    AND conversations.organization_id = NULLIF(current_setting('app.current_org_id', true), '')::integer"
        "));"
    ))

    logger.info("PostgreSQL Row-Level Security (RLS) policies initialized successfully.")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency injection helper to yield an async database session"""
    async with async_session_maker() as session:
        is_postgresql = session.bind.dialect.name == "postgresql"
        org_id = tenant_ctx.get()
        if org_id is not None and is_postgresql:
            await session.execute(
                text("SELECT set_config('app.current_org_id', :org_id, false);"),
                {"org_id": str(org_id)}
            )
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            if org_id is not None and is_postgresql:
                try:
                    await session.execute(
                        text("SELECT set_config('app.current_org_id', '', false);")
                    )
                except Exception:
                    pass
            await session.close()
