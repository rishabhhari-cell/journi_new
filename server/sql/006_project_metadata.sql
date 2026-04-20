-- server/sql/006_project_metadata.sql
alter table public.projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
