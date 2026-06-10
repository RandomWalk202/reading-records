alter table public.weread_reading_stats
  drop constraint if exists weread_reading_stats_mode_check;

alter table public.weread_reading_stats
  add constraint weread_reading_stats_mode_check
  check (mode in ('weekly', 'monthly', 'annually', 'overall'));
