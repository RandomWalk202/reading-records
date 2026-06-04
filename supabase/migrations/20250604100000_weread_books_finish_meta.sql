alter table public.weread_books
  add column if not exists finish_time timestamptz,
  add column if not exists read_time_seconds integer;
