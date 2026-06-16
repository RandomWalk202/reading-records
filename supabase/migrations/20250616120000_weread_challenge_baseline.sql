alter table public.weread_challenge
  add column if not exists baseline_through_date date;

comment on column public.weread_challenge.baseline_through_date is
  'Days on or before this date are kept from daily_read_seconds; sync only updates later days from WeRead.';
