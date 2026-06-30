import logging
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from openai import OpenAI

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Conversation, Message
from app.schemas.chat import QueryRequest, QueryResponse, ConversationResponse, Citation
from app.services.vector_db import vector_db
from app.services.reranker import reranker

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize DeepSeek client (using OpenAI-compatible SDK)
deepseek_client = OpenAI(
    api_key=settings.DEEPSEEK_API_KEY,
    base_url=settings.DEEPSEEK_BASE_URL
) if settings.DEEPSEEK_API_KEY else None


@router.post("/query", response_model=QueryResponse)
async def query_chatbot(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    RAG-powered chat query endpoint.
    Retrieves documents, reranks them, queries Claude, and returns the answer with citations.
    """
    org_id = current_user.organization_id
    query = request.query

    # 1. Fetch relevant chunks from Qdrant using Hybrid Search
    try:
        # Retrieve top 10 chunks initially (both dense and sparse)
        retrieved_chunks = vector_db.hybrid_search(
            organization_id=org_id,
            query=query,
            limit=10,
        )
    except Exception as e:
        logger.error(f"Vector search failed: {str(e)}")
        retrieved_chunks = []

    # 2. Rerank retrieved chunks using Cohere Reranker
    # Reranking filters the top 10 down to the top 3 most relevant context chunks
    reranked_chunks = reranker.rerank(
        query=query,
        documents=retrieved_chunks,
        top_n=3,
    )

    # 3. Create or Fetch Conversation
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).filter(
                Conversation.id == request.conversation_id,
                Conversation.organization_id == org_id
            )
        )
        conversation = result.scalars().first()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found."
            )
    else:
        conversation = Conversation(
            title=query[:50] + ("..." if len(query) > 50 else ""),
            organization_id=org_id
        )
        db.add(conversation)
        await db.flush()  # Populate conversation.id

    # 4. Save User Message to Database
    user_msg = Message(
        conversation_id=conversation.id,
        role="user",
        content=query,
    )
    db.add(user_msg)

    # 5. Formulate System Prompt with Retrieval Context
    context_text = "\n\n".join([
        f"Source File: {chunk['metadata'].get('filename', 'Unknown')}\n"
        f"Content:\n{chunk['text']}"
        for chunk in reranked_chunks
    ])
    
    system_prompt = (
        "You are an expert AI documentation assistant. Answer the user's questions truthfully and accurately "
        "using ONLY the provided documentation context below. If the answer cannot be found in the context, "
        "or if the context is empty, respond with: 'I am sorry, but I do not have enough information in my "
        "documentation to answer that question.' Do not attempt to make up or guess answers.\n\n"
        f"--- START DOCUMENTATION CONTEXT ---\n{context_text}\n--- END DOCUMENTATION CONTEXT ---\n\n"
        "At the end of your answer, write a short section detailing the filenames of the sources you used "
        "to formulate your response."
    )

    # 6. Query Claude (or run in Mock Mode if key is missing)
    start_time = time.time()
    tokens_used = None
    
    if deepseek_client:
        try:
            # Query DeepSeek-Chat completions API
            response = deepseek_client.chat.completions.create(
                model=settings.DEEPSEEK_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.0,
                max_tokens=1000,
            )
            answer = response.choices[0].message.content
            tokens_used = response.usage.total_tokens
        except Exception as e:
            logger.error(f"DeepSeek API call failed: {str(e)}")
            answer = f"Error generating answer: {str(e)}"
    else:
        # Graceful fallback mock response for offline/keyless testing
        logger.warning("DEEPSEEK_API_KEY not configured. Generating mock response.")
        time.sleep(0.5)  # Simulate API latency
        if reranked_chunks:
            sources_list = ", ".join(list(set([c['metadata'].get('filename', 'Unknown') for c in reranked_chunks])))
            answer = (
                f"[Mock Mode] Based on the context provided, here is an answer to your query: '{query}'.\n\n"
                f"Summary of retrieved details: \"{reranked_chunks[0]['text'][:300]}...\"\n\n"
                f"Sources used: {sources_list}"
            )
        else:
            answer = "I am sorry, but I do not have enough information in my documentation to answer that question."
        
        tokens_used = 100

    latency_ms = int((time.time() - start_time) * 1000)

    # 7. Save Assistant Message to Database
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        latency_ms=latency_ms,
        tokens_used=tokens_used,
    )
    db.add(assistant_msg)
    await db.commit()

    # 8. Build Citations for Response
    citations = [
        Citation(
            document_id=chunk.get("document_id"),
            filename=chunk["metadata"].get("filename", "Unknown"),
            text=chunk["text"],
        )
        for chunk in reranked_chunks
    ]

    return QueryResponse(
        conversation_id=conversation.id,
        answer=answer,
        citations=citations,
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all chat conversations for the organization.
    """
    result = await db.execute(
        select(Conversation)
        .filter(Conversation.organization_id == current_user.organization_id)
        .order_by(Conversation.created_at.desc())
    )
    return result.scalars().all()


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve a specific conversation thread and its full message history.
    """
    result = await db.execute(
        select(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.organization_id == current_user.organization_id
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found."
        )
    return conversation
