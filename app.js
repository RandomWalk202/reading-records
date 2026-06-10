const SUPABASE_URL = "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";

const REST_HEADERS = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
};

function restOrder(column, { ascending = true, nullsFirst = true } = {}) {
  const dir = ascending ? "asc" : "desc";
  const nulls = nullsFirst ? "nullsfirst" : "nullslast";
  return `${column}.${dir}.${nulls}`;
}

async function restSelect(table, { select, order, filter } = {}) {
  const params = new URLSearchParams({ select });
  const orders = order ? (Array.isArray(order) ? order : [order]) : [];

  for (const item of orders) {
    params.append("order", item);
  }

  if (filter) {
    for (const [key, value] of Object.entries(filter)) {
      params.set(key, value);
    }
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: REST_HEADERS,
  });

  if (!res.ok) {
    const detail = await res.text();
    return { data: null, error: { message: detail || res.statusText } };
  }

  return { data: await res.json(), error: null };
}

async function restInsert(table, rows, { returning = false, single = false } = {}) {
  const headers = {
    ...REST_HEADERS,
    "Content-Type": "application/json",
    Prefer: returning ? "return=representation" : "return=minimal",
  };

  if (single) {
    headers.Accept = "application/vnd.pgrst.object+json";
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { data: null, error: { message: detail || res.statusText } };
  }

  if (!returning) {
    return { data: null, error: null };
  }

  return { data: await res.json(), error: null };
}

async function restUpdate(table, body, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      Accept: "application/vnd.pgrst.object+json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { data: null, error: { message: detail || res.statusText } };
  }

  return { data: await res.json(), error: null };
}

async function restDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: REST_HEADERS,
  });

  if (!res.ok) {
    const detail = await res.text();
    return { error: { message: detail || res.statusText } };
  }

  return { error: null };
}

const elements = {
  wereadBookGrid: document.querySelector("#wereadBookGrid"),
  wereadEmptyState: document.querySelector("#wereadEmptyState"),
  wereadSearchInput: document.querySelector("#wereadSearchInput"),
  shelfTabs: document.querySelectorAll(".shelf-tab"),
  statsTabs: document.querySelectorAll(".stats-tab"),
  statsEmptyState: document.querySelector("#statsEmptyState"),
  statsBody: document.querySelector("#statsBody"),
  statsSyncedAt: document.querySelector("#statsSyncedAt"),
  statsTotalTime: document.querySelector("#statsTotalTime"),
  statsReadDays: document.querySelector("#statsReadDays"),
  statsDayAverage: document.querySelector("#statsDayAverage"),
  statsCompare: document.querySelector("#statsCompare"),
  statsDailyChartSection: document.querySelector("#statsDailyChartSection"),
  statsDailyChartBars: document.querySelector("#statsDailyChartBars"),
  statsChartTooltip: document.querySelector("#statsChartTooltip"),
  statsHourChartSection: document.querySelector("#statsHourChartSection"),
  statsHourChartInner: document.querySelector("#statsHourChartInner"),
  statsHourChartBars: document.querySelector("#statsHourChartBars"),
  statsHourChartTooltip: document.querySelector("#statsHourChartTooltip"),
  reviewDialog: document.querySelector("#reviewDialog"),
  reviewForm: document.querySelector("#reviewForm"),
  reviewDialogTitle: document.querySelector("#reviewDialogTitle"),
  reviewDialogAuthor: document.querySelector("#reviewDialogAuthor"),
  reviewDialogText: document.querySelector("#reviewDialogText"),
  reviewDialogStatus: document.querySelector("#reviewDialogStatus"),
  reviewDialogClose: document.querySelector("#reviewDialogClose"),
  reviewDialogCancel: document.querySelector("#reviewDialogCancel"),
  reviewDialogSave: document.querySelector("#reviewDialogSave"),
  reviewDialogView: document.querySelector("#reviewDialogView"),
  reviewDialogCompose: document.querySelector("#reviewDialogCompose"),
  reviewDialogDate: document.querySelector("#reviewDialogDate"),
  reviewDialogSavedText: document.querySelector("#reviewDialogSavedText"),
  reviewDialogEdit: document.querySelector("#reviewDialogEdit"),
  reviewDialogDelete: document.querySelector("#reviewDialogDelete"),
  highlightsDialog: document.querySelector("#highlightsDialog"),
  highlightsDialogTitle: document.querySelector("#highlightsDialogTitle"),
  highlightsDialogAuthor: document.querySelector("#highlightsDialogAuthor"),
  highlightsDialogList: document.querySelector("#highlightsDialogList"),
  highlightsDialogClose: document.querySelector("#highlightsDialogClose"),
};

const STATS_MODE_LABELS = {
  weekly: "本周",
  monthly: "本月",
  annually: "今年",
};

let readingStatsByMode = {};
let hourlyReadingRows = [];
let activeStatsMode = "weekly";
let selectedDistributionBucket = null;

const WEREAD_OPEN_URL = "weread://reading?bId=";
const WEREAD_HIGHLIGHTS_DISPLAY = 2;
const LOADING_LABEL = "正在加载";
const CACHE_KEY = "reading-records-cache-v6";
const SHANGHAI_TZ = "Asia/Shanghai";
const CACHE_LEGACY_KEY = "reading-records-cache-v3";
const REVIEWS_STORAGE_KEY = "reading-records.book-reviews-v1";
const REVIEWS_MIGRATED_KEY = "reading-records.book-reviews-migrated-v1";
const REVIEW_COLUMNS = "id,weread_book_id,review_text,created_at";
const MIN_READ_DAY_SECONDS = 60;

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DAY_MS = 86400000;
const MONTHLY_TICK_INTERVAL = 5;
const HOURLY_BUCKET_COUNT = 24;
const HOURLY_TICK_INTERVAL = 3;
const PREFER_TIME_START_HOUR = 6;
const BOOK_COLUMNS =
  "weread_book_id,title,author,cover_url,finish_reading,progress,finish_time,read_time_seconds,read_update_time";
const HIGHLIGHT_COLUMNS = "weread_book_id,mark_text,sort_order";

let wereadBooks = [];
let activeShelfTab = "reading";
let activeReviewBookId = null;
let bookReviewsById = {};
let reviewDialogMode = "edit";

const SHELF_TAB_LABELS = {
  reading: "在读",
  finished: "读完",
  toRead: "想读",
};

const SHELF_CARD_OPTIONS = {
  reading: { showProgress: true, showHighlights: true },
  finished: { showHighlights: true, showFinishedMeta: true },
  toRead: { showHighlights: false },
};

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

function formatShortDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分`;
  }

  if (minutes > 0) {
    return `${minutes} 分钟`;
  }

  if (total > 0) {
    return "不足 1 分钟";
  }

  return "未阅读";
}

function lookupReadSeconds(readTimes, timestampMs) {
  const keySec = Math.floor(timestampMs / 1000);
  const raw = readTimes?.[keySec] ?? readTimes?.[String(keySec)];
  return Math.max(0, Number(raw) || 0);
}

function buildChartBuckets(payload, mode) {
  const baseTime = Number(payload?.baseTime || 0);
  const readTimes = payload?.readTimes;

  if (!baseTime || !readTimes || typeof readTimes !== "object") {
    return [];
  }

  if (mode === "weekly") {
    const weekStartMs = baseTime * 1000;
    return WEEKDAY_LABELS.map((weekday, index) => {
      const timestamp = weekStartMs + index * DAY_MS;
      return {
        timestamp,
        seconds: lookupReadSeconds(readTimes, timestamp),
        label: `周${weekday}`,
      };
    });
  }

  if (mode === "monthly") {
    const monthStart = new Date(baseTime * 1000);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const showTick = day % MONTHLY_TICK_INTERVAL === 0;

      return {
        timestamp: date.getTime(),
        seconds: lookupReadSeconds(readTimes, date.getTime()),
        label: showTick ? String(day) : "",
      };
    });
  }

  if (mode === "annually") {
    const year = new Date(baseTime * 1000).getFullYear();
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const date = new Date(year, monthIndex, 1);
      date.setHours(0, 0, 0, 0);
      return {
        timestamp: date.getTime(),
        seconds: lookupReadSeconds(readTimes, date.getTime()),
        label: `${monthIndex + 1}月`,
      };
    });
  }

  return [];
}

function shanghaiFormatParts(date, extraOptions = {}) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...extraOptions,
  }).formatToParts(date);
}

function pickShanghaiPart(parts, type) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function getShanghaiHour(date = new Date()) {
  const parts = shanghaiFormatParts(date, { hour: "2-digit", hour12: false });
  return Number(pickShanghaiPart(parts, "hour"));
}

function getShanghaiDayKey(date = new Date()) {
  const parts = shanghaiFormatParts(date);
  return `${pickShanghaiPart(parts, "year")}-${pickShanghaiPart(parts, "month")}-${pickShanghaiPart(parts, "day")}`;
}

function getShanghaiMonthKey(date = new Date()) {
  const parts = shanghaiFormatParts(date);
  return `${pickShanghaiPart(parts, "year")}-${pickShanghaiPart(parts, "month")}`;
}

function formatDistributionBucketLabel(timestampMs, mode) {
  if (mode === "weekly") {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: SHANGHAI_TZ,
      weekday: "short",
    }).format(new Date(timestampMs));
  }

  if (mode === "monthly") {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: SHANGHAI_TZ,
      month: "long",
      day: "numeric",
    }).format(new Date(timestampMs));
  }

  if (mode === "annually") {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: SHANGHAI_TZ,
      month: "long",
    }).format(new Date(timestampMs));
  }

  return "";
}

function createEmptyHourBuckets() {
  return Array.from({ length: HOURLY_BUCKET_COUNT }, (_, hour) => {
    const endHour = (hour + 1) % HOURLY_BUCKET_COUNT;
    return {
      hour,
      seconds: 0,
      label: hour % HOURLY_TICK_INTERVAL === 0 ? String(hour) : "",
      rangeLabel: `${hour}点–${endHour}点`,
    };
  });
}

function getPeriodStartIso(mode) {
  const parts = shanghaiFormatParts(new Date());
  const year = pickShanghaiPart(parts, "year");
  const month = pickShanghaiPart(parts, "month");
  const day = Number(pickShanghaiPart(parts, "day"));
  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    weekday: "short",
  }).format(new Date());
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const weekday = weekdayMap[weekdayLabel] ?? 0;
  const pad = (value) => String(value).padStart(2, "0");
  const anchor = new Date(`${year}-${month}-${pad(day)}T12:00:00+08:00`);

  if (mode === "weekly") {
    anchor.setDate(anchor.getDate() - weekday);
  } else if (mode === "monthly") {
    anchor.setDate(1);
  } else if (mode === "annually") {
    anchor.setMonth(0, 1);
  }

  return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}T00:00:00+08:00`;
}

function getHourlyQueryStartIso() {
  const parts = shanghaiFormatParts(new Date());
  const year = pickShanghaiPart(parts, "year");
  const month = pickShanghaiPart(parts, "month");
  const day = Number(pickShanghaiPart(parts, "day"));
  const pad = (value) => String(value).padStart(2, "0");
  const anchor = new Date(`${year}-${month}-${pad(day)}T12:00:00+08:00`);
  anchor.setDate(anchor.getDate() - 400);
  return `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}T00:00:00+08:00`;
}

function preferTimeIndexForHour(hour) {
  return (hour - PREFER_TIME_START_HOUR + HOURLY_BUCKET_COUNT) % HOURLY_BUCKET_COUNT;
}

function buildHourChartBuckets(preferTime) {
  if (!Array.isArray(preferTime) || preferTime.length !== HOURLY_BUCKET_COUNT) {
    return [];
  }

  return Array.from({ length: HOURLY_BUCKET_COUNT }, (_, hour) => {
    const seconds = Math.max(0, Number(preferTime[preferTimeIndexForHour(hour)]) || 0);
    const endHour = (hour + 1) % HOURLY_BUCKET_COUNT;
    const rangeLabel = `${hour}点–${endHour}点`;

    return {
      hour,
      seconds,
      label: hour % HOURLY_TICK_INTERVAL === 0 ? String(hour) : "",
      rangeLabel,
    };
  });
}

function resolvePreferTime(mode) {
  const payload = readingStatsByMode[mode];
  if (payload?.preferTime?.length === HOURLY_BUCKET_COUNT) {
    return {
      preferTime: payload.preferTime,
      preferTimeWord: payload.preferTimeWord,
      sourceLabel: STATS_MODE_LABELS[mode] || mode,
      isFallback: false,
    };
  }

  const overall = readingStatsByMode.overall;
  if (overall?.preferTime?.length === HOURLY_BUCKET_COUNT) {
    return {
      preferTime: overall.preferTime,
      preferTimeWord: overall.preferTimeWord,
      sourceLabel: "累计",
      isFallback: mode !== "overall",
    };
  }

  return null;
}

function buildTrackedHourBuckets(mode) {
  const periodStartMs = new Date(getPeriodStartIso(mode)).getTime();
  const buckets = createEmptyHourBuckets();

  for (const row of hourlyReadingRows) {
    const rowMs = new Date(row.hour_start).getTime();
    if (rowMs < periodStartMs) {
      continue;
    }

    const hour = getShanghaiHour(new Date(row.hour_start));
    buckets[hour].seconds += Math.max(0, Number(row.read_seconds || 0));
  }

  return buckets;
}

function buildTrackedHourBucketsForSelection(selection) {
  const buckets = createEmptyHourBuckets();
  const { timestamp, mode } = selection;
  const dayKey = getShanghaiDayKey(new Date(timestamp));
  const monthKey = getShanghaiMonthKey(new Date(timestamp));

  for (const row of hourlyReadingRows) {
    const rowDate = new Date(row.hour_start);

    if (mode === "annually") {
      if (getShanghaiMonthKey(rowDate) !== monthKey) {
        continue;
      }
    } else if (getShanghaiDayKey(rowDate) !== dayKey) {
      continue;
    }

    const hour = getShanghaiHour(rowDate);
    buckets[hour].seconds += Math.max(0, Number(row.read_seconds || 0));
  }

  return buckets;
}

function updateDailyChartSelection() {
  const cols = elements.statsDailyChartBars.querySelectorAll(".stats-chart-col-btn");
  for (const col of cols) {
    const timestamp = Number(col.dataset.chartTimestamp);
    const isSelected =
      selectedDistributionBucket?.mode === activeStatsMode &&
      selectedDistributionBucket?.timestamp === timestamp;
    col.classList.toggle("is-selected", isSelected);
    col.setAttribute("aria-pressed", String(isSelected));
  }
}

function revealHourChartSection() {
  elements.statsHourChartSection.hidden = false;
  elements.statsHourChartSection.removeAttribute("hidden");
  elements.statsHourChartSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatChartDuration(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }

  if (minutes > 0) {
    return `${minutes}分钟`;
  }

  if (total > 0) {
    return "不足 1 分钟";
  }

  return "0分钟";
}

let activeChartBarWrap = null;
let activeChartTooltip = null;

function hideStatsChartTooltip() {
  activeChartBarWrap = null;
  activeChartTooltip = null;
  elements.statsChartTooltip.hidden = true;
  elements.statsChartTooltip.classList.remove("is-visible");
  elements.statsHourChartTooltip.hidden = true;
  elements.statsHourChartTooltip.classList.remove("is-visible");
}

function showStatsChartTooltip(section, tooltip, barWrap) {
  const chartRect = section.getBoundingClientRect();
  const barRect = barWrap.getBoundingClientRect();
  tooltip.textContent = barWrap.dataset.chartLabel || formatChartDuration(barWrap.dataset.chartSeconds);

  const centerX = barRect.left + barRect.width / 2 - chartRect.left;
  const top = barRect.top - chartRect.top;

  tooltip.style.left = `${centerX}px`;
  tooltip.style.top = `${top}px`;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");
  activeChartTooltip = tooltip;
}

function renderChartLabel(bucket, mode) {
  if (mode === "monthly") {
    const tickClass = bucket.label
      ? "stats-chart-label stats-chart-tick"
      : "stats-chart-label stats-chart-tick is-spacer";

    return `<span class="${tickClass}">${escapeHtml(bucket.label)}</span>`;
  }

  if (!bucket.label) {
    return "";
  }

  return `<span class="stats-chart-label">${escapeHtml(bucket.label)}</span>`;
}

function renderDailyReadChart(payload, mode) {
  const buckets = buildChartBuckets(payload, mode);

  if (!buckets.length) {
    elements.statsDailyChartSection.hidden = true;
    elements.statsDailyChartBars.innerHTML = "";
    elements.statsDailyChartBars.className = "stats-chart-bars";
    return;
  }

  const maxSeconds = Math.max(...buckets.map((bucket) => bucket.seconds), 1);
  const readDayCount = buckets.filter((bucket) => bucket.seconds >= MIN_READ_DAY_SECONDS).length;
  const readDayUnit = mode === "annually" ? "个月" : "天";

  elements.statsDailyChartSection.hidden = false;
  elements.statsDailyChartBars.className = `stats-chart-bars stats-chart-bars--${mode}`;
  elements.statsDailyChartBars.setAttribute(
    "aria-label",
    `${STATS_MODE_LABELS[mode]}阅读分布，有效阅读 ${readDayCount} ${readDayUnit}`,
  );

  elements.statsDailyChartBars.innerHTML = buckets
    .map((bucket) => {
      const heightPercent =
        bucket.seconds > 0 ? Math.max(8, Math.round((bucket.seconds / maxSeconds) * 100)) : 0;
      const isReadDay = bucket.seconds >= MIN_READ_DAY_SECONDS;
      const duration = formatChartDuration(bucket.seconds);
      const dayLabel = formatDistributionBucketLabel(bucket.timestamp, mode);
      const labelMarkup = renderChartLabel(bucket, mode);
      const isSelected =
        selectedDistributionBucket?.mode === mode &&
        selectedDistributionBucket?.timestamp === bucket.timestamp;

      return `
        <button
          type="button"
          class="stats-chart-col stats-chart-col-btn${isSelected ? " is-selected" : ""}"
          data-chart-seconds="${bucket.seconds}"
          data-chart-timestamp="${bucket.timestamp}"
          data-chart-day-label="${escapeHtml(dayLabel)}"
          data-chart-label="${escapeHtml(`${dayLabel} ${duration}`)}"
          aria-label="${escapeHtml(`${dayLabel} ${duration}`)}"
          aria-pressed="${isSelected}"
        >
          <span class="stats-chart-bar-wrap">
            <span
              class="stats-chart-bar${isReadDay ? " is-read-day" : ""}${bucket.seconds === 0 ? " is-empty" : ""}"
              style="height: ${heightPercent}%"
            ></span>
          </span>
          ${labelMarkup}
        </button>
      `;
    })
    .join("");
}

function renderHourReadChart(mode) {
  const hasDaySelection =
    selectedDistributionBucket && selectedDistributionBucket.mode === mode;

  if (!hasDaySelection) {
    elements.statsHourChartSection.hidden = true;
    elements.statsHourChartBars.innerHTML = "";
    return;
  }

  const buckets = buildTrackedHourBucketsForSelection(selectedDistributionBucket);
  const ariaLabel = `${selectedDistributionBucket.label}阅读时段分布`;

  const maxSeconds = Math.max(...buckets.map((bucket) => bucket.seconds), 1);
  const peakSeconds = Math.max(...buckets.map((bucket) => bucket.seconds));

  revealHourChartSection();

  if (activeChartTooltip === elements.statsHourChartTooltip) {
    hideStatsChartTooltip();
  }

  const peakBucket = buckets.find((bucket) => bucket.seconds === peakSeconds);
  elements.statsHourChartBars.setAttribute(
    "aria-label",
    peakBucket?.seconds > 0
      ? `${ariaLabel}，高峰时段 ${peakBucket.rangeLabel}`
      : ariaLabel,
  );

  elements.statsHourChartBars.innerHTML = buckets
    .map((bucket) => {
      const heightPercent =
        bucket.seconds > 0 ? Math.max(8, Math.round((bucket.seconds / maxSeconds) * 100)) : 0;
      const isPeak = bucket.seconds > 0 && bucket.seconds === peakSeconds;
      const duration = formatChartDuration(bucket.seconds);
      const tickClass = bucket.label
        ? "stats-chart-label stats-chart-tick"
        : "stats-chart-label stats-chart-tick is-spacer";

      return `
        <div class="stats-chart-col">
          <button
            type="button"
            class="stats-chart-bar-wrap"
            data-chart-seconds="${bucket.seconds}"
            data-chart-label="${escapeHtml(`${bucket.rangeLabel} ${duration}`)}"
            aria-label="${escapeHtml(`${bucket.rangeLabel} ${duration}`)}"
          >
            <div
              class="stats-chart-bar${isPeak ? " is-peak" : ""}${bucket.seconds > 0 ? " is-read-day" : ""}${bucket.seconds === 0 ? " is-empty" : ""}"
              style="height: ${heightPercent}%"
            ></div>
          </button>
          <span class="${tickClass}">${escapeHtml(bucket.label)}</span>
        </div>
      `;
    })
    .join("");
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
    baseTime: payload.baseTime,
    readTimes: payload.readTimes,
    preferTime: payload.preferTime,
    preferTimeWord: payload.preferTimeWord,
    synced_at: row.synced_at,
  };
}

function readCache() {
  const sources = [
    () => localStorage.getItem(CACHE_KEY),
    () => sessionStorage.getItem(CACHE_LEGACY_KEY),
  ];

  for (const getRaw of sources) {
    try {
      const raw = getRaw();
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw);
      if (!parsed?.stats && !parsed?.books?.length) {
        continue;
      }

      return parsed;
    } catch {
      // ignore corrupt cache
    }
  }

  return null;
}

function writeCache() {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        stats: readingStatsByMode,
        hourly: hourlyReadingRows,
        books: wereadBooks,
      }),
    );
    sessionStorage.removeItem(CACHE_LEGACY_KEY);
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function hydrateFromCache(cache) {
  let hydrated = false;

  if (cache.stats && Object.keys(cache.stats).length > 0) {
    readingStatsByMode = cache.stats;
    renderReadingStats();
    hydrated = true;
  }

  if (cache.hourly?.length) {
    hourlyReadingRows = cache.hourly;
    if (Object.keys(readingStatsByMode).length > 0) {
      renderHourReadChart(activeStatsMode);
    }
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
    elements.statsDailyChartSection.hidden = true;
    elements.statsHourChartSection.hidden = true;
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

  renderDailyReadChart(payload, activeStatsMode);
  renderHourReadChart(activeStatsMode);
}

async function loadReadingStats() {
  if (!Object.keys(readingStatsByMode).length) {
    showStatsLoading();
  }

  const { data, error } = await restSelect("weread_reading_stats", {
    select: "mode,payload,synced_at",
  });

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

async function loadHourlyReading() {
  const { data, error } = await restSelect("weread_hourly_reading", {
    select: "hour_start,read_seconds",
    order: restOrder("hour_start", { ascending: true }),
    filter: { hour_start: `gte.${getHourlyQueryStartIso()}` },
  });

  if (error) {
    console.error(error);
    return;
  }

  hourlyReadingRows = data || [];

  if (Object.keys(readingStatsByMode).length > 0) {
    renderHourReadChart(activeStatsMode);
  }

  writeCache();
}

function setActiveStatsMode(mode) {
  activeStatsMode = mode;
  selectedDistributionBucket = null;
  hideStatsChartTooltip();
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

function bindStatsChartSection(section, bars, tooltip) {
  bars.addEventListener("click", (event) => {
    const barWrap = event.target.closest(".stats-chart-bar-wrap");
    if (!barWrap) {
      return;
    }

    event.stopPropagation();

    if (barWrap === activeChartBarWrap && activeChartTooltip === tooltip) {
      hideStatsChartTooltip();
      return;
    }

    activeChartBarWrap = barWrap;
    showStatsChartTooltip(section, tooltip, barWrap);
  });
}

function handleDistributionChartActivate(event) {
  const col = event.target.closest(".stats-chart-col-btn");
  if (!col) {
    return;
  }

  event.stopPropagation();

  const timestamp = Number(col.dataset.chartTimestamp);
  const label = col.dataset.chartDayLabel || "";
  const isSameSelection =
    selectedDistributionBucket?.mode === activeStatsMode &&
    selectedDistributionBucket?.timestamp === timestamp;

  if (isSameSelection && activeChartBarWrap === col) {
    selectedDistributionBucket = null;
    hideStatsChartTooltip();
    renderHourReadChart(activeStatsMode);
    updateDailyChartSelection();
    return;
  }

  selectedDistributionBucket = {
    timestamp,
    label,
    mode: activeStatsMode,
  };

  activeChartBarWrap = col;
  showStatsChartTooltip(
    elements.statsDailyChartSection,
    elements.statsChartTooltip,
    col,
  );
  updateDailyChartSelection();
  renderHourReadChart(activeStatsMode);
}

elements.statsDailyChartBars.addEventListener("click", handleDistributionChartActivate);

bindStatsChartSection(
  elements.statsHourChartInner,
  elements.statsHourChartBars,
  elements.statsHourChartTooltip,
);

document.addEventListener("click", (event) => {
  if (
    event.target.closest("#statsDailyChartSection") ||
    event.target.closest("#statsHourChartSection")
  ) {
    return;
  }

  hideStatsChartTooltip();
});

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

function attachHighlightsToBooks(bookRows, highlightRows) {
  const highlightsByBook = {};

  for (const highlight of highlightRows || []) {
    if (!highlightsByBook[highlight.weread_book_id]) {
      highlightsByBook[highlight.weread_book_id] = [];
    }
    highlightsByBook[highlight.weread_book_id].push(highlight);
  }

  return (bookRows || []).map((book) => {
    const highlights = highlightsByBook[book.weread_book_id] || [];
    return {
      ...book,
      hasHighlights: highlights.length > 0,
      highlights,
    };
  });
}

function attachHighlightFlags(bookRows, bookIdsWithHighlights, previousById = new Map()) {
  const idSet =
    bookIdsWithHighlights instanceof Set
      ? bookIdsWithHighlights
      : new Set(bookIdsWithHighlights);

  return (bookRows || []).map((book) => {
    const previous = previousById.get(book.weread_book_id);
    const hasHighlights = idSet.has(book.weread_book_id);

    return {
      ...book,
      hasHighlights,
      highlights: previous?.highlights?.length ? previous.highlights : [],
    };
  });
}

async function loadWereadHighlightDetails(bookRows) {
  const { data: highlightRows, error: highlightError } = await restSelect("weread_highlights", {
    select: HIGHLIGHT_COLUMNS,
    order: restOrder("sort_order", { ascending: true }),
  });

  if (highlightError) {
    console.warn("Highlights load failed:", highlightError.message);
    return;
  }

  wereadBooks = attachHighlightsToBooks(bookRows, highlightRows);
  renderWereadBooks();
  writeCache();
}

async function loadWereadBooks() {
  if (!wereadBooks.length) {
    showWereadLoading();
  }

  const { data: bookRows, error: bookError } = await restSelect("weread_books", {
    select: BOOK_COLUMNS,
    order: restOrder("read_update_time", { ascending: false, nullsFirst: false }),
  });

  if (bookError) {
    setWereadEmptyState("加载失败", bookError.message);
    throw bookError;
  }

  const { data: highlightIdRows, error: highlightIdError } = await restSelect("weread_highlights", {
    select: "weread_book_id",
  });

  if (highlightIdError) {
    setWereadEmptyState("加载失败", highlightIdError.message);
    throw highlightIdError;
  }

  const bookIdsWithHighlights = new Set(
    (highlightIdRows || []).map((row) => row.weread_book_id),
  );
  const previousById = new Map(wereadBooks.map((book) => [book.weread_book_id, book]));

  wereadBooks = attachHighlightFlags(bookRows, bookIdsWithHighlights, previousById);
  renderWereadBooks();
  writeCache();

  void loadWereadHighlightDetails(bookRows);
}

const SHELF_TAB_ORDER = ["reading", "finished", "toRead"];

function getBookShelf(book) {
  const hasHighlights = book.highlights.length > 0 || book.hasHighlights;

  if (!hasHighlights) {
    return "toRead";
  }

  if (book.finish_reading) {
    return "finished";
  }

  return "reading";
}

function bookMatchesKeyword(book, keyword) {
  const fields = [
    book.title,
    book.author,
    ...book.highlights.map((item) => item.mark_text),
    ...book.highlights.map((item) => item.chapter_title),
  ];

  return fields.some((value) => String(value ?? "").toLowerCase().includes(keyword));
}

function getSearchKeyword() {
  return elements.wereadSearchInput.value.trim().toLowerCase();
}

function getGlobalSearchMatches(keyword) {
  if (!keyword) {
    return wereadBooks;
  }

  return wereadBooks.filter((book) => bookMatchesKeyword(book, keyword));
}

function resolveShelfForSearch(matches) {
  const shelvesWithMatches = new Set(matches.map(getBookShelf));

  if (shelvesWithMatches.has(activeShelfTab)) {
    return activeShelfTab;
  }

  for (const shelf of SHELF_TAB_ORDER) {
    if (shelvesWithMatches.has(shelf)) {
      return shelf;
    }
  }

  return activeShelfTab;
}

function renderHighlightItem(highlight) {
  return `
    <li class="highlight-item">
      <p class="highlight-line is-clamped">
        <span class="highlight-content">${escapeHtml(highlight.mark_text)}</span><button
          type="button"
          class="highlight-action"
          data-action="toggle-highlight"
          aria-expanded="false"
          hidden
        >展开</button>
      </p>
    </li>
  `;
}

function renderHighlightDialogItem(highlight, index) {
  return `
    <article class="highlight-dialog-item">
      <p class="highlight-dialog-index">划线 ${index + 1}</p>
      <p class="highlight-dialog-text">${escapeHtml(highlight.mark_text)}</p>
    </article>
  `;
}

function renderWereadHighlights(highlights, bookId) {
  if (!highlights.length) {
    return `<p class="weread-no-highlights">暂无划线</p>`;
  }

  const visible = highlights.slice(0, WEREAD_HIGHLIGHTS_DISPLAY);
  const items = visible.map((highlight) => renderHighlightItem(highlight)).join("");
  const viewAllButton =
    highlights.length > WEREAD_HIGHLIGHTS_DISPLAY
      ? `
        <button
          type="button"
          class="highlight-view-all"
          data-action="all-highlights"
          data-book-id="${escapeHtml(bookId)}"
        >
          【查看全部划线】
        </button>
      `
      : "";

  return `
    <ul class="highlight-list">${items}</ul>
    ${viewAllButton}
  `;
}

function setupHighlightExpandToggles(root = elements.wereadBookGrid) {
  for (const line of root.querySelectorAll(".highlight-line")) {
    const toggle = line.querySelector("[data-action='toggle-highlight']");

    if (!toggle) {
      continue;
    }

    line.classList.add("is-clamped");
    line.classList.remove("is-expanded");
    toggle.textContent = "展开";
    toggle.setAttribute("aria-expanded", "false");
    toggle.hidden = true;

    requestAnimationFrame(() => {
      if (line.scrollHeight > line.clientHeight + 1) {
        toggle.hidden = false;
        return;
      }

      line.classList.remove("is-clamped");
    });
  }
}

async function openHighlightsDialog(bookId) {
  const book = findWereadBook(bookId);
  if (!book) {
    return;
  }

  elements.highlightsDialogTitle.textContent = book.title;
  elements.highlightsDialogAuthor.textContent = book.author || "未填写作者";
  elements.highlightsDialogList.innerHTML = `<p class="highlights-dialog-loading">加载中…</p>`;
  elements.highlightsDialog.showModal();

  const { data, error } = await restSelect("weread_highlights", {
    select: "mark_text,sort_order,chapter_title",
    filter: { weread_book_id: `eq.${bookId}` },
    order: restOrder("sort_order", { ascending: true }),
  });

  if (error) {
    elements.highlightsDialogList.innerHTML = `<p class="highlights-dialog-loading">加载失败：${escapeHtml(error.message)}</p>`;
    return;
  }

  const highlights = data || [];
  if (!highlights.length) {
    elements.highlightsDialogList.innerHTML = `<p class="highlights-dialog-loading">暂无划线</p>`;
    return;
  }

  book.highlights = highlights;
  book.hasHighlights = true;
  writeCache();

  elements.highlightsDialogList.innerHTML = highlights
    .map((highlight, index) => renderHighlightDialogItem(highlight, index))
    .join("");
}

function closeHighlightsDialog() {
  if (elements.highlightsDialog.open) {
    elements.highlightsDialog.close();
  }
}

function formatShelfDate(isoTime) {
  if (!isoTime) {
    return null;
  }

  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderFinishedMeta(book) {
  const parts = [];
  const finishDate = formatShelfDate(book.finish_time);
  const readDuration = formatDurationSeconds(book.read_time_seconds);

  if (finishDate) {
    parts.push(`读完于 ${finishDate}`);
  }

  if (book.read_time_seconds > 0) {
    parts.push(`阅读 ${readDuration}`);
  }

  if (!parts.length) {
    return "";
  }

  return `<p class="weread-finished-meta">${escapeHtml(parts.join(" · "))}</p>`;
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

function loadLocalBookReviews() {
  try {
    const stored = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY));
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
}

function formatReviewDate(isoString) {
  const date = new Date(isoString || "");
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function applyReviewRows(rows) {
  bookReviewsById = {};
  for (const row of rows || []) {
    const text = String(row.review_text || "").trim();
    if (!text) {
      continue;
    }

    const bookId = row.weread_book_id;
    const existing = bookReviewsById[bookId];
    const rowTime = Date.parse(row.created_at || "");
    const existingTime = Date.parse(existing?.createdAt || "");

    if (!existing || rowTime >= existingTime) {
      bookReviewsById[bookId] = {
        id: row.id,
        text,
        createdAt: row.created_at,
      };
    }
  }
}

async function migrateLocalBookReviews() {
  if (localStorage.getItem(REVIEWS_MIGRATED_KEY)) {
    return;
  }

  const localReviews = loadLocalBookReviews();
  const entries = Object.entries(localReviews).filter(([, review]) =>
    String(review?.text || "").trim(),
  );

  if (!entries.length) {
    localStorage.setItem(REVIEWS_MIGRATED_KEY, "1");
    return;
  }

  const now = new Date().toISOString();
  const rows = entries.map(([wereadBookId, review]) => ({
    weread_book_id: wereadBookId,
    review_text: String(review.text).trim(),
    created_at: review.updatedAt || now,
  }));

  const { error } = await restInsert("weread_book_reviews", rows);

  if (error) {
    console.warn("Migrate local reviews failed:", error.message);
    return;
  }

  localStorage.removeItem(REVIEWS_STORAGE_KEY);
  localStorage.setItem(REVIEWS_MIGRATED_KEY, "1");
}

async function loadBookReviewsFromSupabase() {
  await migrateLocalBookReviews();

  const { data, error } = await restSelect("weread_book_reviews", { select: REVIEW_COLUMNS });

  if (error) {
    console.error(error);
    return;
  }

  applyReviewRows(data);

  if (wereadBooks.length) {
    renderWereadBooks();
  }
}

function getBookReview(bookId) {
  return bookReviewsById[bookId] || null;
}

function hasBookReview(bookId) {
  return Boolean(getBookReview(bookId));
}

function setReviewDialogMode(mode, bookId) {
  reviewDialogMode = mode;
  const review = getBookReview(bookId);

  if (mode === "view" && review) {
    elements.reviewDialogView.hidden = false;
    elements.reviewDialogCompose.hidden = true;
    elements.reviewDialogSave.hidden = true;
    elements.reviewDialogDate.dateTime = review.createdAt || "";
    elements.reviewDialogDate.textContent = formatReviewDate(review.createdAt);
    elements.reviewDialogSavedText.textContent = review.text;
    return;
  }

  elements.reviewDialogView.hidden = true;
  elements.reviewDialogCompose.hidden = false;
  elements.reviewDialogSave.hidden = false;
  elements.reviewDialogText.value = review?.text || "";
}

function setReviewDialogStatus(message) {
  elements.reviewDialogStatus.textContent = message || "";
}

function findWereadBook(bookId) {
  return wereadBooks.find((book) => book.weread_book_id === bookId);
}

function openReviewDialog(bookId) {
  const book = findWereadBook(bookId);
  if (!book) {
    return;
  }

  activeReviewBookId = bookId;
  elements.reviewDialogTitle.textContent = book.title;
  elements.reviewDialogAuthor.textContent = book.author || "未填写作者";
  setReviewDialogStatus("");
  setReviewDialogMode(hasBookReview(bookId) ? "view" : "edit", bookId);
  elements.reviewDialog.showModal();

  if (reviewDialogMode === "edit") {
    elements.reviewDialogText.focus();
  }
}

function closeReviewDialog() {
  activeReviewBookId = null;
  reviewDialogMode = "edit";
  setReviewDialogStatus("");
  if (elements.reviewDialog.open) {
    elements.reviewDialog.close();
  }
}

async function saveActiveBookReview() {
  if (!activeReviewBookId) {
    return;
  }

  const text = elements.reviewDialogText.value.trim();
  const bookId = activeReviewBookId;
  const existing = getBookReview(bookId);

  if (!text) {
    setReviewDialogStatus("请先写下内容再保存");
    return;
  }

  elements.reviewDialogSave.disabled = true;
  setReviewDialogStatus("保存中…");

  let data = null;
  let error = null;

  if (existing?.id) {
    const updatedAt = new Date().toISOString();
    ({ data, error } = await restUpdate(
      "weread_book_reviews",
      { review_text: text, created_at: updatedAt },
      `id=eq.${encodeURIComponent(existing.id)}`,
    ));
  } else {
    const createdAt = new Date().toISOString();
    ({ data, error } = await restInsert(
      "weread_book_reviews",
      {
        weread_book_id: bookId,
        review_text: text,
        created_at: createdAt,
      },
      { returning: true, single: true },
    ));
  }

  elements.reviewDialogSave.disabled = false;

  if (error) {
    setReviewDialogStatus(`保存失败：${error.message}`);
    return;
  }

  bookReviewsById[bookId] = {
    id: data.id,
    text,
    createdAt: data.created_at,
  };

  setReviewDialogMode("view", bookId);
  setReviewDialogStatus("已保存");
}

async function deleteActiveBookReview() {
  if (!activeReviewBookId) {
    return;
  }

  const bookId = activeReviewBookId;
  const review = getBookReview(bookId);
  if (!review) {
    return;
  }

  const confirmed = window.confirm("确定删除这条读后感吗？");
  if (!confirmed) {
    return;
  }

  elements.reviewDialogDelete.disabled = true;
  setReviewDialogStatus("删除中…");

  const { error } = await restDelete(
    "weread_book_reviews",
    `id=eq.${encodeURIComponent(review.id)}`,
  );

  elements.reviewDialogDelete.disabled = false;

  if (error) {
    setReviewDialogStatus(`删除失败：${error.message}`);
    return;
  }

  delete bookReviewsById[bookId];
  setReviewDialogMode("edit", bookId);
  elements.reviewDialogText.value = "";
  setReviewDialogStatus("已删除");
  elements.reviewDialogText.focus();
}

function renderWereadBookCard(
  book,
  { showProgress = false, showHighlights = true, showFinishedMeta = false } = {},
) {
  const cover = book.cover_url
    ? `<img src="${escapeHtml(book.cover_url)}" alt="" width="72" height="102" loading="lazy" decoding="async" fetchpriority="low" />`
    : `<span class="cover-fallback">${escapeHtml(book.title.slice(0, 4))}</span>`;
  const author = book.author || "未填写作者";
  const openUrl = `${WEREAD_OPEN_URL}${encodeURIComponent(book.weread_book_id)}`;
  const progressBlock = showProgress ? renderReadingProgress(book) : "";
  const finishedMetaBlock = showFinishedMeta ? renderFinishedMeta(book) : "";
  const highlightsBlock = showHighlights
    ? renderWereadHighlights(book.highlights, book.weread_book_id)
    : "";
  const reviewLabel = hasBookReview(book.weread_book_id) ? "查看读后感" : "写读后感";

  return `
    <article class="weread-card">
      <button
        type="button"
        class="weread-cover"
        data-action="review"
        data-book-id="${escapeHtml(book.weread_book_id)}"
        aria-label="${escapeHtml(reviewLabel)}：${escapeHtml(book.title)}"
      >
        ${cover}
      </button>
      <div class="weread-content">
        <div class="weread-meta">
          <h3 class="weread-title">${escapeHtml(book.title)}</h3>
          <p class="weread-author">${escapeHtml(author)}</p>
        </div>
        ${finishedMetaBlock}
        ${progressBlock}
        ${highlightsBlock}
        <a class="weread-link" href="${openUrl}">在微信读书打开</a>
      </div>
    </article>
  `;
}

function compareFinishTimeDesc(left, right) {
  const leftTime = Date.parse(left.finish_time || "");
  const rightTime = Date.parse(right.finish_time || "");
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (!leftValid && !rightValid) {
    return 0;
  }

  if (!leftValid) {
    return 1;
  }

  if (!rightValid) {
    return -1;
  }

  return rightTime - leftTime;
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

  finished.sort(compareFinishTimeDesc);

  return { toRead, reading, finished };
}

function updateShelfTabs({ reading, finished, toRead }) {
  const counts = { reading: reading.length, finished: finished.length, toRead: toRead.length };

  for (const tab of elements.shelfTabs) {
    const shelf = tab.dataset.shelf;
    const isActive = shelf === activeShelfTab;
    tab.textContent = `${SHELF_TAB_LABELS[shelf]}(${counts[shelf]})`;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }
}

function setActiveShelfTab(shelf) {
  activeShelfTab = shelf;
  renderWereadBooks();
}

function renderWereadBooks() {
  const keyword = getSearchKeyword();
  const searchMatches = getGlobalSearchMatches(keyword);

  if (keyword && searchMatches.length > 0) {
    activeShelfTab = resolveShelfForSearch(searchMatches);
  }

  const { toRead, reading, finished } = classifyWereadBooks(searchMatches);
  const shelves = { reading, finished, toRead };
  const activeBooks = shelves[activeShelfTab] || [];

  updateShelfTabs({ reading, finished, toRead });

  const hasBooks = wereadBooks.length > 0;
  const hasSearch = keyword.length > 0;
  elements.wereadEmptyState.classList.toggle("is-visible", !hasBooks || activeBooks.length === 0);

  if (!hasBooks) {
    setWereadEmptyState("还没有同步微信读书", "配置 WEREAD_API_KEY 后运行 node scripts/sync-weread.mjs。");
  } else if (hasSearch && searchMatches.length === 0) {
    setWereadEmptyState("没有匹配的书籍", "换个关键词再试试。");
  } else if (activeBooks.length === 0) {
    setWereadEmptyState(
      `${SHELF_TAB_LABELS[activeShelfTab]}暂无书籍`,
      hasSearch ? "试试其他关键词或切换标签。" : "切换其他标签查看。",
    );
  }

  const cardOptions = SHELF_CARD_OPTIONS[activeShelfTab] || {};

  elements.wereadBookGrid.innerHTML =
    activeBooks.length === 0
      ? ""
      : `
        <div class="weread-shelf">
          <div class="weread-list">
            ${activeBooks.map((book) => renderWereadBookCard(book, cardOptions)).join("")}
          </div>
        </div>
      `;

  setupHighlightExpandToggles();
}

for (const tab of elements.shelfTabs) {
  tab.addEventListener("click", () => setActiveShelfTab(tab.dataset.shelf));
}

elements.wereadSearchInput.addEventListener("input", renderWereadBooks);

elements.wereadBookGrid.addEventListener("click", (event) => {
  const toggleButton = event.target.closest("[data-action='toggle-highlight']");
  if (toggleButton) {
    const line = toggleButton.closest(".highlight-line");
    if (!line) {
      return;
    }

    const expanded = line.classList.toggle("is-expanded");
    line.classList.toggle("is-clamped", !expanded);
    toggleButton.textContent = expanded ? "收起" : "展开";
    toggleButton.setAttribute("aria-expanded", String(expanded));
    return;
  }

  const allHighlightsButton = event.target.closest("[data-action='all-highlights']");
  if (allHighlightsButton) {
    openHighlightsDialog(allHighlightsButton.dataset.bookId);
    return;
  }

  const coverButton = event.target.closest("[data-action='review']");
  if (!coverButton) {
    return;
  }

  openReviewDialog(coverButton.dataset.bookId);
});

elements.highlightsDialogClose.addEventListener("click", closeHighlightsDialog);

elements.highlightsDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeHighlightsDialog();
});

elements.highlightsDialog.addEventListener("click", (event) => {
  if (event.target === elements.highlightsDialog) {
    closeHighlightsDialog();
  }
});

elements.reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveActiveBookReview();
});

elements.reviewDialogClose.addEventListener("click", closeReviewDialog);
elements.reviewDialogCancel.addEventListener("click", () => {
  if (!activeReviewBookId) {
    closeReviewDialog();
    return;
  }

  if (reviewDialogMode === "edit" && hasBookReview(activeReviewBookId)) {
    setReviewDialogMode("view", activeReviewBookId);
    setReviewDialogStatus("");
    return;
  }

  closeReviewDialog();
});
elements.reviewDialogEdit.addEventListener("click", () => {
  if (!activeReviewBookId) {
    return;
  }

  setReviewDialogMode("edit", activeReviewBookId);
  setReviewDialogStatus("");
  elements.reviewDialogText.focus();
});
elements.reviewDialogDelete.addEventListener("click", () => {
  deleteActiveBookReview();
});

elements.reviewDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeReviewDialog();
});

elements.reviewDialog.addEventListener("click", (event) => {
  if (event.target === elements.reviewDialog) {
    closeReviewDialog();
  }
});

function scheduleBookReviewsLoad() {
  const run = () => {
    loadBookReviewsFromSupabase().catch((error) => {
      console.error(error);
    });
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1);
  }
}

const cached = readCache();
if (cached) {
  hydrateFromCache(cached);
}

Promise.all([loadReadingStats(), loadHourlyReading(), loadWereadBooks()])
  .then(() => scheduleBookReviewsLoad())
  .catch((error) => {
    console.error(error);
  });
