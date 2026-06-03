/**
 * Sync WeRead shelf + highlights into Supabase.
 *
 * Usage:
 *   export WEREAD_API_KEY=wrk-...
 *   node scripts/sync-weread.mjs
 *
 * Optional env:
 *   SUPABASE_URL (defaults to project URL in app.js)
 *   SUPABASE_PUBLISHABLE_KEY
 *   WEREAD_HIGHLIGHTS_PER_BOOK=5
 */

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";
const HIGHLIGHTS_PER_BOOK = Number(process.env.WEREAD_HIGHLIGHTS_PER_BOOK || 3);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const wereadApiKey = requireEnv("WEREAD_API_KEY");

async function weread(apiName, params = {}) {
  const response = await fetch(WEREAD_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${wereadApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_name: apiName,
      skill_version: SKILL_VERSION,
      ...params,
    }),
  });

  const data = await response.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(data.errmsg || `WeRead API error: ${apiName}`);
  }

  return data;
}

async function supabaseRequest(path, { method = "GET", body, query } = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${method} ${path}: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function toIsoTime(unixSeconds) {
  if (!unixSeconds) {
    return null;
  }
  return new Date(Number(unixSeconds) * 1000).toISOString();
}

function chapterTitleForHighlight(chapters, chapterUid) {
  const chapter = (chapters || []).find((item) => item.chapterUid === chapterUid);
  return chapter?.title || "";
}

async function syncBookHighlights(bookId) {
  const data = await weread("/book/bookmarklist", { bookId });
  const highlights = (data.updated || [])
    .filter((item) => item.markText?.trim())
    .sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0))
    .slice(0, HIGHLIGHTS_PER_BOOK)
    .map((item, index) => ({
      weread_book_id: bookId,
      bookmark_id: String(item.bookmarkId),
      mark_text: item.markText.trim(),
      chapter_title: chapterTitleForHighlight(data.chapters, item.chapterUid),
      highlight_time: toIsoTime(item.createTime),
      sort_order: index,
    }));

  await supabaseRequest("weread_highlights", {
    method: "DELETE",
    query: { weread_book_id: `eq.${bookId}` },
  });

  if (highlights.length > 0) {
    await supabaseRequest("weread_highlights", {
      method: "POST",
      body: highlights,
    });
  }

  return highlights.length;
}

async function main() {
  console.log("Fetching WeRead shelf...");
  const shelf = await weread("/shelf/sync");
  const books = shelf.books || [];

  if (books.length === 0) {
    console.log("No books found on shelf.");
    return;
  }

  console.log(`Synced ${books.length} books from shelf.`);

  let totalHighlights = 0;
  for (const [index, book] of books.entries()) {
    const highlightCount = await syncBookHighlights(book.bookId);
    totalHighlights += highlightCount;

    let progress = null;
    try {
      const progressData = await weread("/book/getprogress", { bookId: book.bookId });
      const rawProgress = progressData.book?.progress;
      if (rawProgress !== undefined && rawProgress !== null) {
        progress = Number(rawProgress);
      }
    } catch {
      progress = null;
    }

    const finishReading = book.finishReading === 1 || progress === 100;

    await supabaseRequest("weread_books", {
      method: "POST",
      query: { on_conflict: "weread_book_id" },
      body: [
        {
          weread_book_id: book.bookId,
          title: book.title?.trim() || "未命名书籍",
          author: book.author?.trim() || "",
          cover_url: book.cover || null,
          finish_reading: finishReading,
          progress,
          read_update_time: toIsoTime(book.readUpdateTime),
          synced_at: new Date().toISOString(),
        },
      ],
    });

    const progressLabel = progress === null ? "进度未知" : `${progress}%`;
    console.log(
      `[${index + 1}/${books.length}] ${book.title} — ${highlightCount} highlights, ${progressLabel}`,
    );
  }

  console.log(`Done. ${books.length} books, ${totalHighlights} highlights.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
