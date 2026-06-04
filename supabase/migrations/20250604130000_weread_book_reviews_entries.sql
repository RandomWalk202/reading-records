-- One book can have many review entries; each save creates a new row.

alter table public.weread_book_reviews
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists created_at timestamptz;

update public.weread_book_reviews
set
  id = coalesce(id, gen_random_uuid()),
  created_at = coalesce(created_at, updated_at, now())
where id is null or created_at is null;

alter table public.weread_book_reviews
  alter column id set not null,
  alter column created_at set not null,
  alter column created_at set default now();

alter table public.weread_book_reviews
  drop constraint if exists weread_book_reviews_pkey;

alter table public.weread_book_reviews
  add constraint weread_book_reviews_pkey primary key (id);

create index if not exists weread_book_reviews_book_created_idx
  on public.weread_book_reviews (weread_book_id, created_at desc);
