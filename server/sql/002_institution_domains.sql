-- Migration 002: Email-domain-based institutional access
--
-- Adds institution_domains table that maps an email domain (e.g. "ucl.ac.uk")
-- to an organization. On sign-up, users whose email matches a registered domain
-- are automatically added to that org as 'viewer'.

create table if not exists public.institution_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,            -- e.g. "ucl.ac.uk" (lowercase, no @)
  organization_id uuid not null references public.organizations(id) on delete cascade,
  default_role text not null default 'viewer'
    check (default_role in ('owner', 'admin', 'editor', 'viewer')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Index for fast lookup on sign-up
create index if not exists institution_domains_domain_idx on public.institution_domains (domain);

-- RLS: only authenticated users in the same org can read; only admins can write
alter table public.institution_domains enable row level security;

create policy "institution_domains_select"
  on public.institution_domains for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.organization_id = institution_domains.organization_id
        and om.user_id = auth.uid()
    )
  );

create policy "institution_domains_insert"
  on public.institution_domains for insert
  with check (false); -- managed via service role only (backend admin endpoint)

create policy "institution_domains_delete"
  on public.institution_domains for delete
  using (false); -- managed via service role only
