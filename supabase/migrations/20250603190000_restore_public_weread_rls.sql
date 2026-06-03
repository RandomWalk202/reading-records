-- Restore public read/write policies (revert lock_down_weread_rls).

drop policy if exists "authenticated_select_weread_books" on public.weread_books;
drop policy if exists "authenticated_select_weread_highlights" on public.weread_highlights;
drop policy if exists "authenticated_select_weread_reading_stats" on public.weread_reading_stats;

create policy "Allow public read weread books"
  on public.weread_books for select to anon, authenticated using (true);

create policy "Allow public insert weread books"
  on public.weread_books for insert to anon, authenticated with check (true);

create policy "Allow public update weread books"
  on public.weread_books for update to anon, authenticated using (true) with check (true);

create policy "Allow public delete weread books"
  on public.weread_books for delete to anon, authenticated using (true);

create policy "Allow public read weread highlights"
  on public.weread_highlights for select to anon, authenticated using (true);

create policy "Allow public insert weread highlights"
  on public.weread_highlights for insert to anon, authenticated with check (true);

create policy "Allow public update weread highlights"
  on public.weread_highlights for update to anon, authenticated using (true) with check (true);

create policy "Allow public delete weread highlights"
  on public.weread_highlights for delete to anon, authenticated using (true);

create policy "weread_reading_stats_select"
  on public.weread_reading_stats for select using (true);

create policy "weread_reading_stats_insert"
  on public.weread_reading_stats for insert with check (true);

create policy "weread_reading_stats_update"
  on public.weread_reading_stats for update using (true) with check (true);
