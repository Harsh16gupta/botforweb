"""
Application Configuration Settings Loader.
Uses Pydantic Settings to bind environment variables from system env or local .env file.
"""

import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Documentation Chatbot SaaS"
    ENVIRONMENT: str = "development"

    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/botforweb"

    # Cache & Queue Settings
    REDIS_URL: str = "redis://localhost:6379/0"

    # Vector DB Settings
    QDRANT_URL: str = "http://localhost:6333"

    # API Keys
    DEEPSEEK_API_KEY: Optional[str] = None
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    COHERE_API_KEY: Optional[str] = None

    # Observability Settings
    JAEGER_OTLP_ENDPOINT: Optional[str] = None
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"
    ENABLE_OBSERVABILITY: bool = True

    # Security Settings
    # Generate a secure key for production; this is a default fallback for local dev
    JWT_SECRET_KEY: str = "supersecretfallbackkeyforlocaldevelopmentonly"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # RAG Settings
    DENSE_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"
    SPARSE_MODEL_NAME: str = "prithivida/Splade_PP_en_v1"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
