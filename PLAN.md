# Journi Backend Migration Plan — Runpod Private LLM Stack

## Overview

Migrate Journi's backend from Railway (Ollama + Supabase-as-DB) to a fully private Runpod deployment. The end state is a self-contained stack where all manuscript data, LLM inference, object storage, and async processing live inside Runpod-controlled infrastructure. Supabase stays for authentication only. The migration is broken into five phases that can be executed sequentially without breaking the running application at each phase boundary.

---

## Architecture — Target State

```
Browser
  │  HTTPS
  ▼
journi-api        (Runpod CPU pod — public ingress)
  │  private networking
  ├──► journi-db      (Runpod Postgres pod — private)
  ├──► journi-objects (Runpod MinIO pod — private)
  ├──► journi-worker  (Runpod CPU pod — private, job consumer)
  │       │
  │       └──► journi-llm  (Runpod GPU pod L4 24GB — private)
  └──► Supabase Auth (JWT verification only — external)
```

**Runpod pod specs:**
- `journi-api`: 4 vCPU / 8 GB RAM, CPU-only, public endpoint enabled
- `journi-worker`: 4 vCPU / 8 GB RAM, CPU-only, private
- `journi-db`: 4 vCPU / 16 GB RAM, CPU-only, private (Postgres 16)
- `journi-objects`: 2 vCPU / 8 GB RAM, CPU-only, private (MinIO)
- `journi-llm`: 1× NVIDIA L4 24 GB, persistent pod (see §GPU Strategy), private
- `journi-train` (ephemeral): 1× A40 48 GB, launched only for fine-tuning runs

**Shared storage:** Runpod Network Volume mounted at `/workspace` across journi-llm and journi-train.

---

## Phase 1 — Provision Runpod Infrastructure

**Goal:** All pods running, networked, and reachable from each other. No app code changes.

### Tasks

1. Create a Runpod Network Volume (`/workspace`, ≥200 GB).
2. Launch `journi-db` pod:
   - Use `postgres:16` Docker image.
   - Expose port 5432 on private networking only.
   - Set `POSTGRES_PASSWORD` via Runpod secret.
   - Run all 5 SQL migrations (see §Schema Migration below).
3. Launch `journi-objects` pod:
   - Use `minio/minio` Docker image.
   - Expose port 9000 (S3 API) on private networking only.
   - Create bucket `journi-manuscripts` with server-side encryption enabled.
   - Store `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` as Runpod secrets.
4. Launch `journi-llm` pod:
   - Use `vllm/vllm-openai:latest` — **pin the exact image tag after verifying LoRA works** (see §Pre-flight Check).
   - Mount `/workspace` network volume.
   - Start command:
     ```bash
     vllm serve Qwen/Qwen3-4B \
       --host 0.0.0.0 \
       --port 8000 \
       --gpu-memory-utilization 0.85 \
       --max-model-len 16384 \
       --dtype auto \
       --enable-lora \
       --max-loras 1
     ```
   - No LoRA module at first boot — add `--lora-modules` after the first adapter is trained.
   - Model cache path: `/workspace/models/Qwen3-4B`.
5. Verify internal DNS resolution between pods using Runpod's `.runpod.internal` naming.

### Schema Migration

Translate all 5 existing SQL migration files for plain Postgres (no Supabase extensions, no `auth` schema):

**Key changes required across all migrations:**
- Replace every `references auth.users(id)` with `references users(id)`.
- Add a `users` table as the first migration:
  ```sql
  CREATE TABLE users (
    id          uuid PRIMARY KEY,
    email       text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  ```
  This table is populated via a Supabase Auth webhook (see §Auth Sync below).
- Remove all `CREATE POLICY` / `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements — authorization is handled entirely in application code via `server/lib/access.ts`.
- Remove all `CREATE OR REPLACE FUNCTION` PL/pgSQL helpers (`is_org_member`, etc.) — these are already re-implemented in TypeScript in `server/lib/access.ts`.
- Remove all `CREATE EXTENSION` calls that are Supabase-specific (e.g., `pg_graphql`, `pg_stat_statements` is fine to keep).
- Keep all indexes, constraints, and `CREATE TRIGGER` statements that are not auth-dependent.

**File mapping:**
- `server/sql/001_initial_schema.sql` → `server/sql/runpod/001_users_and_core.sql`
- `server/sql/002_institution_domains.sql` → `server/sql/runpod/002_institution_domains.sql`
- `server/sql/003_project_tasks_collaborators.sql` → `server/sql/runpod/003_project_tasks.sql`
- `server/sql/004_billing_and_submissions.sql` → `server/sql/runpod/004_billing_and_submissions.sql`
- `server/sql/005_import_sessions.sql` → `server/sql/runpod/005_import_sessions.sql`

### Auth Sync

To keep the `users` table in sync with Supabase Auth:
- In Supabase Dashboard → Auth → Webhooks: add a webhook on `user.created` and `user.deleted` events pointing to a new route on journi-api: `POST /internal/auth-sync`.
- `POST /internal/auth-sync` verifies a shared secret header (`X-Auth-Sync-Secret`) and upserts/deletes from the `users` table.
- This route is the only way new user UUIDs enter the Runpod Postgres.

---

## Phase 2 — Wire API to Runpod Postgres

**Goal:** journi-api reads/writes from Runpod Postgres instead of Supabase DB. Supabase is used only for JWT verification.

### New env vars (add to `server/config/env.ts`)

```
RUNPOD_DB_URL         postgres://user:pass@journi-db.runpod.internal:5432/journi
VLLM_BASE_URL         http://journi-llm.runpod.internal:8000
MINIO_ENDPOINT        journi-objects.runpod.internal:9000
MINIO_ACCESS_KEY      ...
MINIO_SECRET_KEY      ...
MINIO_BUCKET          journi-manuscripts
AUTH_SYNC_SECRET      ...   (shared secret for /internal/auth-sync webhook)
```

Remove from `server/config/env.ts` (after migration):
```
OLLAMA_BASE_URL
OLLAMA_MODEL
ANTHROPIC_API_KEY
```

### New files

**`server/lib/db.ts`** — Postgres connection pool using the `pg` package (already in `package.json`):
```typescript
import { Pool } from "pg";
import { env } from "../config/env";

export const db = new Pool({ connectionString: env.RUNPOD_DB_URL, max: 20 });
```

**`server/lib/object-storage.ts`** — MinIO S3-compatible client:
```typescript
import * as Minio from "minio";
// initialise client from env vars
// export: uploadFile(key, buffer, contentType), getSignedUrl(key), deleteFile(key)
```

**`server/repositories/`** — One file per domain, replacing all `supabaseAdmin.from(...)` calls:
- `organizations.repository.ts`
- `projects.repository.ts`
- `manuscripts.repository.ts`
- `citations.repository.ts`
- `submissions.repository.ts`
- `import-sessions.repository.ts`
- `journals.repository.ts`

Each repository exports typed async functions (e.g., `getManuscriptById(id: string, userId: string)`). Use parameterized queries only — no string interpolation.

### Auth middleware update

`server/middleware/auth.ts` — `requireAuth` currently calls `supabaseAdmin.auth.getUser(token)`. This call stays on Supabase (JWT verification is a Supabase Auth concern). No change needed here.

### Route rewiring

Replace all `supabaseAdmin.from(...)` calls in every route file with repository calls. Work route-by-route:

1. `server/routes/manuscripts.ts` — highest priority (core feature)
2. `server/routes/projects.ts`
3. `server/routes/organizations.ts`
4. `server/routes/citations.ts`
5. `server/routes/submissions.ts`
6. `server/routes/journals.ts`
7. `server/routes/comments.ts`
8. `server/routes/auth.ts` — last; profile creation on signup must write to both Supabase Auth and Runpod Postgres `users` table

### Data migration (existing production data)

Run once during cutover window:
1. Export from Supabase: use `supabase db dump` or `pg_dump` on the Supabase Postgres.
2. Strip all Supabase-specific objects (policies, `auth` schema references, extensions).
3. Import into Runpod Postgres via `psql`.
4. Backfill the `users` table from Supabase's `auth.users` export.
5. Validate row counts match across all tables.

---

## Phase 3 — Replace LLM Service with vLLM

**Goal:** `server/services/llm.service.ts` points to journi-llm (vLLM) instead of Ollama/Anthropic.

### Pre-flight Check (do this before writing any code)

1. SSH into journi-llm pod.
2. Start vLLM with `--enable-lora`.
3. Create a trivial LoRA adapter (rank 1, random weights) using PEFT.
4. Load it via the vLLM `/v1/completions` endpoint with `lora_request`.
5. Confirm a successful response. If this fails, the vLLM version needs updating before proceeding.

### Changes to `server/services/llm.service.ts`

**Replace `invokeOllama` with `invokeVLLM`:**

```typescript
const VLLM_BASE_URL = process.env.VLLM_BASE_URL ?? "http://localhost:8000";
const VLLM_MODEL = process.env.VLLM_MODEL ?? "Qwen/Qwen3-4B";

async function invokeVLLM(textChunk: string): Promise<LLMResponse> {
  await waitForVLLM();

  const res = await fetch(`${VLLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VLLM_MODEL,
      messages: [
        { role: "system", content: "Return only valid JSON matching the schema. /no_think" },
        { role: "user", content: buildPrompt(textChunk) },
      ],
      temperature: 0.0,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`vLLM returned ${res.status} ${res.statusText}`);
  const data = await res.json();
  return parseJsonResponse(data.choices[0].message.content);
}
```

**Critical: disable thinking mode.** Qwen3-4B defaults to prepending `<think>...</think>` blocks. The `/no_think` token in the system prompt disables this. Without it, `JSON.parse()` will fail on every response. Alternatively, add `chat_template_kwargs: { enable_thinking: false }` to the vLLM request body if the model version supports it.

**Replace `waitForOllamaModel` with `waitForVLLM`:**

```typescript
async function waitForVLLM(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${VLLM_BASE_URL}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(`vLLM not ready within ${timeoutMs / 1000}s`);
}
```

**Remove Anthropic fallback entirely** — delete `invokeAnthropic` and the fallback branch in `invokeLLM`. Replace the top-level error with a structured response that sets `reviewRequired: true` and returns a parse result with empty sections/citations rather than throwing. This lets the import session flow continue with a "manual review required" state rather than a hard failure.

**Updated `parseJsonResponse`** — add stripping of any stray `<think>` blocks as a safety net:

```typescript
function parseJsonResponse(raw: string): LLMResponse {
  let text = raw.trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  text = text.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```$/m, "").trim();
  const parsed = JSON.parse(text);
  return {
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    citations: Array.isArray(parsed.citations) ? parsed.citations : [],
  };
}
```

### GPU Pod Strategy

Run journi-llm as a **persistent pod** (not on-demand). Document parsing is triggered synchronously during user upload — a 30–120s cold start is unacceptable. The L4 24GB runs ~$0.44/hr. For MVP, keep it running 24/7. Optionally implement a keep-warm cron (ping `/health` every 5 minutes) to prevent Runpod from hibernating the pod.

### Remove Railway Ollama service

After Phase 3 is live and validated:
- Remove `ollama-service/` directory from the repo.
- Remove `Dockerfile.ollama` from the root (if present).
- Remove `OLLAMA_BASE_URL` and `OLLAMA_MODEL` from `server/config/env.ts` and all `.env` files.

---

## Phase 4 — Async Job Queue (journi-worker)

**Goal:** Heavy document parsing runs off the API request cycle via an async queue.

### Queue mechanism

Use **`pg-boss`** (no extra broker needed — uses the existing Runpod Postgres as queue storage). Add to `package.json`:
```
pg-boss: ^10.x
```

**`server/lib/queue.ts`** — shared PgBoss instance:
```typescript
import PgBoss from "pg-boss";
import { env } from "../config/env";

export const queue = new PgBoss(env.RUNPOD_DB_URL);
```

**Job names:**
- `parse-document` — payload: `{ importSessionId, fileKey, userId }`
- `format-check` — payload: `{ manuscriptId, journalId, userId }`

### API side (journi-api)

Change `POST /api/manuscripts/parse` from synchronous to async:
1. Validate upload, write encrypted file to MinIO via `server/lib/object-storage.ts`.
2. Create an import session row with `status: 'pending'`.
3. Enqueue a `parse-document` job with the session ID and MinIO object key.
4. Return `{ importSessionId, status: 'pending' }` immediately (HTTP 202).

Add `GET /api/manuscripts/import-sessions/:sessionId/status` — polls session status from DB. Frontend polls this until `status` is not `pending`.

### Worker side (journi-worker)

New entry point: `worker/index.ts`
- Connects to the same `pg-boss` queue instance.
- Subscribes to `parse-document` jobs.
- For each job:
  1. Download file from MinIO.
  2. Run `parseUploadedDocument()` (deterministic parse first).
  3. If low-confidence, call journi-llm via `parseDocumentWithLLM()`.
  4. Write results to Postgres (update import session with `items_json`, `diagnostics_json`, `status: 'ready_to_commit'`).
  5. If LLM is unavailable, set `status: 'manual_only'` with diagnostic explaining the reason.

---

## Phase 5 — Fine-Tuning (journi-docops-lora-v1)

**Goal:** Train a LoRA adapter on `Qwen3-4B` for Journi's four document-ops tasks.

### Training tasks (JSONL format)

Each example follows the chat template:
```json
{
  "messages": [
    { "role": "system", "content": "Return only valid JSON matching the schema. /no_think" },
    { "role": "user", "content": "<task-specific prompt>" },
    { "role": "assistant", "content": "{...}" }
  ],
  "metadata": { "task": "parse_blocks_to_sections", "study_type": "rct", "source": "pmc_oa", "license": "CC-BY-4.0" }
}
```

**Task A — `parse_blocks_to_sections`**: Map extracted text blocks to canonical manuscript sections.
**Task B — `article_to_canonical_section_json`**: Full article text → structured section JSON.
**Task C — `guideline_text_to_requirements_json`**: Author instructions page → journal requirements JSON.
**Task D — `manuscript_plus_requirements_to_format_action_labels`**: Produce bounded suggestion labels.

### Dataset

- **Target size**: ~1,500 open-access papers from PMC OA Subset and Europe PMC OA.
- **Gold labels**: Manually review 200–300 papers across all study types before training.
- **License requirement**: Store license metadata with every training example; use only CC-BY or CC0.
- Dataset stored at `/workspace/datasets/` on the network volume.

### LoRA configs (two configs, not one)

**Config A — generative tasks** (Task B, C — citation rescue, guideline normalization):
```python
LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05,
  target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"])
```

**Config B — classification tasks** (Task A, D — section labeling, format action labels):
```python
LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05,
  target_modules=["q_proj","k_proj","v_proj","o_proj"])
```

### Training script location

`scripts/train/finetune.py` — uses `transformers`, `peft`, `trl` (SFTTrainer), `bitsandbytes`, `accelerate`. Run on `journi-train` (A40 48GB). Saves adapter to `/workspace/adapters/journi-docops-lora-v1`.

### Deploying the adapter

After eval passes thresholds:
1. Copy adapter to `/workspace/adapters/journi-docops-lora-v1`.
2. Restart journi-llm with `--lora-modules journi-docops=/workspace/adapters/journi-docops-lora-v1`.
3. Update `invokeVLLM` to pass `extra_body: { lora_request: { lora_name: "journi-docops", ... } }`.

---

## Files to Create

| File | Purpose |
|---|---|
| `server/lib/db.ts` | pg connection pool to Runpod Postgres |
| `server/lib/object-storage.ts` | MinIO S3 client |
| `server/lib/queue.ts` | pg-boss queue instance |
| `server/repositories/organizations.repository.ts` | Org DB queries |
| `server/repositories/projects.repository.ts` | Project DB queries |
| `server/repositories/manuscripts.repository.ts` | Manuscript DB queries |
| `server/repositories/citations.repository.ts` | Citation DB queries |
| `server/repositories/submissions.repository.ts` | Submission DB queries |
| `server/repositories/import-sessions.repository.ts` | Import session queries |
| `server/repositories/journals.repository.ts` | Journal queries |
| `server/routes/internal/auth-sync.ts` | Supabase Auth webhook handler |
| `worker/index.ts` | Worker pod entry point |
| `worker/jobs/parse-document.ts` | Parse job handler |
| `server/sql/runpod/001_users_and_core.sql` | Translated schema (no RLS, no auth.users) |
| `server/sql/runpod/002_institution_domains.sql` | Translated |
| `server/sql/runpod/003_project_tasks.sql` | Translated |
| `server/sql/runpod/004_billing_and_submissions.sql` | Translated |
| `server/sql/runpod/005_import_sessions.sql` | Translated |
| `scripts/train/finetune.py` | QLoRA fine-tuning script |

## Files to Modify

| File | Change |
|---|---|
| `server/services/llm.service.ts` | Replace Ollama/Anthropic with vLLM; add thinking-mode strip; graceful degradation |
| `server/config/env.ts` | Add RUNPOD_DB_URL, VLLM_BASE_URL, MINIO_*, AUTH_SYNC_SECRET; remove OLLAMA_*, ANTHROPIC_API_KEY |
| `server/routes/manuscripts.ts` | Replace supabaseAdmin calls with repository; make parse async (202 + poll) |
| `server/routes/projects.ts` | Replace supabaseAdmin calls with repository |
| `server/routes/organizations.ts` | Replace supabaseAdmin calls with repository |
| `server/routes/citations.ts` | Replace supabaseAdmin calls with repository |
| `server/routes/submissions.ts` | Replace supabaseAdmin calls with repository |
| `server/routes/journals.ts` | Replace supabaseAdmin calls with repository |
| `server/routes/comments.ts` | Replace supabaseAdmin calls with repository |
| `server/app.ts` | Mount `/internal/auth-sync` route; init pg-boss queue on startup |

## Files to Delete (after Phase 3 validation)

- `ollama-service/` (entire directory)
- Root `Dockerfile.ollama` (if present)

---

## Constraints for Codex

- **Do not modify `server/middleware/auth.ts`**. The `supabaseAdmin.auth.getUser(token)` call in `requireAuth` stays — JWT verification remains Supabase's responsibility.
- **Do not modify `server/routes/auth.ts`**. Auth routes (signup, login, password reset) remain fully Supabase-managed and are addressed in a later phase.
- **Do not modify `server/services/manuscript-parse.service.ts`** except to wire it into the async worker job. Deterministic parsing logic is preserved unchanged.
- **Do not modify `server/services/format-check.service.ts`**. It is already deterministic and not LLM-dependent.
- **All SQL queries must use parameterized placeholders** (`$1`, `$2`, etc.) — never string interpolation.
- **No ORM**. Use the `pg` Pool directly with typed repository functions.
- **Preserve the `billing_events` unique constraint** on `stripe_event_id` in the migrated schema — Stripe deduplication depends on it.

---

## Verification Checklist

### Infrastructure
- [ ] journi-llm responds to `GET /health` from journi-api's private network
- [ ] journi-db is reachable at `RUNPOD_DB_URL` from journi-api and journi-worker
- [ ] journi-objects MinIO is reachable from journi-api and journi-worker
- [ ] journi-llm is NOT reachable from the public internet

### LLM
- [ ] `POST /v1/chat/completions` with a test document chunk returns valid JSON (no `<think>` blocks)
- [ ] LoRA attach/detach verified with a dummy adapter before fine-tuning begins
- [ ] `waitForVLLM()` resolves correctly when pod is ready

### Parsing flow
- [ ] Upload DOCX → 202 response with `importSessionId`
- [ ] Poll `/import-sessions/:id/status` transitions from `pending` → `ready_to_commit`
- [ ] Commit endpoint applies sections and citations to manuscript correctly
- [ ] If journi-llm is unreachable, session status becomes `manual_only` (not a 500)

### Data integrity
- [ ] Row counts in Runpod Postgres match Supabase export after migration
- [ ] `users` table populated correctly from Supabase Auth export
- [ ] Auth sync webhook creates new users in Runpod Postgres on signup

### Billing
- [ ] Stripe webhook reaches journi-api at its public endpoint
- [ ] `billing_events.stripe_event_id` unique constraint is present in new schema
- [ ] Duplicate Stripe events are silently deduplicated (test with replayed event)
