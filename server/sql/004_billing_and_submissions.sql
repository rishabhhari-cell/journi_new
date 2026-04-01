-- Migration 004: Billing + managed submission tracking

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'unknown',
  current_period_end timestamptz,
  plan_code text not null default 'pro_monthly',
  cancel_at_period_end boolean not null default false,
  latest_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists subscriptions_status_idx on public.subscriptions(status);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists billing_events_event_type_idx on public.billing_events(event_type);

create table if not exists public.journal_submissions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  journal_id uuid not null references public.journals(id) on delete restrict,
  submitted_by uuid references auth.users(id) on delete set null,
  external_portal_url text,
  status text not null default 'submitted'
    check (status in ('draft', 'submitted', 'under_review', 'minor_revision', 'major_revision', 'accepted', 'rejected', 'withdrawn')),
  submitted_at timestamptz,
  decision_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists journal_submissions_manuscript_idx on public.journal_submissions(manuscript_id);
create index if not exists journal_submissions_status_idx on public.journal_submissions(status);
create index if not exists journal_submissions_journal_idx on public.journal_submissions(journal_id);

create table if not exists public.submission_events (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.journal_submissions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists submission_events_submission_idx on public.submission_events(submission_id);
create index if not exists submission_events_created_idx on public.submission_events(created_at);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists trg_journal_submissions_updated_at on public.journal_submissions;
create trigger trg_journal_submissions_updated_at before update on public.journal_submissions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.journal_submissions enable row level security;
alter table public.submission_events enable row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
for select using (auth.uid() = user_id);

drop policy if exists journal_submissions_select on public.journal_submissions;
create policy journal_submissions_select on public.journal_submissions
for select using (
  exists (
    select 1
    from public.manuscripts m
    where m.id = journal_submissions.manuscript_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists journal_submissions_write on public.journal_submissions;
create policy journal_submissions_write on public.journal_submissions
for all using (
  exists (
    select 1
    from public.manuscripts m
    where m.id = journal_submissions.manuscript_id
      and public.can_edit_project(m.project_id)
  )
)
with check (
  exists (
    select 1
    from public.manuscripts m
    where m.id = journal_submissions.manuscript_id
      and public.can_edit_project(m.project_id)
  )
);

drop policy if exists submission_events_select on public.submission_events;
create policy submission_events_select on public.submission_events
for select using (
  exists (
    select 1
    from public.journal_submissions js
    join public.manuscripts m on m.id = js.manuscript_id
    where js.id = submission_events.submission_id
      and public.has_project_access(m.project_id)
  )
);

drop policy if exists submission_events_write on public.submission_events;
create policy submission_events_write on public.submission_events
for all using (
  exists (
    select 1
    from public.journal_submissions js
    join public.manuscripts m on m.id = js.manuscript_id
    where js.id = submission_events.submission_id
      and public.can_edit_project(m.project_id)
  )
)
with check (
  exists (
    select 1
    from public.journal_submissions js
    join public.manuscripts m on m.id = js.manuscript_id
    where js.id = submission_events.submission_id
      and public.can_edit_project(m.project_id)
  )
);

