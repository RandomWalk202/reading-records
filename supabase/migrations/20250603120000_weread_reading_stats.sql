create table if not exists public.weread_reading_stats (
  mode text primary key check (mode in ('weekly', 'monthly', 'annually')),
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

alter table public.weread_reading_stats enable row level security;

create policy "weread_reading_stats_select"
  on public.weread_reading_stats
  for select
  using (true);

create policy "weread_reading_stats_insert"
  on public.weread_reading_stats
  for insert
  with check (true);

create policy "weread_reading_stats_update"
  on public.weread_reading_stats
  for update
  using (true)
  with check (true);
