import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const elements = {
  wereadBookGrid: document.querySelector("#wereadBookGrid"),
  wereadEmptyState: document.querySelector("#wereadEmptyState"),
  wereadCount: document.querySelector("#wereadCount"),
  wereadSearchInput: document.querySelector("#wereadSearchInput"),
};

const WEREAD_OPEN_URL = "weread://reading?bId=";
const WEREAD_HIGHLIGHTS_DISPLAY = 3;

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

function setWereadEmptyState(title, text) {
  elements.wereadEmptyState.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(text)}</p>
  `;
}

async function loadWereadBooks() {
  setWereadEmptyState("正在加载微信读书", "请稍等。");
  elements.wereadEmptyState.classList.add("is-visible");

  const { data: bookRows, error: bookError } = await supabase
    .from("weread_books")
    .select("*")
    .order("read_update_time", { ascending: false, nullsFirst: false });

  if (bookError) {
    setWereadEmptyState("加载失败", bookError.message);
    throw bookError;
  }

  const { data: highlightRows, error: highlightError } = await supabase
    .from("weread_highlights")
    .select("*")
    .order("sort_order", { ascending: true });

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
    ? `<img src="${book.cover_url}" alt="${escapeHtml(book.title)} 的封面" />`
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

loadWereadBooks().catch((error) => {
  console.error(error);
});
