-- Add tasks and collaborators as JSONB columns to projects table.
-- These store frontend Task[] and Collaborator[] arrays directly,
-- allowing full auto-save without separate relational tables.
alter table public.projects
  add column if not exists tasks_json jsonb not null default '[]'::jsonb,
  add column if not exists collaborators_json jsonb not null default '[]'::jsonb;
