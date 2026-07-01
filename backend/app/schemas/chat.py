from typing import List, Optional
import datetime
from pydantic import BaseModel


class QueryRequest(BaseModel):
    conversation_id: Optional[int] = None
    query: str


class Citation(BaseModel):
    document_id: Optional[int] = None
    filename: str
    text: str


class QueryResponse(BaseModel):
    conversation_id: int
    answer: str
    citations: List[Citation]
    confidence_score: Optional[float] = None
    faithfulness_score: Optional[float] = None


class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: datetime.datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True
