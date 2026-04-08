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

-- RLS
alter table public.manuscript_import_sessions enable row level security;

-- SELECT: the user created the session, or has project access via the linked manuscript
drop policy if exists import_sessions_select on public.manuscript_import_sessions;
create policy import_sessions_select on public.manuscript_import_sessions
for select using (
  created_by = auth.uid()
  or (
    manuscript_id is not null
    and exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_import_sessions.manuscript_id
        and public.has_project_access(m.project_id)
    )
  )
);

-- INSERT: authenticated users only; they must set created_by to themselves
drop policy if exists import_sessions_insert on public.manuscript_import_sessions;
create policy import_sessions_insert on public.manuscript_import_sessions
for insert with check (
  created_by = auth.uid()
);

-- UPDATE/DELETE: creator, or project editor via linked manuscript
drop policy if exists import_sessions_write on public.manuscript_import_sessions;
create policy import_sessions_write on public.manuscript_import_sessions
for all using (
  created_by = auth.uid()
  or (
    manuscript_id is not null
    and exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_import_sessions.manuscript_id
        and public.can_edit_project(m.project_id)
    )
  )
)
with check (
  created_by = auth.uid()
  or (
    manuscript_id is not null
    and exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_import_sessions.manuscript_id
        and public.can_edit_project(m.project_id)
    )
  )
);
