from fastapi import APIRouter
from app.api.v1.endpoints import auth, documents, chat

api_router = APIRouter()

# Group endpoints
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(documents.router, prefix="/docs", tags=["Documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat & RAG"])
