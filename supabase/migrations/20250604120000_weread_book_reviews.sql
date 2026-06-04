create table if not exists public.weread_book_reviews (
  weread_book_id text primary key,
  review_text text not null,
  updated_at timestamptz not null default now()
);

alter table public.weread_book_reviews enable row level security;

create policy "Allow public read weread book reviews"
  on public.weread_book_reviews for select to anon, authenticated using (true);

create policy "Allow public insert weread book reviews"
  on public.weread_book_reviews for insert to anon, authenticated with check (true);

create policy "Allow public update weread book reviews"
  on public.weread_book_reviews for update to anon, authenticated using (true) with check (true);

create policy "Allow public delete weread book reviews"
  on public.weread_book_reviews for delete to anon, authenticated using (true);
