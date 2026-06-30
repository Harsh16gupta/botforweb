"""
Qdrant Vector Database Service.
Handles client initialization, dynamic multi-tenant collection creation, 
local dense and sparse embedding generation (via FastEmbed), and hybrid search.
"""

import logging
from typing import List, Dict, Any, Tuple, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from fastembed import TextEmbedding, SparseTextEmbedding

from app.core.config import settings

logger = logging.getLogger(__name__)


class QdrantManager:
    """Manages Qdrant client connection, collection initialization, and hybrid search queries."""

    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self._dense_model: Optional[TextEmbedding] = None
        self._sparse_model: Optional[SparseTextEmbedding] = None

    @property
    def dense_model(self) -> TextEmbedding:
        """Lazily load the dense embedding model"""
        if self._dense_model is None:
            logger.info(f"Loading dense embedding model: {settings.DENSE_MODEL_NAME}")
            self._dense_model = TextEmbedding(model_name=settings.DENSE_MODEL_NAME)
        return self._dense_model

    @property
    def sparse_model(self) -> SparseTextEmbedding:
        """Lazily load the sparse embedding model"""
        if self._sparse_model is None:
            logger.info(f"Loading sparse embedding model: {settings.SPARSE_MODEL_NAME}")
            self._sparse_model = SparseTextEmbedding(model_name=settings.SPARSE_MODEL_NAME)
        return self._sparse_model

    def get_collection_name(self, organization_id: int) -> str:
        """Generate isolation namespace/collection name for an organization"""
        return f"org_docs_{organization_id}"

    def create_organization_collection(self, organization_id: int) -> None:
        """Creates an isolated collection for an organization if it doesn't already exist"""
        collection_name = self.get_collection_name(organization_id)
        
        # Check if collection already exists
        if self.client.collection_exists(collection_name):
            return

        logger.info(f"Creating isolated Qdrant collection: {collection_name}")
        
        # Create collection with hybrid search configs (dense + sparse)
        self.client.create_collection(
            collection_name=collection_name,
            vectors_config={
                "dense": models.VectorParams(
                    size=384,  # BAAI/bge-small-en-v1.5 dimension
                    distance=models.Distance.COSINE,
                )
            },
            sparse_vectors_config={
                "sparse": models.SparseVectorParams(
                    index=models.SparseIndexParams(
                        on_disk=True
                    )
                )
            }
        )

    def delete_organization_collection(self, organization_id: int) -> None:
        """Deletes the organization's collection"""
        collection_name = self.get_collection_name(organization_id)
        if self.client.collection_exists(collection_name):
            logger.info(f"Deleting collection: {collection_name}")
            self.client.delete_collection(collection_name)

    def embed_texts(self, texts: List[str]) -> Tuple[List[List[float]], List[models.SparseVector]]:
        """Generates dense and sparse embeddings for a list of texts"""
        # Generate dense embeddings
        dense_embs = list(self.dense_model.embed(texts))
        dense_vectors = [emb.tolist() for emb in dense_embs]

        # Generate sparse embeddings
        sparse_embs = list(self.sparse_model.embed(texts))
        sparse_vectors = [
            models.SparseVector(
                indices=emb.indices.tolist(),
                values=emb.values.tolist(),
            )
            for emb in sparse_embs
        ]

        return dense_vectors, sparse_vectors

    def upsert_chunks(
        self,
        organization_id: int,
        document_id: int,
        chunks: List[Dict[str, Any]],
    ) -> None:
        """
        Embeds and stores document chunks into Qdrant.
        Each chunk dict should contain: 'text', 'metadata' (dict).
        """
        # Step 1: Resolve the isolated collection name for the organization
        collection_name = self.get_collection_name(organization_id)
        # Step 2: Auto-create the collection (with correct schemas) if it does not exist
        self.create_organization_collection(organization_id)

        # Step 3: Extract texts and generate the dense and sparse embeddings
        texts = [chunk["text"] for chunk in chunks]
        dense_vectors, sparse_vectors = self.embed_texts(texts)

        # Step 4: Build Qdrant PointStruct objects for batch upload
        points = []
        for i, chunk in enumerate(chunks):
            # Generate a stable positive 64-bit integer ID for the vector point
            point_id = hash(f"{document_id}_{i}")
            point_id = abs(point_id) % (2**63 - 1)

            # Store the text body and original file metadata directly inside the vector payload
            payload = {
                "document_id": document_id,
                "text": chunk["text"],
                "metadata": chunk.get("metadata", {}),
            }

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector={
                        "dense": dense_vectors[i],
                        "sparse": sparse_vectors[i],
                    },
                    payload=payload,
                )
            )

        # Step 5: Upload all points to the isolated Qdrant collection in a single batch
        logger.info(f"Upserting {len(points)} chunks to collection {collection_name}")
        self.client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True,
        )

    def hybrid_search(
        self,
        organization_id: int,
        query: str,
        limit: int = 5,
        alpha: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Performs hybrid search combining dense semantic and sparse lexical vector scores.
        alpha (0.0 to 1.0): controls the weight between dense (semantic) and sparse (keyword) search.
        """
        # If the collection doesn't exist yet, we have no indexed data. Return empty results.
        collection_name = self.get_collection_name(organization_id)
        if not self.client.collection_exists(collection_name):
            return []

        # Step 1: Embed query text to search vectors
        dense_vectors, sparse_vectors = self.embed_texts([query])
        query_dense = dense_vectors[0]
        query_sparse = sparse_vectors[0]

        # Step 2: Set up Prefetch queries for both search index types.
        # Dense prefetch (searches meaning/semantics)
        dense_prefetch = models.Prefetch(
            query=query_dense,
            using="dense",
            limit=limit * 2,
        )
        
        # Sparse prefetch (searches exact keyword/token matches)
        sparse_prefetch = models.Prefetch(
            query=query_sparse,
            using="sparse",
            limit=limit * 2,
        )

        # Step 3: Run the combined hybrid search.
        # Qdrant queries both, and uses Reciprocal Rank Fusion (RRF)
        # to merge the rankings into a single sorted list.
        results = self.client.query_points(
            collection_name=collection_name,
            prefetch=[dense_prefetch, sparse_prefetch],
            query=models.FusionQuery(
                fusion=models.Fusion.RRF
            ),
            limit=limit,
        )

        # Step 4: Format output points into simple payload dictionaries
        matched_chunks = []
        for point in results.points:
            matched_chunks.append({
                "text": point.payload.get("text", ""),
                "document_id": point.payload.get("document_id"),
                "metadata": point.payload.get("metadata", {}),
                "score": point.score,
            })

        return matched_chunks

    def delete_document_chunks(self, organization_id: int, document_id: int) -> None:
        """Deletes all chunks associated with a specific document ID from the organization's collection"""
        collection_name = self.get_collection_name(organization_id)
        if not self.client.collection_exists(collection_name):
            return

        self.client.delete(
            collection_name=collection_name,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id",
                            match=models.MatchValue(value=document_id),
                        )
                    ]
                )
            ),
        )


# Global vector DB manager instance
vector_db = QdrantManager()

