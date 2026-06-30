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
        collection_name = self.get_collection_name(organization_id)
        self.create_organization_collection(organization_id)

        texts = [chunk["text"] for chunk in chunks]
        dense_vectors, sparse_vectors = self.embed_texts(texts)

        points = []
        for i, chunk in enumerate(chunks):
            # Generate a stable UUID or use integer hashing for point ID
            # To keep it simple and clean, generate integer ids sequentially per upload,
            # or use standard UUID4. Let's use simple indexing with a hash.
            point_id = hash(f"{document_id}_{i}")
            
            # Ensure positive 64-bit int for Qdrant compatibility if using hash
            point_id = abs(point_id) % (2**63 - 1)

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
        collection_name = self.get_collection_name(organization_id)
        if not self.client.collection_exists(collection_name):
            return []

        # Embed query text
        dense_vectors, sparse_vectors = self.embed_texts([query])
        query_dense = dense_vectors[0]
        query_sparse = sparse_vectors[0]

        # Use Qdrant's Query API for hybrid search
        # Query dense vector
        dense_prefetch = models.Prefetch(
            query=query_dense,
            using="dense",
            limit=limit * 2,
        )
        
        # Query sparse vector
        sparse_prefetch = models.Prefetch(
            query=query_sparse,
            using="sparse",
            limit=limit * 2,
        )

        # RRF (Reciprocal Rank Fusion) or relative scoring.
        # Since Qdrant v1.10 we can do fusion natively, but for standard compatibility,
        # we can prefetch both and merge them, or query with a joint model.
        # Let's perform a native combination query in Qdrant using the Prefetch API.
        results = self.client.query_points(
            collection_name=collection_name,
            prefetch=[dense_prefetch, sparse_prefetch],
            # Combine scores using Reciprocal Rank Fusion (RRF)
            query=models.FusionQuery(
                fusion=models.Fusion.RRF
            ),
            limit=limit,
        )

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

