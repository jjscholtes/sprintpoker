create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  revealed boolean not null default false,
  deadlock_count smallint not null default 0,
  devils_advocate_active boolean not null default false,
  devils_advocate_participant_id text,
  devils_advocate_name text,
  devils_advocate_value text,
  devils_advocate_side text,
  devils_advocate_started_at timestamptz,
  devils_advocate_duration_sec integer
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  participant_id text not null,
  value text not null,
  confidence smallint not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create index if not exists votes_session_id_idx on public.votes(session_id);

alter table public.sessions
  add column if not exists deadlock_count smallint not null default 0;
alter table public.sessions
  add column if not exists devils_advocate_active boolean not null default false;
alter table public.sessions
  add column if not exists devils_advocate_participant_id text;
alter table public.sessions
  add column if not exists devils_advocate_name text;
alter table public.sessions
  add column if not exists devils_advocate_value text;
alter table public.sessions
  add column if not exists devils_advocate_side text;
alter table public.sessions
  add column if not exists devils_advocate_started_at timestamptz;
alter table public.sessions
  add column if not exists devils_advocate_duration_sec integer;

alter table public.votes
  add column if not exists confidence smallint not null default 50;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_votes_updated_at on public.votes;
create trigger set_votes_updated_at
before update on public.votes
for each row execute function public.set_updated_at();

alter table public.sessions enable row level security;
alter table public.votes enable row level security;

create policy "Public read sessions"
  on public.sessions for select
  using (true);

create policy "Public insert sessions"
  on public.sessions for insert
  with check (true);

create policy "Public update sessions"
  on public.sessions for update
  using (true) with check (true);

create policy "Public delete sessions"
  on public.sessions for delete
  using (true);

create policy "Public read votes"
  on public.votes for select
  using (true);

create policy "Public insert votes"
  on public.votes for insert
  with check (true);

create policy "Public update votes"
  on public.votes for update
  using (true) with check (true);

create policy "Public delete votes"
  on public.votes for delete
  using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'votes'
  ) then
    alter publication supabase_realtime add table public.votes;
  end if;
end;
$$;

create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;
