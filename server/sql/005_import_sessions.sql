create table if not exists public.manuscript_import_sessions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.manuscripts(id) on delete cascade,
  file_name text not null,
  file_title text not null,
  source_format text not null check (source_format in ('docx', 'pdf', 'image')),
  review_required boolean not null default true,
  status text not null check (status in ('pending_review', 'ready_to_commit', 'manual_only', 'unsupported', 'committed')),
  unsupported_reason text,
  diagnostics_json jsonb not null default '[]'::jsonb,
  items_json jsonb not null default '[]'::jsonb,
  committed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists manuscript_import_sessions_manuscript_idx
  on public.manuscript_import_sessions (manuscript_id, created_at desc);

drop trigger if exists set_manuscript_import_sessions_updated_at on public.manuscript_import_sessions;
create trigger set_manuscript_import_sessions_updated_at
before update on public.manuscript_import_sessions
for each row execute procedure public.set_updated_at();
