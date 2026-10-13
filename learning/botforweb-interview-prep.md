# BotforWeb — Interview Prep (Detailed + Simple, With Reasons)

> How to use: read top to bottom. Each tricky part has **What → Why → What breaks → What I'd do differently**. Speak the "Say in interview" lines aloud.

## 0. Say this in 60 seconds

> BotforWeb is a multi-tenant docs chatbot. Companies upload PDFs, Markdown, ZIPs. Users ask questions, get answers with citations.
> I save account data and chat history in PostgreSQL, and searchable text chunks as vectors in Qdrant.
> Uploads run in background with Celery + Redis so the API returns fast.
> For a question I do hybrid search — meaning search + exact-word search — merge them inside Qdrant with RRF, rerank 10 down to 3 with Cohere, then ask DeepSeek to answer using ONLY that context with temperature 0. I add confidence and hallucination warnings.
> Tenants are isolated by separate Qdrant collection per company plus PostgreSQL Row-Level Security and API-key based tenant resolution.

That's the whole system. Everything below is "why did you do it that way?"

---

## 1. End-to-end story with reasons

### 1.1 Upload: why async? Why 202? Why hex?

**What happens:**
Upload → save a row as `processing` → put job on queue → return immediately → worker does slow work → update row to `active` or `failed`.

**Why async and not do it in the request?**
Parsing a big PDF or ZIP + generating embeddings locally can take seconds to minutes. The first time the embedding model loads it even downloads hundreds of MB. If you do that inside the API request:
- Frontend times out.
- API workers get blocked and can't serve chat queries.
- One large upload can use all memory/CPU of the API.

So the API only does cheap things: check extension, read bytes, insert one DB row, push a small message to Redis. Expensive things happen in a separate worker process that you can scale independently.

**Why return 202 Accepted and not 200?**
200 means "done". 202 means "accepted, will do later". Frontend polls document list while status is `processing`. This is honest API design.

**Why convert file bytes to hex string?**
Celery here is configured to use JSON for messages. JSON cannot carry raw bytes. Hex (or base64) turns bytes into safe text. Reasonable for small docs, but tricky for large files:
- Hex doubles size. A 50MB file becomes 100MB text in Redis. Redis is in-memory — this is wasteful and can block Redis.
- Better design for production: upload file to S3 or disk volume, send only `file_path + doc_id` in the queue message. Worker reads from storage.

**What breaks:**
- Worker is down → doc stays `processing` forever. Need monitoring: alert if `processing > 10 min`, Flower UI for Celery, `task_track_started`.
- Redis down → upload fails at queue step. Current code does rollback and 500, which is correct — don't create orphan `processing` rows if you can't queue.
- Whole file is read into memory with no size limit. A 500MB ZIP can OOM the API. Need max-size check BEFORE reading, plus streaming upload to S3.

**Say in interview:** "I made ingestion async because embedding is slow and bursty. API stays responsive, workers scale separately. Trade-off is eventual consistency — user must poll status — and today large files as hex in Redis won't scale, I'd move to S3 pointers."

### 1.2 Parsing: why different per type? Why chunk 1000/200?

**PDF:** Use `pypdf`, loop pages, extract text, join with blank lines. Reason: PDFs have no markdown structure, just positioned text. `extract_text()` is fragile — scanned PDFs (images) return nothing, tables get scrambled. That's why empty text leads to `failed` status instead of indexing garbage.

**Markdown:** Decode UTF-8 ignoring errors, strip `--- frontmatter ---`. Reason: docs often have YAML headers like title/date that would pollute search. Stripping keeps only real content. Current frontmatter parse is naive `split(":",1)` — nested YAML breaks, but good enough for flat headers.

**ZIP:** Open in memory, iterate files, keep only `.md`, parse each, skip bad files individually. Reason: customers dump whole doc folders. Per-file try/except means one corrupt file doesn't fail the whole upload.

**Why chunk at all?**
Embedding models have token limits (~512 tokens for bge-small) and LLMs have context limits + cost per token. One 50-page PDF as one vector would:
- Lose detail (one vector averages everything).
- Not fit in LLM prompt.
- Give bad citations (can't point to section).

**Why 1000 chars with 200 overlap?**
- 1000 chars ≈ 200-250 tokens, well within embedding limit, and 3 chunks ≈ 750 tokens fits comfortably in DeepSeek prompt with room for question + answer.
- Overlap 200 preserves sentence continuity across boundaries. Without overlap, an answer split across two chunks is lost.
- Separators `["\n\n","\n"," ",""]` tries to cut at paragraphs first, then lines, then words, then characters. This respects structure instead of cutting mid-sentence.

Bigger chunks = fewer vectors, more context per hit, but noisier + more LLM tokens. Smaller = precise but fragments meaning + many more vectors + higher embedding cost. 1000/200 is a pragmatic middle for documentation.

**Say in interview:** "I chunk to fit embedding and LLM limits and to cite precisely. Overlap avoids boundary loss. I'd tune this per doc type — code docs want smaller, narrative docs can be larger."

### 1.3 Embeddings: why both dense + sparse? Why local?

**Dense = meaning.** Turns "how do I deploy?" and "production rollout steps" into nearby numbers even with no shared words. Good for paraphrase. Bad for exact names like `ACME_DEPLOY_TOKEN_V2` — dense may ignore rare tokens.

**Sparse (SPLADE) = smart keywords.** Keeps exact token matching but learns which words matter. Good for error codes, function names, CLI flags. Bad for synonyms.

Docs chatbots need both: users ask conceptually AND paste exact error strings. Hybrid gives best recall.

**Why local with fastembed instead of OpenAI embeddings?**
- No per-token API cost.
- Data stays in VPC (important for private docs).
- No network latency during ingestion.
Trade-off: you pay RAM/disk + cold-start download + lower quality than large proprietary models + you must manage model versioning. If embedding model changes, ALL old vectors become incompatible — need re-index.

Dense is 384 numbers with cosine distance — small and fast. Good default. Larger models (1024d) are better but 3x storage + slower.

**Say in interview:** "I used hybrid because docs queries mix concepts and exact strings. Local avoids cost and data egress, at the cost of ops burden and model upgrade pain."

### 1.4 Hybrid fusion: why RRF? What is the `alpha` trap?

You get two ranked lists: top from dense, top from sparse. How to merge when scores are on totally different scales (cosine 0-1 vs sparse BM25-like unbounded)?

Options:
- **Weighted sum:** normalize both to 0-1 then `alpha*dense + (1-alpha)*sparse`. Powerful but fragile — normalization is hard, one bad score skews everything.
- **RRF (what this project uses):** ignore scores, use only ranks. `score = 1/(k+rank_dense) + 1/(k+rank_sparse)`. Item ranked #1 in either list gets big boost. No tuning, robust.

That's why code prefetches `limit*2` from each then fuses to `limit`. You over-fetch then let RRF pick winners.

**Tricky part:** function signature has `alpha=0.5` but RRF never uses it. It's dead code left from a weighted-sum idea. Interviewer WILL catch this. Say honestly: "Alpha does nothing with RRF. I'd either remove it or implement score-based fusion if we need tunable weighting. RRF was chosen for simplicity and no normalization."

Duplicates within one search are impossible — it's one merged list from one collection. Duplicates across re-uploads are a different bug (see IDs below), not fusion.

**Say in interview:** "RRF because dense and sparse scores aren't comparable. Rank fusion is simple and works without tuning. Cost is two searches per query, but Qdrant does it in one round-trip with prefetch."

### 1.5 Rerank: why second model? Why 10 → 3?

Embedding search is **bi-encoder**: query and doc encoded separately, compared by cosine. Fast for millions of vectors, but shallow — it never reads query+doc together.

Reranker is **cross-encoder**: reads "query + document" together with full attention. Much more accurate for "does this chunk actually answer this question?" but too slow to run on all vectors. So pipeline is: fast recall (10) → accurate precision (3).

Why 10→3?
- 10 gives reranker enough candidates to find good ones even if vector search ranks them 7th.
- 3 fits LLM context cheaply (~750 tokens) with low noise. 10 chunks would be ~2500 tokens — more cost, more latency, more chance LLM gets distracted and hallucinates.
- Cohere call adds 300-800ms + per-call cost. Worth it for user-facing quality. For internal/high-QPS, you might skip rerank or use local cross-encoder.

**Fallback behavior matters:** if no Cohere key or API fails, code returns first N in vector order. That's graceful degradation, not crash. Confidence then falls back to 0.85 (assumes vector order is decent). Admit this 0.85 is optimistic — without rerank you don't really know quality.

**Say in interview:** "Embeddings for recall, reranker for precision, LLM for generation. Each stage cuts volume while increasing understanding per item."

### 1.6 Generation: why this prompt? Why temp 0? Why citations this way?

Prompt says: "using ONLY context, if empty say you don't have info, list filenames at end."

Why:
- **ONLY context** reduces hallucination from parametric knowledge. Without it, LLM happily answers from training data about a different product version.
- **Forced refusal sentence** gives consistent behavior for empty retrieval instead of rambling.
- **List filenames** forces grounding and gives evaluable citations.
- **temp 0.0** makes output deterministic — same context → same answer. Critical for debugging, evals, and user trust. Higher temp would be creative but dangerous for docs.
- **max_tokens 1000** caps cost and prevents huge dumps.

Citations are rebuilt from the chunks SENT to LLM, not parsed from LLM output. This is honest about retrieval but can over-claim ("we showed it 3 files" vs "it actually used file 2"). Better: ask LLM to cite `[1][2]` inline then map, but parsing is fragile.

**Empty retrieval:** context is empty string, but code still calls LLM. Cheaper fix: short-circuit — if no chunks, return refusal without LLM call. Saves money + latency.

**Error handling gap:** if DeepSeek throws, code puts `"Error generating answer: ..."` into answer field with 200 status and saves it as assistant message. Should be 502/503, not saved as valid answer, with retry. Also no timeout set — one hung LLM call hangs request. Add timeout + retries + backoff.

**Say in interview:** "Prompt constrains the model to retrieved context, temp 0 for determinism, token cap for cost. Citations reflect retrieval, which is auditable even if not perfect attribution."

### 1.7 Guards: confidence vs faithfulness, why both? Why thresholds?

Two different failures:
- **Bad retrieval:** no relevant docs exist. Measured by **confidence** = max Cohere score. If best of 3 is still low (<0.6), even a perfect LLM can't answer well. So append disclaimer.
- **Bad generation:** docs were good but LLM invented details. Measured by **faithfulness** = second LLM judge scoring "is answer supported by context?" 0-1. If <0.7, prepend warning.

Why 0.6 and 0.7? Heuristics, not science. Cohere scores cluster high; 0.6 filters obvious misses. 0.7 for faithfulness is stricter because hallucinations are worse than saying "not sure". You'd tune these on eval data with precision-recall curves, not hardcode.

**Tricky fail-open:** if judge call fails or returns garbage, code defaults to 1.0 (assume good) and logs. That's wrong direction — errors hide problems. Better fail-closed: default to low score + log + alert, or skip warning but flag for review. Also judge uses same model family as generator — correlated failures. Independent NLI model would be better and cheaper.

Cost: every query costs 2 LLM calls (answer + judge). Doubles latency/cost. Alternative: run guard only when confidence is borderline, or sample 10% for monitoring instead of blocking.

**Say in interview:** "Confidence guards retrieval quality, faithfulness guards generation quality. Thresholds are starting points to tune. Today guard fails open which I'd change to fail-visible."

---

## 2. Multi-tenancy: the hardest interview area

### 2.1 Simple model

Tenant = company = one row in organizations. Every data row and every vector belongs to exactly one tenant. Server NEVER trusts client-sent tenant ID. It derives tenant from secrets:
- Dashboard admin → JWT (email → org lookup).
- Public widget → API key (direct org lookup).

Even if attacker guesses another tenant's conversation ID like `42`, queries filter by `id AND organization_id = my_org`, so they get 404, not data. Vectors live in `org_docs_myid`, so other org's vectors aren't even in the searched collection.

### 2.2 Why separate Qdrant collection per tenant?

**Why good:**
- Physical isolation — a missing filter can't leak because there's no shared space to leak from.
- Deleting a tenant = delete one collection, simple and complete.
- Per-tenant stats/tuning possible.

**Why painful at scale:**
- Each collection has overhead: memory, file handles, shards, background threads. 10 tenants fine. 10,000 tenants — Qdrant struggles, listing/management slow, RAM explodes.
- Better at scale: one shared collection with `tenant_id` in payload + mandatory filter `must: tenant_id == X` on every search/delete. Cheaper, but one forgotten filter = catastrophic leak. Needs strict code review + integration test that creates 2 tenants and asserts no cross-hits.

**Say in interview:** "Per-tenant collections optimize for isolation simplicity over scale. I'd start there for <500 tenants, migrate to shared + filtered when collection overhead dominates. Migration means backfill payload tenant_id + add filter to all queries."

### 2.3 PostgreSQL RLS: why it looks secure but isn't fully

**What RLS is supposed to do:** database itself hides rows where `organization_id != current tenant`, even if app forgets `WHERE` clause. Session sets `app.current_org_id`, policy checks it.

**Why it doesn't fully protect here — admit all three:**
1. **Superuser bypass.** App connects as `postgres` superuser. In PostgreSQL, superusers bypass ALL RLS, even `FORCE`. So policies never fire. Real protection today is app-level `filter(organization_id == ...)` in every query. Fix: create dedicated `app_user` with `NO SUPERUSER`, grant only needed tables, then RLS actually enforces.
2. **Missing WITH CHECK.** Policies have only `USING` (for reads). Inserts/updates need `WITH CHECK` to block writing another tenant's rows. Without it, a bug setting wrong org_id on insert succeeds.
3. **Never tested on real PG.** Tests run on SQLite, which skips RLS setup entirely. The RLS unit test only checks tenant resolution, not row hiding. Need integration test on real Postgres: create 2 orgs, set context to org A, assert org B rows invisible at SQL level.

Also `messages` policy uses `EXISTS` join via conversations — correct but subtle. If conversation lookup is slow, every message query pays join cost. Index on `conversation_id` mitigates.

**Say in interview:** "RLS is defense-in-depth, not primary defense here. Primary is tenant resolution + filtered queries. I'd make RLS real with least-privilege role, WITH CHECK, and PG integration tests. Until then I don't claim bulletproof isolation."

### 2.4 Why ContextVar + set_config dance?

Request comes in → resolve org → store in `ContextVar` (async-safe per-request storage) → set Postgres session variable → all subsequent queries in that request see correct tenant. Finally block clears it so pooled connection doesn't leak tenant to next request reusing same connection. Forgetting reset = tenant leak via pool reuse. That's why `finally: reset + close` matters.

Worker jobs open their own DB session without setting tenant context — they use direct PK lookup. Works but inconsistent; better to set context there too for uniform RLS.

### 2.5 PG vs Qdrant consistency: why desync is inevitable without design

You have two systems, no distributed transaction. Delete does Qdrant first, then PG. Crash between = orphan vectors (searchable but invisible in doc list) or orphan row (listed but no vectors → empty answers).

Re-upload same doc = new random point IDs → old + new both searchable → duplicate citations, inflated confidence.

**Proper fix with reasons:**
- **Stable IDs:** `uuid5(doc_id, chunk_index)` instead of Python `hash()` (which is salted per process, different every restart — that's why re-ingest never overwrites). Stable IDs make retry safe (same points overwritten).
- **Delete-before-insert** on re-ingest.
- **Soft delete:** mark PG `deleted=true` first (fast, transactional), then async worker deletes vectors, then hard delete. Crash → sweeper retries, no user-visible loss.
- **Nightly reconciler:** compare PG doc IDs vs Qdrant `document_id` payloads per tenant, delete orphans, re-queue missing.
- **Versioning:** keep `version` column + payload, index new version while old still serves, flip atomically. Avoids downtime + stale answers during re-index.

**Say in interview:** "Two stores without 2PC means I design for idempotency + reconciliation, not perfect atomicity. Stable IDs + soft-delete + sweeper is the production pattern."

---

## 3. Background jobs deeper: why Celery + Redis, not simpler?

**Sync ingestion:** simplest code, no infra. Fails for >few seconds — gateway timeouts, blocked API, bad UX.

**FastAPI BackgroundTasks:** returns fast, no extra infra, but runs in API process. Dies on API restart, no retry, shares CPU/RAM with chat queries, no distribution across machines. OK for sending email, not for embedding models.

**Celery + Redis:** separate processes/machines, persistent queue (survives API restart, not Redis restart unless persisted), retries, rate limits, monitoring, independent scaling (add GPU workers for embeddings without scaling API). Cost: operate Redis + workers + Flower + result backend cleanup.

**Missing pieces here and why they matter:**
- No `max_retries / backoff / acks_late`. Without ack-late, if worker crashes mid-task, message is already acked and lost — doc stuck processing. With ack-late + retry, crash re-queues.
- No idempotency (see stable IDs). Retries without idempotency create duplicates.
- No priority/separate queues. One huge ZIP blocks small MDs. Split into `parse` vs `embed` queues with different concurrency.
- No rate limit on embedding/Cohere/DeepSeek. Burst of uploads can hit provider 429 or OOM GPU. Add `rate_limit` + token bucket.

**Say in interview:** "I chose Celery because ingestion is heavy, bursty, and needs independent scaling and survival across API restarts. I'd add ack-late retries, idempotent upserts, and per-provider rate limits before production."

---

## 4. LLM ops: cost, latency, eval

**Per query cost today:** 1 embedding (query) + 1 Qdrant hybrid + 1 Cohere rerank + 1 DeepSeek answer + 1 DeepSeek judge. Latency dominated by Cohere + 2x DeepSeek serially. Could parallelize? No — judge needs answer. Could skip judge when confidence high or sample for monitoring.

**Why not stream?** Streaming (SSE) improves perceived latency but complicates guards (can't warn until full answer judged) and citation handling. Option: stream tokens, send citations + warnings at end.

**Eval:** 50 QA pairs with `supported` (answer should contain substring) vs `unsupported` (should refuse). Judge scores faithfulness/relevance or mock substring check. Asserts avg ≥0.75. This is a smoke signal, not proof — dataset is synthetic, retrieval is mocked (not testing real search), mock fallback inflates scores. Real eval needs: real retrieval (no mocks), larger diverse set, human labels, RAGAS metrics, latency/cost tracking, regression in CI.

**Comparing models:** same dataset, same retrieval, swap only generator. Record faithfulness, relevance, P50/P95 latency, cost per 1k queries. DeepSeek wins on cost, GPT-4/Claude may win on reasoning — decide per query type (simple lookup vs complex synthesis) with routing.

**Say in interview:** "Current eval proves plumbing, not quality. I'd add real-retrieval nightly eval with human spot-checks, track cost/latency alongside accuracy, and only then tune thresholds and Top-K."

---

## 5. What to admit + what you'd change (interview gold)

Admit quickly, fix concretely. Interviewers trust this more than defensiveness.

1. **RLS not real due to superuser.** Fix: app role, WITH CHECK, PG leak test.
2. **Point IDs unstable (`hash()`).** Fix: UUID5/SHA256, delete-first.
3. **Dead `alpha`.** Fix: remove or implement weighted fusion with justification.
4. **Hex bytes in Redis + no size limit.** Fix: S3 pointers + max-size + streaming.
5. **No retries/idempotency/rate limits.** Fix: Celery retry policy, stable IDs, token buckets.
6. **Guard fail-open + error text as 200.** Fix: fail-visible, proper status codes, timeouts.
7. **PG/Qdrant desync.** Fix: soft-delete + reconciler + versioning.
8. **Optimistic 0.85 confidence without rerank.** Fix: calibrate on data or mark unknown.
9. **CORS `*`, 7-day JWT, fallback secret in code.** Fix: allowlist, short expiry + refresh, secret required in prod.
10. **Stripe/K8s/rate limits in plan doc but not code.** Say "planned, not built" — don't claim.

---

## 6. 25 Questions to practice (short prompts, answers above)

**Must-know (P0):** query trace, upload trace, what is tenancy, RLS gaps, Qdrant collection choice, dense vs sparse vs RRF, why rerank, why Celery, PG vs Qdrant link, prompt + citations + empty case.

**Depth (P1):** idempotency fix, sync vs background vs Celery, desync repair, embedding index details, guard thresholds, test coverage gaps, pooling/tx, limits to add.

**Advanced (P2):** per-tenant vs shared at 10k, 100x scale plan, downstream outage behavior, chunk-size tuning, hash bug, observability use, frontend auth flow.

**10 hardest to drill aloud:**
1. Tenant A guesses tenant B conversation 42 — walk through why 404 + vectors untouched.
2. Why does `alpha` do nothing? When would you want it?
3. Crash after Qdrant upsert before DB commit — what's visible? How repair without downtime?
4. Why do point IDs change across restarts? Stable alternative?
5. Does FORCE RLS protect with superuser? Three fixes?
6. Cohere down + DeepSeek timeout same query — user sees vs should see?
7. 10k tenants — what breaks first? Redesign?
8. High rerank score but wrong doc — how do guards still pass hallucination?
9. Re-upload same file twice — duplicates? Why?
10. Swap to GPT-4 + OpenAI embeddings — cost/latency/privacy/code changes?

Pick one, answer in your words for 2 minutes, then re-read the matching section and note what you missed.
