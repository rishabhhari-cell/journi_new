-- server/sql/003_embeddings.sql
-- Run in Supabase dashboard SQL editor.
-- Requires pgvector extension (already enabled if journals table has vector support).

alter table manuscripts
  add column if not exists abstract_embedding vector(384);

alter table journals
  add column if not exists scope_embedding vector(384);

-- IVFFlat index for fast cosine similarity on journals (primary query target).
-- lists=10 is appropriate for small corpora (<1000 journals).
-- Increase to sqrt(row_count) once the table grows past ~10k rows.
create index if not exists journals_scope_embedding_idx
  on journals
  using ivfflat (scope_embedding vector_cosine_ops)
  with (lists = 10);

-- pgvector RPC function for journal recommendation
create or replace function match_journals_by_embedding(
  query_embedding vector(384),
  match_count int default 50
)
returns table (
  id uuid,
  external_id text,
  name text,
  abbreviation text,
  logo_url text,
  impact_factor float8,
  impact_factor_year int4,
  open_access bool,
  website_url text,
  submission_portal_url text,
  submission_requirements_json jsonb,
  publisher text,
  subject_areas text[],
  geographic_location text,
  issn_print text,
  issn_online text,
  acceptance_rate float8,
  avg_decision_days int4,
  apc_cost_usd float8,
  provenance jsonb,
  last_verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  mean_time_to_publication_days int4,
  similarity float8
)
language sql stable
as $$
  select
    j.id,
    j.external_id,
    j.name,
    j.abbreviation,
    j.logo_url,
    j.impact_factor,
    j.impact_factor_year,
    j.open_access,
    j.website_url,
    j.submission_portal_url,
    j.submission_requirements_json,
    j.publisher,
    j.subject_areas,
    j.geographic_location,
    j.issn_print,
    j.issn_online,
    j.acceptance_rate,
    j.avg_decision_days,
    j.apc_cost_usd,
    j.provenance,
    j.last_verified_at,
    j.created_at,
    j.updated_at,
    j.mean_time_to_publication_days,
    1 - (j.scope_embedding <=> query_embedding) as similarity
  from journals j
  where j.scope_embedding is not null
  order by j.scope_embedding <=> query_embedding
  limit match_count;
$$;
