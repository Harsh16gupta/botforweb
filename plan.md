# Documentation Chatbot SaaS: Complete Implementation Plan

This is the detailed blueprint for building the multi-tenant Documentation Chatbot SaaS. It specifies database schemas, security configurations, API payloads, and design patterns for each milestone to ensure zero data leakage, high performance, and ease of scaling.

---

## 🏗️ Core Architecture Overview

```text
                  +----------------------------------------------+
                  |              React Dashboard / Widget        |
                  +----------------------+-----------------------+
                                         |
                                         v [HTTPS / JSON]
                  +----------------------+-----------------------+
                  |         FastAPI REST API (Backend)           |
                  +-----+--------------------+-------------+-----+
                        |                    |             |
         [SQL / RLS]    |                    |             | [gRPC / REST]
                        v                    v             v
       +-------------------+        +------------+   +-------------+
       | PostgreSQL (ACID) |        | Redis      |   | Qdrant DB   |
       +-------------------+        | Cache/Queue|   | Dense/Sparse|
                                    +-----+------+   +-------------+
                                          |
                                          v [AMQP]
                                    +-----+------+
                                    | Celery     |
                                    | Workers    |
                                    +------------+
```

---

## 🚀 Detailed Milestones & Implementation Specifications

### Week 1-2: RAG Engine MVP [COMPLETED]
* **Goal**: Launch database containers, construct the vector pipeline, implement hybrid search, and set up the FastAPI chat endpoint.
* **Technical details**:
  * Infrastructure: Docker Compose running PostgreSQL 15, Qdrant v1.8.4, and Redis 7.
  * Ingestion: Extracts text from PDFs (via `pypdf`) and Markdowns (including ZIP parsing with YAML frontmatter cleaning).
  * Chunking: Custom `RecursiveCharacterTextSplitter` splitting on `\n\n`, `\n`, ` `, and `""` with `chunk_size=1000` and `chunk_overlap=200`.
  * Embeddings: Generates dense vectors (384d, `BAAI/bge-small-en-v1.5`) and sparse vectors (SPLADE, `prithivida/Splade_PP_en_v1`) locally using Qdrant `fastembed`.
  * Search: Combines dense similarity and sparse keyword scores inside Qdrant using native **Reciprocal Rank Fusion (RRF)**.
  * API: `/auth/signup`, `/auth/login`, `/docs/upload` (synchronous), `/chat/query` (RAG query supporting custom prompt templates, citations, and keyless mock-fallback mode).

---

### Week 3: PostgreSQL + Row-Level Security (RLS) & Multi-Tenancy

To prevent data leaks, we enforce strict multi-tenant isolation at the database and API layer.

#### 1. PostgreSQL Schema Migration
We will configure table schemas with foreign keys linking to `organizations.id` and add indexes for speed:
```sql
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    organization_id INT REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for fast RLS queries
CREATE INDEX idx_users_org ON users(organization_id);
```

#### 2. Row-Level Security (RLS) Policies
Apply PostgreSQL RLS to isolate rows. The backend session sets `app.current_org_id` dynamically on database calls:
```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies checking active session context
CREATE POLICY org_isolation_policy ON documents 
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::integer);

CREATE POLICY org_isolation_policy ON conversations 
    USING (organization_id = NULLIF(current_setting('app.current_org_id', true), '')::integer);
```
FastAPI Middleware sets this config per request during database transaction startup:
```python
async def set_db_org_context(db: AsyncSession, org_id: int):
    await db.execute(text(f"SET LOCAL app.current_org_id = '{org_id}';"))
```

#### 3. API Key Authentication
API calls from public web widgets will authenticate using a custom header: `X-API-Key`.
* **Flow**:
  1. Middleware extracts `X-API-Key`.
  2. Queries the `organizations` table.
  3. Rejects with `401 Unauthorized` if invalid.
  4. Inject `organization_id` into the request state for dynamic collection filtering in Qdrant (`org_docs_{org_id}`).

---

### Week 4: React Admin Dashboard & Async Ingestion

Allows admins to manage documents, view API keys, and run ingestion tasks asynchronously.

#### 1. Async Task Queue (Celery + Redis)
Processing large PDFs or ZIP files synchronously causes API timeouts. We offload this:
- **Task Definition (`backend/app/workers/tasks.py`)**:
  ```python
  @celery_app.task(name="tasks.process_document_ingestion")
  def process_document_ingestion(org_id: int, doc_id: int, filename: str, file_type: str, file_bytes_hex: str):
      # Parse, chunk, and embed asynchronously
      file_bytes = bytes.fromhex(file_bytes_hex)
      ingestion_manager.ingest_document(org_id, doc_id, filename, file_type, file_bytes)
  ```
- **File Upload Route**:
  1. Save `Document` record with status `processing`.
  2. Dispatch Celery task: `process_document_ingestion.delay(...)`.
  3. Immediately return status `202 Accepted` to React.

#### 2. React Admin UI (Vite + TypeScript)
- **Pages**:
  - `Login/Register`: Custom form styled with clean vanilla CSS.
  - `Documents`: File uploader (drag-and-drop supporting `.pdf`, `.md`, and `.zip` archives). Displays table of documents with status badges (`processing`, `active`, `failed`) and delete actions.
  - `API Keys`: Shows the organization API key with copy-to-clipboard functionality.

---

### Week 5-6: Eval Suite & Observability

Ensures the bot answers accurately, never hallucinates, and metrics are fully monitored.

#### 1. OpenTelemetry & Langfuse Setup
- Instrument FastAPI with OpenTelemetry middlewares to trace HTTP requests.
- Wrap vector DB retrievals and DeepSeek generation calls in Langfuse tracing:
  ```python
  from langfuse.openai import openai
  # Traces latency, prompt tokens, generation tokens, and costs
  ```
- Export traces to a local Jaeger container for visualizing request flows and pinpointing latency bottlenecks.

#### 2. Automated Eval Suite (Pytest)
Create a suite of 50 test Q&A pairs. Nightly CI runs them to compute accuracy metrics:
- **Evaluation Criteria**:
  - **Faithfulness (Hallucination)**: Does the generated answer only contain facts present in the context?
  - **Answer Relevance**: Does the answer directly address the user's question?
- **Judge LLM Prompt**:
  ```text
  You are an independent quality auditor. Compare the Context, Question, and Answer below.
  Rate the faithfulness of the Answer on a scale from 0.0 to 1.0. Explain your reasoning.
  ```

#### 3. Real-Time Scorer & Hallucination Guard
- **Confidence Scorer**: Evaluates the retrieved documents' similarity scores. If the highest score is below 0.6, return the response with a disclaimer: *"I am not highly confident in this answer because it's not well-documented."*
- **Hallucination Guard**: Uses a fast LLM call (e.g., deepseek-chat) to verify if the answer is grounded in retrieved texts. If groundedness is < 0.7, reject response or warn user.

---

### Week 7: Stripe Billing & Kubernetes Deployment

Transitioning from an MVP to a production SaaS.

#### 1. Stripe Subscriptions & Webhooks
- **Plans**:
  - **Starter**: $199/month (up to 5,000 queries).
  - **Growth**: $799/month (up to 50,000 queries).
- **Billing Sync**:
  - Listen to webhooks: `customer.subscription.created`, `customer.subscription.deleted`, `invoice.payment_succeeded`.
  - Update `organizations.subscription_status` in database.
- **Overage Tracking**:
  - Cache query counts in Redis per organization.
  - Write daily cron job to sync Redis query counts to Stripe usage records for metered overage billing ($0.001 per query beyond limits).

#### 2. Production Kubernetes (K8s) Deployment
We run a highly available cluster.
- **Backend Deployment**:
  - Replicas: 3 (configured with rolling updates).
  - HPA (Horizontal Pod Autoscaler): Scales from 3 to 10 replicas if CPU utilization exceeds 75%.
- **Manifests Structure (`/k8s`)**:
  - `postgres.yaml` / `qdrant.yaml`: StatefulSets with persistent volume claims (PVC).
  - `redis.yaml`: Deployment for cache/broker.
  - `backend.yaml` / `frontend.yaml`: Stateless deployments and NodePort services.
  - `ingress.yaml`: Ingress controller routing requests from domains/subdomains (subdomain routing for clients).

---

### Week 8: Production Polish & Launch Checklist
- [ ] Set request limits on file uploads (max 100MB ZIPs) and query limits (rate limit: 60 queries/min per API key).
- [ ] Configure automatic daily PostgreSQL backups using `pg_dump` pushed to S3.
- [ ] Write privacy policy, terms of service (TOS), and security compliance guides.
- [ ] Run production integration tests:
  - Verify complete billing flow with Stripe test card.
  - Verify zero-leakage RLS check.
- [ ] Final security audit on CORS settings, JWT expiry enforcement, and database indexing.
- [ ] Launch on Product Hunt!
