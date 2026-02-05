create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  revealed boolean not null default false
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  participant_id text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, participant_id)
);

create index if not exists votes_session_id_idx on public.votes(session_id);

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
