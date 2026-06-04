-- Keep one review per book.

delete from public.weread_book_reviews old
using public.weread_book_reviews newer
where old.weread_book_id = newer.weread_book_id
  and old.created_at < newer.created_at;

create unique index if not exists weread_book_reviews_book_id_unique
  on public.weread_book_reviews (weread_book_id);
