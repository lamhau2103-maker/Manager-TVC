-- ============================================================================
-- THAI VIET CORPORATION — Fleet Maintenance Real-Time Sync Schema (Supabase)
-- Run this script ONCE in Supabase Dashboard -> SQL Editor.
-- Safe to re-run (fully idempotent).
-- ============================================================================

create table if not exists public.fleet_sync_state (
  id text primary key default 'primary',
  version bigint not null default 1,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Enable full row payloads for Supabase Realtime postgres_changes
alter table public.fleet_sync_state replica identity full;

-- Enforce Row Level Security: ONLY authenticated Supabase users may read/write
alter table public.fleet_sync_state enable row level security;

revoke all on table public.fleet_sync_state from anon;
grant select, insert, update on table public.fleet_sync_state to authenticated;

drop policy if exists "fleet_sync_authenticated_select" on public.fleet_sync_state;
create policy "fleet_sync_authenticated_select"
  on public.fleet_sync_state
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "fleet_sync_authenticated_insert" on public.fleet_sync_state;
create policy "fleet_sync_authenticated_insert"
  on public.fleet_sync_state
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "fleet_sync_authenticated_update" on public.fleet_sync_state;
create policy "fleet_sync_authenticated_update"
  on public.fleet_sync_state
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Register table with Supabase Realtime publication (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fleet_sync_state'
  ) then
    alter publication supabase_realtime add table public.fleet_sync_state;
  end if;
end
$$;
