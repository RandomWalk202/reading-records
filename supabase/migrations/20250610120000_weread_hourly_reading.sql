create table if not exists public.weread_reading_snapshots (
  id bigint generated always as identity primary key,
  synced_at timestamptz not null default now(),
  total_read_seconds integer not null check (total_read_seconds >= 0)
);

create index if not exists weread_reading_snapshots_synced_at_idx
  on public.weread_reading_snapshots (synced_at desc);

create table if not exists public.weread_hourly_reading (
  hour_start timestamptz primary key,
  read_seconds integer not null default 0 check (read_seconds >= 0),
  updated_at timestamptz not null default now()
);

alter table public.weread_reading_snapshots enable row level security;
alter table public.weread_hourly_reading enable row level security;

create policy "weread_reading_snapshots_select"
  on public.weread_reading_snapshots for select using (true);

create policy "weread_reading_snapshots_insert"
  on public.weread_reading_snapshots for insert with check (true);

create policy "weread_hourly_reading_select"
  on public.weread_hourly_reading for select using (true);

create policy "weread_hourly_reading_insert"
  on public.weread_hourly_reading for insert with check (true);

create policy "weread_hourly_reading_update"
  on public.weread_hourly_reading for update using (true) with check (true);
