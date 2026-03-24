-- Journi backend initial schema
-- Includes org/user access model, journal catalog, collaboration entities,
-- audit/notifications, and RLS policies.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Common updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  initials text not null,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Organizations and roles
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Journals
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  name text not null,
  abbreviation text,
  logo_url text,
  impact_factor numeric,
  impact_factor_year int,
  open_access boolean,
  website_url text,
  submission_portal_url text,
  submission_requirements_json jsonb,
  publisher text,
  subject_areas text[] not null default '{}',
  geographic_location text,
  issn_print text,
  issn_online text,
  acceptance_rate numeric,
  avg_decision_days int,
  apc_cost_usd numeric,
  provenance jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists journals_issn_print_unique on public.journals (issn_print) where issn_print is not null;
create unique index if not exists journals_issn_online_unique on public.journals (issn_online) where issn_online is not null;
create index if not exists journals_name_trgm_idx on public.journals using gin (name gin_trgm_ops);
create index if not exists journals_subjects_idx on public.journals using gin (subject_areas);

-- Projects and collaboration
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  due_date timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  can_edit boolean not null default true,
  can_comment boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, user_id)
);

create table if not exists public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  type text not null default 'full_paper',
  status text not null default 'draft' check (status in ('draft', 'ready', 'submitted', 'revision', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manuscript_sections (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  title text not null,
  content_html text not null default '<p></p>',
  status text not null default 'pending' check (status in ('complete', 'active', 'draft', 'pending')),
  sort_order int not null default 0,
  last_edited_by uuid references auth.users(id) on delete set null,
  last_edited_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.manuscript_versions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  version_label text not null,
  snapshot_base64 text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  section_id uuid references public.manuscript_sections(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  quoted_text text,
  resolved boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  citation_type text not null,
  authors text[] not null default '{}',
  title text not null,
  publication_year int,
  doi text,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  manuscript_id uuid references public.manuscripts(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

-- Access helpers
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_org
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.org_role(target_org uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_org
    and om.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_project_access(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = auth.uid()
    left join public.organization_members om on om.organization_id = p.organization_id and om.user_id = auth.uid()
    where p.id = target_project
      and (pm.user_id is not null or om.user_id is not null)
  );
$$;

create or replace function public.can_edit_project(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    left join public.project_members pm on pm.project_id = p.id and pm.user_id = auth.uid()
    left join public.organization_members om on om.organization_id = p.organization_id and om.user_id = auth.uid()
    where p.id = target_project
      and (
        coalesce(pm.can_edit, false)
        or om.role in ('owner', 'admin', 'editor')
      )
  );
$$;

-- Triggers
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_organizations_updated_at on public.organizations;
create trigger trg_organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_journals_updated_at on public.journals;
create trigger trg_journals_updated_at before update on public.journals
for each row execute function public.set_updated_at();

drop trigger if exists trg_manuscripts_updated_at on public.manuscripts;
create trigger trg_manuscripts_updated_at before update on public.manuscripts
for each row execute function public.set_updated_at();

drop trigger if exists trg_manuscript_sections_updated_at on public.manuscript_sections;
create trigger trg_manuscript_sections_updated_at before update on public.manuscript_sections
for each row execute function public.set_updated_at();

drop trigger if exists trg_comments_updated_at on public.comments;
create trigger trg_comments_updated_at before update on public.comments
for each row execute function public.set_updated_at();

drop trigger if exists trg_citations_updated_at on public.citations;
create trigger trg_citations_updated_at before update on public.citations
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.manuscripts enable row level security;
alter table public.manuscript_sections enable row level security;
alter table public.manuscript_versions enable row level security;
alter table public.comments enable row level security;
alter table public.citations enable row level security;
alter table public.activity_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.journals enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select using (auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update using (auth.uid() = id);

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
for select using (public.is_org_member(id));

drop policy if exists organizations_create on public.organizations;
create policy organizations_create on public.organizations
for insert with check (auth.uid() = created_by);

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
for update using (public.org_role(id) in ('owner', 'admin'));

drop policy if exists organization_members_member_select on public.organization_members;
create policy organization_members_member_select on public.organization_members
for select using (public.is_org_member(organization_id));

drop policy if exists organization_members_admin_write on public.organization_members;
create policy organization_members_admin_write on public.organization_members
for all using (public.org_role(organization_id) in ('owner', 'admin'))
with check (public.org_role(organization_id) in ('owner', 'admin'));

drop policy if exists organization_invites_member_select on public.organization_invites;
create policy organization_invites_member_select on public.organization_invites
for select using (public.is_org_member(organization_id));

drop policy if exists organization_invites_admin_write on public.organization_invites;
create policy organization_invites_admin_write on public.organization_invites
for all using (public.org_role(organization_id) in ('owner', 'admin'))
with check (public.org_role(organization_id) in ('owner', 'admin'));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
for select using (public.has_project_access(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
for insert with check (public.org_role(organization_id) in ('owner', 'admin', 'editor'));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
for update using (public.can_edit_project(id));

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
for select using (public.has_project_access(project_id));

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members
for all using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

drop policy if exists manuscripts_select on public.manuscripts;
create policy manuscripts_select on public.manuscripts
for select using (public.has_project_access(project_id));

drop policy if exists manuscripts_write on public.manuscripts;
create policy manuscripts_write on public.manuscripts
for all using (public.can_edit_project(project_id))
with check (public.can_edit_project(project_id));

drop policy if exists manuscript_sections_select on public.manuscript_sections;
create policy manuscript_sections_select on public.manuscript_sections
for select using (
  exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_sections.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists manuscript_sections_write on public.manuscript_sections;
create policy manuscript_sections_write on public.manuscript_sections
for all using (
  exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_sections.manuscript_id
      and public.can_edit_project(m.project_id)
  )
)
with check (
  exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_sections.manuscript_id
      and public.can_edit_project(m.project_id)
  )
);

drop policy if exists manuscript_versions_select on public.manuscript_versions;
create policy manuscript_versions_select on public.manuscript_versions
for select using (
  exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_versions.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists manuscript_versions_write on public.manuscript_versions;
create policy manuscript_versions_write on public.manuscript_versions
for insert with check (
  exists (
    select 1 from public.manuscripts m
    where m.id = manuscript_versions.manuscript_id
      and public.can_edit_project(m.project_id)
  )
);

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
for select using (
  exists (
    select 1 from public.manuscripts m
    where m.id = comments.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments
for all using (
  exists (
    select 1 from public.manuscripts m
    where m.id = comments.manuscript_id
      and public.has_project_access(m.project_id)
  )
)
with check (
  exists (
    select 1 from public.manuscripts m
    where m.id = comments.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists citations_select on public.citations;
create policy citations_select on public.citations
for select using (
  exists (
    select 1
    from public.manuscripts m
    where m.id = citations.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists citations_write on public.citations;
create policy citations_write on public.citations
for all using (
  exists (
    select 1
    from public.manuscripts m
    where m.id = citations.manuscript_id
      and public.can_edit_project(m.project_id)
  )
)
with check (
  exists (
    select 1
    from public.manuscripts m
    where m.id = citations.manuscript_id
      and public.can_edit_project(m.project_id)
  )
);

drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
for select using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
for select using (organization_id is null or public.is_org_member(organization_id));

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications
for select using (auth.uid() = user_id);

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
for update using (auth.uid() = user_id);

drop policy if exists journals_read_all on public.journals;
create policy journals_read_all on public.journals
for select using (true);

