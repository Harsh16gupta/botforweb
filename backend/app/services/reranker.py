"""
Cohere Rerank Integration Service.
Scores search matches based on query semantic relevance, 
shrinking the chunk count down to fit in context windows.
"""

import logging
from typing import List, Dict, Any
import cohere
from app.core.config import settings

logger = logging.getLogger(__name__)


class CohereReranker:
    """
    Wraps the Cohere Rerank API to score and filter document retrieval results.
    Includes a graceful fallback if the Cohere API key is not configured.
    """

    def __init__(self):
        self.enabled = bool(settings.COHERE_API_KEY)
        if self.enabled:
            logger.info("Initializing Cohere client for Reranking")
            self.client = cohere.ClientV2(api_key=settings.COHERE_API_KEY)
        else:
            logger.warning("COHERE_API_KEY not set. Reranking will be bypassed (falling back to vector DB order).")
            self.client = None

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_n: int = 3) -> List[Dict[str, Any]]:
        """
        Reranks the list of documents based on relevance to the query.
        Returns the top_n most relevant documents.
        """
        if not documents:
            return []

        # If not enabled or no client, fallback to first top_n results directly
        if not self.enabled or not self.client:
            return documents[:top_n]

        try:
            doc_texts = [doc["text"] for doc in documents]
            
            # Using client.rerank from Cohere V2 API
            response = self.client.rerank(
                model="rerank-english-v3.0",
                query=query,
                documents=doc_texts,
                top_n=top_n
            )

            reranked_docs = []
            for result in response.results:
                orig_doc = documents[result.index]
                # Inject rerank score
                orig_doc["rerank_score"] = result.relevance_score
                reranked_docs.append(orig_doc)

            return reranked_docs

        except Exception as e:
            logger.error(f"Cohere Rerank API call failed: {str(e)}. Falling back to default retrieval sorting.")
            # Fallback
            return documents[:top_n]


# Global reranker instance
reranker = CohereReranker()
