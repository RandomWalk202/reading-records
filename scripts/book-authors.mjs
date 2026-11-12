const AUTHOR_BY_BOOK_ID = {
  CB_55cFHMFGvCB977L75M1ZN5pA: "刘勃",
  CB_9It9ZP9XTAJD77175M90SGpN: "刘勃",
};

const AUTHOR_BY_TITLE = {
  战国歧途: "刘勃",
  失败者的春秋: "刘勃",
};

function isPlaceholderAuthor(author) {
  const value = String(author || "").trim().toLowerCase();
  return value === "" || value === "administrator" || value === "admin";
}

export function resolveBookAuthor(book) {
  const raw = String(book.author || "").trim();
  if (!isPlaceholderAuthor(raw)) {
    return raw;
  }

  const bookId = String(book.weread_book_id || book.bookId || "");
  if (AUTHOR_BY_BOOK_ID[bookId]) {
    return AUTHOR_BY_BOOK_ID[bookId];
  }

  const title = String(book.title || "").trim();
  return AUTHOR_BY_TITLE[title] || raw;
}
