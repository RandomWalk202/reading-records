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
 *   WEREAD_HIGHLIGHTS_PER_BOOK=20  (0 = sync all highlights per book)
 */

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";
const HIGHLIGHTS_PER_BOOK = Number(process.env.WEREAD_HIGHLIGHTS_PER_BOOK ?? 0);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const wereadApiKey = requireEnv("WEREAD_API_KEY");
const WEREAD_MAX_ATTEMPTS = 4;
const WEREAD_RETRY_BASE_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function weread(apiName, params = {}) {
  let lastError;

  for (let attempt = 1; attempt <= WEREAD_MAX_ATTEMPTS; attempt += 1) {
    try {
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

      const text = await response.text();
      if (!text.trim()) {
        throw new Error(
          `WeRead API empty response: ${apiName} (HTTP ${response.status})`,
        );
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error(
          `WeRead API invalid JSON: ${apiName} (HTTP ${response.status}): ${error.message}`,
        );
      }

      if (!response.ok) {
        throw new Error(
          `WeRead API HTTP ${response.status}: ${apiName} ${data.errmsg || text.slice(0, 200)}`,
        );
      }

      if (data.errcode && data.errcode !== 0) {
        throw new Error(data.errmsg || `WeRead API error: ${apiName}`);
      }

      return data;
    } catch (error) {
      lastError = error;
      if (attempt >= WEREAD_MAX_ATTEMPTS) {
        break;
      }

      const waitMs = WEREAD_RETRY_BASE_MS * attempt;
      console.warn(
        `Retry ${attempt}/${WEREAD_MAX_ATTEMPTS - 1} for ${apiName} in ${waitMs}ms: ${error.message}`,
      );
      await sleep(waitMs);
    }
  }

  throw lastError;
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
  const sorted = (data.updated || [])
    .filter((item) => item.markText?.trim())
    .sort((a, b) => Number(b.createTime || 0) - Number(a.createTime || 0));

  const capped =
    HIGHLIGHTS_PER_BOOK > 0 ? sorted.slice(0, HIGHLIGHTS_PER_BOOK) : sorted;

  const highlights = capped.map((item, index) => ({
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

async function listStoredBookIds() {
  const rows = await supabaseRequest("weread_books", {
    query: { select: "weread_book_id,title" },
  });

  return rows || [];
}

function postgrestInFilter(bookIds) {
  return `in.(${bookIds.map((id) => `"${id}"`).join(",")})`;
}

async function deleteByBookIds(table, bookIds) {
  if (!bookIds.length) {
    return;
  }

  const CHUNK_SIZE = 50;
  for (let index = 0; index < bookIds.length; index += CHUNK_SIZE) {
    const chunk = bookIds.slice(index, index + CHUNK_SIZE);
    await supabaseRequest(table, {
      method: "DELETE",
      query: { weread_book_id: postgrestInFilter(chunk) },
    });
  }
}

async function removeBooksNotOnShelf(shelfBookIds) {
  const shelfSet = new Set(shelfBookIds.map(String));
  const storedBooks = await listStoredBookIds();
  const removedBooks = storedBooks.filter((book) => !shelfSet.has(String(book.weread_book_id)));

  if (!removedBooks.length) {
    console.log("No off-shelf books to remove.");
    return 0;
  }

  const removedIds = removedBooks.map((book) => book.weread_book_id);
  console.log(
    `Removing ${removedBooks.length} book(s) no longer on WeRead shelf: ${removedBooks
      .map((book) => book.title || book.weread_book_id)
      .join(", ")}`,
  );

  await deleteByBookIds("weread_highlights", removedIds);
  await deleteByBookIds("weread_book_reviews", removedIds);
  await deleteByBookIds("weread_books", removedIds);

  return removedBooks.length;
}

async function main() {
  console.log("Fetching WeRead shelf...");
  const shelf = await weread("/shelf/sync");
  const books = shelf.books || [];
  const shelfBookIds = books.map((book) => String(book.bookId));

  await removeBooksNotOnShelf(shelfBookIds);

  if (books.length === 0) {
    console.log("No books found on shelf.");
    await syncReadingStats();
    await syncChallengeProgress();
    return;
  }

  console.log(`Synced ${books.length} books from shelf.`);

  let totalHighlights = 0;
  for (const [index, book] of books.entries()) {
    let progress = null;
    let finishTime = null;
    let readTimeSeconds = null;

    try {
      const progressData = await weread("/book/getprogress", { bookId: book.bookId });
      const bookProgress = progressData.book || {};
      const rawProgress = bookProgress.progress;

      if (rawProgress !== undefined && rawProgress !== null) {
        progress = Number(rawProgress);
      }

      const rawReadTime = bookProgress.readingTime ?? bookProgress.recordReadingTime;
      if (rawReadTime !== undefined && rawReadTime !== null) {
        readTimeSeconds = Math.max(0, Number(rawReadTime));
      }

      if (bookProgress.finishTime) {
        finishTime = toIsoTime(bookProgress.finishTime);
      }
    } catch {
      progress = null;
      finishTime = null;
      readTimeSeconds = null;
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
          finish_time: finishReading ? finishTime : null,
          read_time_seconds: readTimeSeconds,
          read_update_time: toIsoTime(book.readUpdateTime),
          synced_at: new Date().toISOString(),
        },
      ],
    });

    const highlightCount = await syncBookHighlights(book.bookId);
    totalHighlights += highlightCount;

    const progressLabel = progress === null ? "进度未知" : `${progress}%`;
    console.log(
      `[${index + 1}/${books.length}] ${book.title} — ${highlightCount} highlights, ${progressLabel}`,
    );
  }

  console.log(`Done. ${books.length} books, ${totalHighlights} highlights.`);

  await syncReadingStats();
  await syncChallengeProgress();
}

const CHALLENGE = {
  id: "weread-30d-202606",
  startDate: "2026-07-13",
  endDate: "2026-08-11",
  targetDays: 30,
  targetSeconds: 30 * 3600,
  // Frozen through this date (inclusive). Earlier days stay in daily_read_seconds;
  // today and later are filled from WeRead on each sync.
  baselineThroughDate: "2026-07-14",
};

async function fetchChallengeRow() {
  const rows = await supabaseRequest("weread_challenge", {
    query: {
      select: "daily_read_seconds,baseline_through_date",
      id: `eq.${CHALLENGE.id}`,
    },
  });

  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

function isOnOrBeforeBaseline(dateStr, baselineThroughDate) {
  return Boolean(baselineThroughDate) && dateStr <= baselineThroughDate;
}

function shanghaiDayStartSec(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+08:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function lookupDailyReadSeconds(readTimes, dayStartSec) {
  const raw = readTimes?.[dayStartSec] ?? readTimes?.[String(dayStartSec)];
  return Math.max(0, Number(raw) || 0);
}

function monthsOverlappingRange(startDate, endDate) {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);
  const months = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({
      year,
      month,
      baseTime: shanghaiDayStartSec(year, month, 1),
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

async function syncChallengeProgress() {
  const { id, startDate, endDate, targetDays, targetSeconds } = CHALLENGE;
  const existing = await fetchChallengeRow();
  const baselineThroughDate =
    existing?.baseline_through_date ?? CHALLENGE.baselineThroughDate ?? null;
  const incrementalOnly = Boolean(baselineThroughDate);

  console.log(
    incrementalOnly
      ? `Fetching challenge data (baseline through ${baselineThroughDate}, incremental sync)...`
      : "Fetching challenge reading data...",
  );

  const dailyReadSeconds = incrementalOnly
    ? { ...(existing?.daily_read_seconds || {}) }
    : {};

  for (const { year, month, baseTime } of monthsOverlappingRange(startDate, endDate)) {
    const payload = await weread("/readdata/detail", { mode: "monthly", baseTime });
    const readTimes = payload.readTimes || {};
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (dateStr < startDate || dateStr > endDate) {
        continue;
      }

      if (isOnOrBeforeBaseline(dateStr, baselineThroughDate)) {
        continue;
      }

      const seconds = lookupDailyReadSeconds(readTimes, shanghaiDayStartSec(year, month, day));
      if (seconds > 0) {
        dailyReadSeconds[dateStr] = seconds;
      } else {
        delete dailyReadSeconds[dateStr];
      }
    }
  }

  for (const dateStr of Object.keys(dailyReadSeconds)) {
    if (dateStr < startDate || dateStr > endDate) {
      delete dailyReadSeconds[dateStr];
    }
  }

  await supabaseRequest("weread_challenge", {
    method: "POST",
    query: { on_conflict: "id" },
    body: [
      {
        id,
        start_date: startDate,
        end_date: endDate,
        target_days: targetDays,
        target_seconds: targetSeconds,
        baseline_through_date: baselineThroughDate,
        daily_read_seconds: dailyReadSeconds,
        synced_at: new Date().toISOString(),
      },
    ],
  });

  const readDays = Object.values(dailyReadSeconds).filter((seconds) => seconds >= 60).length;
  const totalSeconds = Object.values(dailyReadSeconds).reduce((sum, seconds) => sum + seconds, 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  console.log(
    `  challenge: ${readDays}/${targetDays} days, ${hours}h ${minutes}m (${Object.keys(dailyReadSeconds).length} active days synced)`,
  );
  console.log("Challenge progress synced.");
}

const READING_STAT_MODES = ["weekly", "monthly", "annually", "overall"];

async function syncReadingStats() {
  console.log("Fetching reading stats...");

  for (const mode of READING_STAT_MODES) {
    const payload = await weread("/readdata/detail", { mode });

    await supabaseRequest("weread_reading_stats", {
      method: "POST",
      query: { on_conflict: "mode" },
      body: [
        {
          mode,
          payload,
          synced_at: new Date().toISOString(),
        },
      ],
    });
    const hours = Math.floor(Number(payload.totalReadTime || 0) / 3600);
    const minutes = Math.floor((Number(payload.totalReadTime || 0) % 3600) / 60);
    console.log(`  ${mode}: ${hours}h ${minutes}m, ${payload.readDays ?? 0} read days`);
  }
  console.log("Reading stats synced.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
