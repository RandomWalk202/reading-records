import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  wereadBookGrid: document.querySelector("#wereadBookGrid"),
  wereadEmptyState: document.querySelector("#wereadEmptyState"),
  wereadCount: document.querySelector("#wereadCount"),
  wereadSearchInput: document.querySelector("#wereadSearchInput"),
  statsTabs: document.querySelectorAll(".stats-tab"),
  statsEmptyState: document.querySelector("#statsEmptyState"),
  statsBody: document.querySelector("#statsBody"),
  statsSyncedAt: document.querySelector("#statsSyncedAt"),
  statsTotalTime: document.querySelector("#statsTotalTime"),
  statsReadDays: document.querySelector("#statsReadDays"),
  statsDayAverage: document.querySelector("#statsDayAverage"),
  statsCompare: document.querySelector("#statsCompare"),
};

const STATS_MODE_LABELS = {
  weekly: "本周",
  monthly: "本月",
  annually: "今年",
};

let readingStatsByMode = {};
let activeStatsMode = "weekly";

const WEREAD_OPEN_URL = "weread://reading?bId=";
const WEREAD_HIGHLIGHTS_DISPLAY = 3;
const LOADING_LABEL = "正在加载";
const CACHE_KEY = "reading-records-cache-v1";
const BOOK_COLUMNS =
  "weread_book_id,title,author,cover_url,finish_reading,progress,read_update_time";
const HIGHLIGHT_COLUMNS = "weread_book_id,mark_text,sort_order";

let wereadBooks = [];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[char];
  });
}

function formatDurationSeconds(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分钟`;
  }

  if (minutes > 0) {
    return `${minutes} 分钟`;
  }

  return "不足 1 分钟";
}

function formatCompareRatio(compare) {
  const value = Number(compare);
  if (!Number.isFinite(value) || value === 0) {
    return "与上期持平";
  }

  const percent = Math.round(Math.abs(value) * 100);
  return value > 0 ? `较上期 +${percent}%` : `较上期 -${percent}%`;
}

function slimStatsRow(row) {
  const payload = row.payload || {};
  return {
    totalReadTime: payload.totalReadTime,
    readDays: payload.readDays,
    dayAverageReadTime: payload.dayAverageReadTime,
    compare: payload.compare,
    synced_at: row.synced_at,
  };
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.stats && !parsed?.books) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache() {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        stats: readingStatsByMode,
        books: wereadBooks,
      }),
    );
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

function hydrateFromCache(cache) {
  let hydrated = false;

  if (cache.stats && Object.keys(cache.stats).length > 0) {
    readingStatsByMode = cache.stats;
    renderReadingStats();
    hydrated = true;
  }

  if (cache.books?.length) {
    wereadBooks = cache.books;
    renderWereadBooks();
    hydrated = true;
  }

  return hydrated;
}

function showStatsLoading() {
  elements.statsEmptyState.hidden = false;
  elements.statsBody.hidden = true;
  elements.statsEmptyState.innerHTML = `<p>${LOADING_LABEL}</p>`;
  elements.statsSyncedAt.textContent = LOADING_LABEL;
}

function setStatsEmptyMessage(html) {
  elements.statsEmptyState.hidden = false;
  elements.statsBody.hidden = true;
  elements.statsEmptyState.innerHTML = html;
}

function renderReadingStats() {
  const hasAnyStats = Object.keys(readingStatsByMode).length > 0;
  elements.statsEmptyState.hidden = hasAnyStats;
  elements.statsBody.hidden = !hasAnyStats;

  if (!hasAnyStats) {
    elements.statsSyncedAt.textContent = "同步后显示统计";
    setStatsEmptyMessage(
      "<p>还没有阅读统计。运行 <code>node scripts/sync-weread.mjs</code> 同步后即可展示。</p>",
    );
    return;
  }

  const payload = readingStatsByMode[activeStatsMode];
  if (!payload) {
    elements.statsEmptyState.hidden = false;
    elements.statsBody.hidden = true;
    elements.statsSyncedAt.textContent = `${STATS_MODE_LABELS[activeStatsMode]}暂无数据`;
    return;
  }

  const syncedAt = payload.synced_at;
  const syncedLabel = syncedAt
    ? `更新于 ${new Date(syncedAt).toLocaleString("zh-CN", { hour12: false })}`
    : "";
  elements.statsSyncedAt.textContent = `${STATS_MODE_LABELS[activeStatsMode]} · ${syncedLabel}`;

  elements.statsTotalTime.textContent = formatDurationSeconds(payload.totalReadTime);
  elements.statsReadDays.textContent = `${payload.readDays ?? 0} 天`;
  elements.statsDayAverage.textContent = formatDurationSeconds(payload.dayAverageReadTime);

  if (payload.compare !== undefined && payload.compare !== null) {
    elements.statsCompare.hidden = false;
    elements.statsCompare.textContent = formatCompareRatio(payload.compare);
    elements.statsCompare.classList.toggle("is-up", Number(payload.compare) > 0);
    elements.statsCompare.classList.toggle("is-down", Number(payload.compare) < 0);
  } else {
    elements.statsCompare.hidden = true;
    elements.statsCompare.textContent = "";
    elements.statsCompare.classList.remove("is-up", "is-down");
  }
}

async function loadReadingStats() {
  if (!Object.keys(readingStatsByMode).length) {
    showStatsLoading();
  }

  const { data, error } = await supabase.from("weread_reading_stats").select("mode, payload, synced_at");

  if (error) {
    console.error(error);
    elements.statsSyncedAt.textContent = "加载失败";
    setStatsEmptyMessage(`<p>加载失败：${escapeHtml(error.message)}</p>`);
    return;
  }

  readingStatsByMode = {};
  for (const row of data || []) {
    readingStatsByMode[row.mode] = slimStatsRow(row);
  }

  renderReadingStats();
  writeCache();
}

function setActiveStatsMode(mode) {
  activeStatsMode = mode;
  for (const tab of elements.statsTabs) {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }
  renderReadingStats();
}

for (const tab of elements.statsTabs) {
  tab.addEventListener("click", () => setActiveStatsMode(tab.dataset.mode));
}

function showWereadLoading() {
  elements.wereadEmptyState.innerHTML = `<p>${LOADING_LABEL}</p>`;
  elements.wereadEmptyState.classList.add("is-visible");
}

function setWereadEmptyState(title, text) {
  const detail = text
    ? `<p>${escapeHtml(text)}</p>`
    : "";

  elements.wereadEmptyState.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    ${detail}
  `;
}

async function loadWereadBooks() {
  if (!wereadBooks.length) {
    showWereadLoading();
  }

  const [bookResult, highlightResult] = await Promise.all([
    supabase
      .from("weread_books")
      .select(BOOK_COLUMNS)
      .order("read_update_time", { ascending: false, nullsFirst: false }),
    supabase.from("weread_highlights").select(HIGHLIGHT_COLUMNS).order("sort_order", {
      ascending: true,
    }),
  ]);

  const { data: bookRows, error: bookError } = bookResult;
  const { data: highlightRows, error: highlightError } = highlightResult;

  if (bookError) {
    setWereadEmptyState("加载失败", bookError.message);
    throw bookError;
  }

  if (highlightError) {
    setWereadEmptyState("加载失败", highlightError.message);
    throw highlightError;
  }

  const highlightsByBook = {};
  for (const highlight of highlightRows || []) {
    if (!highlightsByBook[highlight.weread_book_id]) {
      highlightsByBook[highlight.weread_book_id] = [];
    }
    highlightsByBook[highlight.weread_book_id].push(highlight);
  }

  wereadBooks = (bookRows || []).map((book) => ({
    ...book,
    highlights: highlightsByBook[book.weread_book_id] || [],
  }));

  renderWereadBooks();
  writeCache();
}

function getFilteredWereadBooks() {
  const keyword = elements.wereadSearchInput.value.trim().toLowerCase();

  if (!keyword) {
    return wereadBooks;
  }

  return wereadBooks.filter((book) => {
    const fields = [
      book.title,
      book.author,
      ...book.highlights.map((item) => item.mark_text),
      ...book.highlights.map((item) => item.chapter_title),
    ];

    return fields.some((value) => String(value ?? "").toLowerCase().includes(keyword));
  });
}

function renderWereadHighlights(highlights) {
  const visible = highlights.slice(0, WEREAD_HIGHLIGHTS_DISPLAY);

  if (!visible.length) {
    return `<p class="weread-no-highlights">暂无划线</p>`;
  }

  const items = visible
    .map(
      (highlight) => `
        <li class="highlight-item">
          <p class="highlight-text">${escapeHtml(highlight.mark_text)}</p>
        </li>
      `,
    )
    .join("");

  return `<ul class="highlight-list">${items}</ul>`;
}

function renderReadingProgress(book) {
  if (book.progress === null || book.progress === undefined) {
    return `<p class="reading-progress-text">阅读进度未知</p>`;
  }

  const value = Math.min(100, Math.max(0, Number(book.progress)));

  return `
    <div class="reading-progress">
      <div class="reading-progress-bar" aria-hidden="true">
        <span style="width: ${value}%"></span>
      </div>
      <p class="reading-progress-text">已读 ${value}%</p>
    </div>
  `;
}

function renderWereadBookCard(book, { showProgress = false, showHighlights = true } = {}) {
  const cover = book.cover_url
    ? `<img src="${book.cover_url}" alt="${escapeHtml(book.title)} 的封面" loading="lazy" decoding="async" />`
    : `<span class="cover-fallback">${escapeHtml(book.title.slice(0, 4))}</span>`;
  const author = book.author || "未填写作者";
  const openUrl = `${WEREAD_OPEN_URL}${encodeURIComponent(book.weread_book_id)}`;
  const progressBlock = showProgress ? renderReadingProgress(book) : "";
  const highlightsBlock = showHighlights ? renderWereadHighlights(book.highlights) : "";

  return `
    <article class="weread-card">
      <div class="weread-cover">${cover}</div>
      <div class="weread-content">
        <div class="weread-meta">
          <h3 class="weread-title">${escapeHtml(book.title)}</h3>
          <p class="weread-author">${escapeHtml(author)}</p>
        </div>
        ${progressBlock}
        ${highlightsBlock}
        <a class="weread-link" href="${openUrl}">在微信读书打开</a>
      </div>
    </article>
  `;
}

function renderWereadShelfGroup(title, books, cardOptions = {}) {
  if (!books.length) {
    return "";
  }

  return `
    <section class="weread-group">
      <h3 class="weread-group-title">${escapeHtml(title)}<span class="weread-group-count">${books.length}</span></h3>
      <div class="weread-list">
        ${books.map((book) => renderWereadBookCard(book, cardOptions)).join("")}
      </div>
    </section>
  `;
}

function classifyWereadBooks(books) {
  const toRead = [];
  const reading = [];
  const finished = [];

  for (const book of books) {
    if (!book.highlights.length) {
      toRead.push(book);
      continue;
    }

    if (book.finish_reading) {
      finished.push(book);
      continue;
    }

    reading.push(book);
  }

  return { toRead, reading, finished };
}

function renderWereadBooks() {
  const filteredBooks = getFilteredWereadBooks();
  const { toRead, reading, finished } = classifyWereadBooks(filteredBooks);

  elements.wereadCount.textContent = `共 ${wereadBooks.length} 本 · 在读 ${reading.length} · 读完 ${finished.length} · 待读 ${toRead.length}`;
  elements.wereadEmptyState.classList.toggle("is-visible", filteredBooks.length === 0);

  if (wereadBooks.length === 0) {
    setWereadEmptyState("还没有同步微信读书", "配置 WEREAD_API_KEY 后运行 node scripts/sync-weread.mjs。");
  } else if (filteredBooks.length === 0) {
    setWereadEmptyState("没有匹配的书籍", "换个关键词再试试。");
  }

  elements.wereadBookGrid.innerHTML =
    filteredBooks.length === 0
      ? ""
      : `
        <div class="weread-shelf">
          ${renderWereadShelfGroup("在读", reading, { showProgress: true, showHighlights: true })}
          ${renderWereadShelfGroup("读完", finished, { showHighlights: true })}
          ${renderWereadShelfGroup("待读", toRead, { showHighlights: false })}
        </div>
      `;
}

elements.wereadSearchInput.addEventListener("input", renderWereadBooks);

const cached = readCache();
if (cached) {
  hydrateFromCache(cached);
}

Promise.all([loadReadingStats(), loadWereadBooks()]).catch((error) => {
  console.error(error);
});
