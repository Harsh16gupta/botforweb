"""
Chat and RAG Query Endpoints.
Executes RAG searches (hybrid Qdrant retrieval + Cohere Reranking), 
queries DeepSeek Chat API, formats citations, and stores conversation histories.
"""

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
from app.core.security import get_current_user, get_tenant_id
from app.models.models import User, Conversation, Message
from app.schemas.chat import QueryRequest, QueryResponse, ConversationResponse, Citation
from app.services.vector_db import vector_db
from app.services.reranker import reranker
from contextlib import nullcontext
from app.core.observability import langfuse_client

# Try importing OTEL trace helper
try:
    from opentelemetry import trace
    tracer = trace.get_tracer(__name__)
except ImportError:
    tracer = None

from contextlib import contextmanager

@contextmanager
def otel_span(span_name: str, attributes: dict = None):
    if tracer:
        with tracer.start_as_current_span(span_name) as span:
            if attributes:
                for k, v in attributes.items():
                    span.set_attribute(k, v)
            yield span
    else:
        yield None

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
    org_id: int = Depends(get_tenant_id),
):
    """
    RAG-powered chat query endpoint.
    Retrieves documents, reranks them, queries DeepSeek, and returns the answer with citations.
    """
    query = request.query

    # Create OpenTelemetry root span
    with otel_span("query_chatbot", {"organization_id": org_id, "query": query}):
        # Setup Langfuse tracing if enabled
        lf_trace = None
        if langfuse_client:
            lf_trace = langfuse_client.trace(
                name="rag_query",
                user_id=str(org_id),
                metadata={"query": query}
            )

        # Step 1: Fetch candidate chunks from Qdrant using Hybrid Search (dense + sparse)
        with otel_span("vector_retrieval", {"organization_id": org_id}):
            try:
                retrieved_chunks = vector_db.hybrid_search(
                    organization_id=org_id,
                    query=query,
                    limit=10,
                )
            except Exception as e:
                logger.error(f"Vector search failed: {str(e)}")
                retrieved_chunks = []

        # Step 2: Rerank chunks using Cohere Rerank API
        with otel_span("cohere_rerank"):
            reranked_chunks = reranker.rerank(
                query=query,
                documents=retrieved_chunks,
                top_n=3,
            )

        # Calculate Confidence Score based on similarity/rerank scores
        confidence_score = 0.0
        if reranked_chunks:
            if any("rerank_score" in chunk for chunk in reranked_chunks):
                # Cohere relevance score ranges from 0.0 to 1.0
                confidence_score = max([chunk.get("rerank_score", 0.0) for chunk in reranked_chunks])
            else:
                # Fallback to high score if chunks are found but no Cohere score is present
                confidence_score = 0.85

        # Step 3: Fetch the active Conversation or create a new one if not provided
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
            # Auto-create conversation with a clean title derived from the query
            conversation = Conversation(
                title=query[:50] + ("..." if len(query) > 50 else ""),
                organization_id=org_id
            )
            db.add(conversation)
            await db.flush()  # Populate conversation.id

        # Step 4: Write the user's query message to the SQL database
        user_msg = Message(
            conversation_id=conversation.id,
            role="user",
            content=query,
        )
        db.add(user_msg)

        # Step 5: Format the dynamic context text and build the system prompt instructing the LLM
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

        # Step 6: Query DeepSeek completions (or run in offline Mock Mode if key is missing)
        start_time = time.time()
        tokens_used = None
        
        with otel_span("llm_generation", {"model": settings.DEEPSEEK_MODEL}):
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

        # Log to Langfuse if enabled
        if lf_trace:
            try:
                lf_trace.generation(
                    name="deepseek_generation",
                    model=settings.DEEPSEEK_MODEL,
                    input=system_prompt + "\n" + query,
                    output=answer,
                    metadata={"tokens_used": tokens_used, "latency_ms": latency_ms}
                )
            except Exception as lf_err:
                logger.warning(f"Failed to log generation to Langfuse: {str(lf_err)}")

        # Step 7: Hallucination Guard (Faithfulness check)
        faithfulness_score = 1.0
        if reranked_chunks:
            with otel_span("hallucination_guard"):
                if deepseek_client:
                    try:
                        guard_system = (
                            "You are an AI fact checker. Analyze the Context and the Answer below.\n"
                            "Rate how well the Answer is supported by the Context on a scale from 0.0 to 1.0.\n"
                            "1.0 means the Answer contains ONLY information that is directly supported by the Context.\n"
                            "0.0 means the Answer contains information that is completely unsupported or contradicts the Context.\n"
                            "Output only a decimal number representing the score (e.g. 0.95 or 0.4). Do not write any other explanation or text."
                        )
                        guard_user = (
                            f"Context:\n{context_text}\n\n"
                            f"Answer:\n{answer}"
                        )
                        
                        guard_response = deepseek_client.chat.completions.create(
                            model=settings.DEEPSEEK_MODEL,
                            messages=[
                                {"role": "system", "content": guard_system},
                                {"role": "user", "content": guard_user}
                            ],
                            temperature=0.0,
                            max_tokens=10,
                        )
                        score_str = guard_response.choices[0].message.content.strip()
                        try:
                            faithfulness_score = float(score_str)
                        except ValueError:
                            # Heuristic float extractor if formatting is imperfect
                            import re
                            match = re.search(r"\d+\.\d+", score_str)
                            if match:
                                faithfulness_score = float(match.group())
                            else:
                                faithfulness_score = 1.0
                    except Exception as guard_err:
                        logger.error(f"Hallucination guard check query failed: {str(guard_err)}")
                        faithfulness_score = 1.0
                else:
                    # Mock evaluation if DeepSeek is running offline
                    faithfulness_score = 0.95

        # Check thresholds and apply warnings / disclaimers
        if faithfulness_score < 0.7:
            # Prepend the warning
            answer = f"WARNING: This answer may contain unsupported details.\n\n{answer}"
            logger.warning(f"Hallucination guard triggered! Faithfulness score: {faithfulness_score}")
        
        if confidence_score < 0.6:
            # Append the disclaimer
            disclaimer = "\n\n*I am not highly confident in this answer because it's not well-documented.*"
            answer += disclaimer
            logger.info(f"Low confidence warning triggered! Confidence score: {confidence_score}")

        # 8. Save Assistant Message to Database
        assistant_msg = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=answer,
            latency_ms=latency_ms,
            tokens_used=tokens_used,
        )
        db.add(assistant_msg)
        await db.commit()

        # 9. Build Citations for Response
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
            confidence_score=confidence_score,
            faithfulness_score=faithfulness_score,
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
