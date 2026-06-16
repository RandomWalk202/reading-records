create table if not exists public.weread_challenge (
  id text primary key,
  start_date date not null,
  end_date date not null,
  target_days integer not null check (target_days > 0),
  target_seconds integer not null check (target_seconds > 0),
  daily_read_seconds jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

alter table public.weread_challenge enable row level security;

create policy "weread_challenge_select"
  on public.weread_challenge
  for select
  using (true);

create policy "weread_challenge_insert"
  on public.weread_challenge
  for insert
  with check (true);

create policy "weread_challenge_update"
  on public.weread_challenge
  for update
  using (true)
  with check (true);
