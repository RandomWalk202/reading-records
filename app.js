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
  statsDailyChartSection: document.querySelector("#statsDailyChartSection"),
  statsDailyChartBars: document.querySelector("#statsDailyChartBars"),
  statsChartTooltip: document.querySelector("#statsChartTooltip"),
  statsHourChartSection: document.querySelector("#statsHourChartSection"),
  statsHourChartHeading: document.querySelector("#statsHourChartHeading"),
  statsHourChartToggle: document.querySelector("#statsHourChartToggle"),
  statsHourChartCollapse: document.querySelector("#statsHourChartCollapse"),
  statsHourChartBody: document.querySelector("#statsHourChartBody"),
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
  challengeSection: document.querySelector("#challengeSection"),
  challengeDaysValue: document.querySelector("#challengeDaysValue"),
  challengeDaysBar: document.querySelector("#challengeDaysBar"),
  challengeDaysRemaining: document.querySelector("#challengeDaysRemaining"),
  challengeTimeValue: document.querySelector("#challengeTimeValue"),
  challengeTimeBar: document.querySelector("#challengeTimeBar"),
  challengeTimeRemaining: document.querySelector("#challengeTimeRemaining"),
};

const STATS_MODE_LABELS = {
  weekly: "本周",
  monthly: "本月",
  annually: "今年",
};

let readingStatsByMode = {};
let activeStatsMode = "weekly";
let challengeRow = null;
let hourlyReadingRows = [];
/** Shanghai YYYY-MM-DD for the hour chart; null means today. */
let selectedHourDateKey = null;

const WEREAD_OPEN_URL = "weread://reading?bId=";
const WEREAD_HIGHLIGHTS_DISPLAY = 2;
const LOADING_LABEL = "正在加载";
const CACHE_KEY = "reading-records-cache-v10";
const SHANGHAI_TZ = "Asia/Shanghai";
const CACHE_LEGACY_KEY = "reading-records-cache-v3";
const REVIEWS_STORAGE_KEY = "reading-records.book-reviews-v1";
const REVIEWS_MIGRATED_KEY = "reading-records.book-reviews-migrated-v1";
const REVIEW_COLUMNS = "id,weread_book_id,review_text,created_at";
const MIN_READ_DAY_SECONDS = 60;
const HOURLY_STATE_ID = "weread-hourly-v1";
const HOURLY_BUCKET_COUNT = 24;
const HOURLY_TICK_INTERVAL = 3;

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const DAY_MS = 86400000;
const MONTHLY_TICK_INTERVAL = 5;
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

function formatChallengeRemainingDuration(totalSeconds, targetSeconds) {
  const targetHours = Math.floor(Math.max(0, targetSeconds) / 3600);
  const targetMinutes = Math.floor((Math.max(0, targetSeconds) % 3600) / 60);
  const readHours = Math.floor(Math.max(0, totalSeconds) / 3600);
  const readMinutes = Math.floor((Math.max(0, totalSeconds) % 3600) / 60);

  let remHours = targetHours - readHours;
  let remMinutes = targetMinutes - readMinutes;
  if (remMinutes < 0) {
    remHours -= 1;
    remMinutes += 60;
  }
  remHours = Math.max(0, remHours);
  remMinutes = Math.max(0, remMinutes);

  if (remHours > 0) {
    return `${remHours} 小时 ${remMinutes} 分`;
  }

  if (remMinutes > 0) {
    return `${remMinutes} 分钟`;
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
    // Prefer h23 so midnight is 00, never 24 (avoids bad hour buckets in charts).
    ...(Object.prototype.hasOwnProperty.call(extraOptions, "hour")
      ? { hourCycle: "h23" }
      : {}),
    ...extraOptions,
  }).formatToParts(date);
}

function pickShanghaiPart(parts, type) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

function formatMonthlyChartDateLabel(timestampMs) {
  const parts = shanghaiFormatParts(new Date(timestampMs));
  const month = Number(pickShanghaiPart(parts, "month"));
  const day = Number(pickShanghaiPart(parts, "day"));
  return `${month}月${day}日`;
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
  if (elements.statsHourChartTooltip) {
    elements.statsHourChartTooltip.hidden = true;
    elements.statsHourChartTooltip.classList.remove("is-visible");
  }
}

function getShanghaiHour(date = new Date()) {
  const hour = Number(
    pickShanghaiPart(shanghaiFormatParts(date, { hour: "2-digit", hourCycle: "h23" }), "hour"),
  );
  // Some engines still emit 24 at midnight; treat as 0 for chart buckets.
  if (hour === 24) {
    return 0;
  }
  return hour;
}

function getShanghaiDateKey(date = new Date()) {
  const parts = shanghaiFormatParts(date);
  return `${pickShanghaiPart(parts, "year")}-${pickShanghaiPart(parts, "month")}-${pickShanghaiPart(parts, "day")}`;
}

function isValidHourlyBucketKey(hourStart) {
  return /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):00:00\+08:00$/.test(String(hourStart || ""));
}

function resolveHourDateKey() {
  return selectedHourDateKey || getShanghaiDateKey(new Date());
}

function formatHourDateHeading(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  if (!year || !month || !day) {
    return "阅读时段";
  }
  const todayKey = getShanghaiDateKey(new Date());
  if (dateKey === todayKey) {
    return "阅读时段 · 今天";
  }
  return `阅读时段 · ${month}月${day}日`;
}

function buildHourBucketsForDate(dateKey) {
  const todayKey = getShanghaiDateKey(new Date());
  const currentHour = getShanghaiHour(new Date());
  const byHour = Array.from({ length: HOURLY_BUCKET_COUNT }, () => 0);

  for (const row of hourlyReadingRows) {
    if (!isValidHourlyBucketKey(row.hour_start)) {
      continue;
    }
    const rowDate = new Date(row.hour_start);
    if (Number.isNaN(rowDate.getTime()) || getShanghaiDateKey(rowDate) !== dateKey) {
      continue;
    }
    const hour = getShanghaiHour(rowDate);
    // For today, ignore future hour slots (also hides spilled bad data).
    if (hour < 0 || hour >= HOURLY_BUCKET_COUNT) {
      continue;
    }
    if (dateKey === todayKey && hour > currentHour) {
      continue;
    }
    byHour[hour] += Math.max(0, Number(row.read_seconds || 0));
  }

  return byHour.map((seconds, hour) => {
    const endHour = (hour + 1) % HOURLY_BUCKET_COUNT;
    const showTick = hour % HOURLY_TICK_INTERVAL === 0;
    return {
      hour,
      seconds,
      label: showTick ? String(hour) : "",
      rangeLabel: `${hour}点–${endHour}点`,
    };
  });
}

function setHourChartExpanded(expanded) {
  if (!elements.statsHourChartSection) {
    return;
  }

  elements.statsHourChartSection.classList.toggle("is-collapsed", !expanded);
  if (elements.statsHourChartToggle) {
    elements.statsHourChartToggle.setAttribute("aria-expanded", String(expanded));
    elements.statsHourChartToggle.setAttribute(
      "aria-label",
      expanded ? "收起阅读时段" : "展开阅读时段",
    );
  }

  if (!expanded) {
    hideStatsChartTooltip();
  }
}

function renderTodayHourChart({ forceExpand = false } = {}) {
  if (!elements.statsHourChartSection || !elements.statsHourChartBars) {
    return;
  }

  // Only show after the user taps a day in 阅读分布.
  if (!selectedHourDateKey) {
    elements.statsHourChartSection.hidden = true;
    elements.statsHourChartBars.innerHTML = "";
    elements.statsHourChartBars.classList.remove("is-empty-day");
    setHourChartExpanded(false);
    return;
  }

  const dateKey = selectedHourDateKey;
  const buckets = buildHourBucketsForDate(dateKey);
  const hasData = buckets.some((bucket) => bucket.seconds > 0);
  const heading = formatHourDateHeading(dateKey);

  elements.statsHourChartSection.hidden = false;
  if (elements.statsHourChartHeading) {
    elements.statsHourChartHeading.textContent = heading;
  }

  if (!hasData) {
    elements.statsHourChartBars.classList.add("is-empty-day");
    elements.statsHourChartBars.setAttribute("aria-label", `${heading}，暂无时段数据`);
    elements.statsHourChartBars.innerHTML =
      `<p class="stats-hour-empty">这天还没有时段数据</p>`;
    setHourChartExpanded(true);
    return;
  }

  const maxSeconds = Math.max(...buckets.map((bucket) => bucket.seconds), 1);
  elements.statsHourChartBars.classList.remove("is-empty-day");
  elements.statsHourChartBars.setAttribute("aria-label", `${heading}分布`);
  elements.statsHourChartBars.innerHTML = buckets
    .map((bucket) => {
      const heightPercent =
        bucket.seconds > 0 ? Math.max(8, Math.round((bucket.seconds / maxSeconds) * 100)) : 0;
      const duration = formatChartDuration(bucket.seconds);
      const chartLabel = `${bucket.rangeLabel} ${duration}`;
      const tickClass = bucket.label
        ? "stats-chart-label stats-chart-tick"
        : "stats-chart-label stats-chart-tick is-spacer";

      return `
        <div class="stats-chart-col">
          <button
            type="button"
            class="stats-chart-bar-wrap"
            data-chart-seconds="${bucket.seconds}"
            data-chart-label="${escapeHtml(chartLabel)}"
            aria-label="${escapeHtml(chartLabel)}"
          >
            <span
              class="stats-chart-bar${bucket.seconds === 0 ? " is-empty" : ""}"
              style="height: ${heightPercent}%"
            ></span>
          </button>
          <span class="${tickClass}">${escapeHtml(bucket.label)}</span>
        </div>
      `;
    })
    .join("");

  setHourChartExpanded(forceExpand || true);
}

async function loadHourlyReading() {
  const { data, error } = await restSelect("weread_challenge", {
    select: "daily_read_seconds,synced_at",
    filter: { id: `eq.${HOURLY_STATE_ID}` },
  });

  if (error) {
    console.warn("Load hourly reading failed:", error.message);
    hourlyReadingRows = [];
    renderTodayHourChart();
    return;
  }

  const hourly = data?.[0]?.daily_read_seconds || {};
  hourlyReadingRows = Object.entries(hourly)
    .map(([hour_start, read_seconds]) => ({
      hour_start,
      read_seconds: Math.max(0, Number(read_seconds || 0)),
    }))
    .filter((row) => row.read_seconds > 0 && isValidHourlyBucketKey(row.hour_start))
    .sort((a, b) => String(a.hour_start).localeCompare(String(b.hour_start)));

  renderTodayHourChart();
  writeCache();
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
    elements.statsDailyChartBars.style.removeProperty("--monthly-day-count");
    return;
  }

  const maxSeconds = Math.max(...buckets.map((bucket) => bucket.seconds), 1);
  const readDayCount = buckets.filter((bucket) => bucket.seconds >= MIN_READ_DAY_SECONDS).length;
  const readDayUnit = mode === "annually" ? "个月" : "天";

  elements.statsDailyChartSection.hidden = false;
  elements.statsDailyChartBars.className = `stats-chart-bars stats-chart-bars--${mode}`;
  if (mode === "monthly") {
    elements.statsDailyChartBars.style.setProperty("--monthly-day-count", String(buckets.length));
  } else {
    elements.statsDailyChartBars.style.removeProperty("--monthly-day-count");
  }
  elements.statsDailyChartBars.setAttribute(
    "aria-label",
    `${STATS_MODE_LABELS[mode]}阅读分布，有效阅读 ${readDayCount} ${readDayUnit}`,
  );

  const canPickDay = mode === "weekly" || mode === "monthly";
  const activeDateKey = resolveHourDateKey();

  elements.statsDailyChartBars.innerHTML = buckets
    .map((bucket) => {
      const heightPercent =
        bucket.seconds > 0 ? Math.max(8, Math.round((bucket.seconds / maxSeconds) * 100)) : 0;
      const isReadDay = bucket.seconds >= MIN_READ_DAY_SECONDS;
      const duration = formatChartDuration(bucket.seconds);
      const dayLabel = formatDistributionBucketLabel(bucket.timestamp, mode);
      const dateKey = canPickDay ? getShanghaiDateKey(new Date(bucket.timestamp)) : "";
      const isSelected = Boolean(dateKey && dateKey === activeDateKey && selectedHourDateKey);
      const chartLabel =
        mode === "monthly"
          ? `${formatMonthlyChartDateLabel(bucket.timestamp)} ${duration}`
          : duration;
      const labelMarkup = renderChartLabel(bucket, mode);
      return `
        <div class="stats-chart-col${isSelected ? " is-selected" : ""}">
          <button
            type="button"
            class="stats-chart-bar-wrap"
            data-chart-seconds="${bucket.seconds}"
            data-chart-label="${escapeHtml(chartLabel)}"
            data-date-key="${escapeHtml(dateKey)}"
            aria-pressed="${isSelected ? "true" : "false"}"
            aria-label="${escapeHtml(mode === "monthly" ? chartLabel : `${dayLabel} ${duration}`)}"
          >
            <span
              class="stats-chart-bar${isReadDay ? " is-read-day" : ""}${bucket.seconds === 0 ? " is-empty" : ""}"
              style="height: ${heightPercent}%"
            ></span>
          </button>
          ${labelMarkup}
        </div>
      `;
    })
    .join("");
}

function formatChallengePeriod(startDate, endDate) {
  const formatPart = (isoDate) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return `${year}.${month}.${day}`;
  };

  return `${formatPart(startDate)} – ${formatPart(endDate)}`;
}

function nextIsoDateShanghai(isoDate) {
  const nextMs = new Date(`${isoDate}T00:00:00+08:00`).getTime() + DAY_MS;
  const parts = shanghaiFormatParts(new Date(nextMs));
  return `${pickShanghaiPart(parts, "year")}-${pickShanghaiPart(parts, "month")}-${pickShanghaiPart(parts, "day")}`;
}

function listChallengeDates(startDate, endDate) {
  const dates = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = nextIsoDateShanghai(current);
  }

  return dates;
}

function summarizeChallenge(row) {
  const daily = row.daily_read_seconds || {};
  const dates = listChallengeDates(row.start_date, row.end_date);
  let readDays = 0;
  let totalSeconds = 0;

  for (const date of dates) {
    const seconds = Math.max(0, Number(daily[date] || 0));
    totalSeconds += seconds;
    if (seconds >= MIN_READ_DAY_SECONDS) {
      readDays += 1;
    }
  }

  return { readDays, totalSeconds };
}

function renderChallenge() {
  if (!challengeRow) {
    elements.challengeSection.hidden = true;
    return;
  }

  const { readDays, totalSeconds } = summarizeChallenge(challengeRow);
  const targetDays = Number(challengeRow.target_days || 0);
  const targetSeconds = Number(challengeRow.target_seconds || 0);
  const daysRemaining = Math.max(0, targetDays - readDays);
  const daysPercent = targetDays > 0 ? Math.min(100, (readDays / targetDays) * 100) : 0;
  const timePercent = targetSeconds > 0 ? Math.min(100, (totalSeconds / targetSeconds) * 100) : 0;
  const daysCompleted = targetDays > 0 && readDays >= targetDays;
  const timeCompleted = targetSeconds > 0 && totalSeconds >= targetSeconds;

  elements.challengeSection.hidden = false;

  elements.challengeDaysValue.textContent = `已阅读 ${daysCompleted ? targetDays : readDays} 天`;
  elements.challengeDaysBar.style.width = `${daysPercent}%`;
  elements.challengeDaysRemaining.textContent = daysCompleted
    ? "已完成"
    : `还需阅读 ${daysRemaining} 天`;

  elements.challengeTimeValue.textContent = `已阅读 ${formatShortDuration(
    timeCompleted ? targetSeconds : totalSeconds,
  )}`;
  elements.challengeTimeBar.style.width = `${timePercent}%`;
  elements.challengeTimeRemaining.textContent = timeCompleted
    ? "已完成"
    : `还需阅读 ${formatChallengeRemainingDuration(totalSeconds, targetSeconds)}`;
}

function slimChallengeRow(row) {
  return {
    start_date: row.start_date,
    end_date: row.end_date,
    target_days: row.target_days,
    target_seconds: row.target_seconds,
    daily_read_seconds: row.daily_read_seconds,
    synced_at: row.synced_at,
  };
}

async function loadChallenge() {
  const { data, error } = await restSelect("weread_challenge", {
    select: "start_date,end_date,target_days,target_seconds,daily_read_seconds,synced_at",
    filter: { id: "eq.weread-30d-202606" },
  });

  if (error) {
    console.error(error);
    elements.challengeSection.hidden = true;
    return;
  }

  challengeRow = data?.[0] ? slimChallengeRow(data[0]) : null;
  renderChallenge();
  writeCache();
}

function slimStatsRow(row) {
  const payload = row.payload || {};
  return {
    totalReadTime: payload.totalReadTime,
    readDays: payload.readDays,
    dayAverageReadTime: payload.dayAverageReadTime,
    baseTime: payload.baseTime,
    readTimes: payload.readTimes,
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
        challenge: challengeRow,
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

  if (cache.challenge) {
    challengeRow = cache.challenge;
    renderChallenge();
    hydrated = true;
  }

  if (Array.isArray(cache.hourly)) {
    hourlyReadingRows = cache.hourly;
    renderTodayHourChart();
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

  renderDailyReadChart(payload, activeStatsMode);
  renderTodayHourChart();
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

function setActiveStatsMode(mode) {
  activeStatsMode = mode;
  selectedHourDateKey = null;
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

function clearSelectedHourDate() {
  if (!selectedHourDateKey) {
    hideStatsChartTooltip();
    return;
  }

  selectedHourDateKey = null;
  hideStatsChartTooltip();
  if (readingStatsByMode[activeStatsMode]) {
    renderDailyReadChart(readingStatsByMode[activeStatsMode], activeStatsMode);
  }
  renderTodayHourChart();
}

function selectHourDateFromDailyBar(barWrap) {
  const dateKey = barWrap?.dataset?.dateKey;
  if (!dateKey || (activeStatsMode !== "weekly" && activeStatsMode !== "monthly")) {
    return null;
  }

  selectedHourDateKey = dateKey;
  renderDailyReadChart(readingStatsByMode[activeStatsMode], activeStatsMode);
  renderTodayHourChart({ forceExpand: true });

  if (elements.statsHourChartSection) {
    elements.statsHourChartSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // DOM was re-rendered; return the fresh bar so the duration tooltip still works.
  return elements.statsDailyChartBars.querySelector(`[data-date-key="${dateKey}"]`);
}

if (elements.statsDailyChartSection && elements.statsDailyChartBars && elements.statsChartTooltip) {
  elements.statsDailyChartBars.addEventListener("click", (event) => {
    const barWrap = event.target.closest(".stats-chart-bar-wrap");
    if (!barWrap) {
      return;
    }

    event.stopPropagation();
    const pickedBar = selectHourDateFromDailyBar(barWrap) || barWrap;

    if (
      pickedBar === activeChartBarWrap &&
      activeChartTooltip === elements.statsChartTooltip &&
      !barWrap.dataset.dateKey
    ) {
      hideStatsChartTooltip();
      return;
    }

    activeChartBarWrap = pickedBar;
    showStatsChartTooltip(
      elements.statsDailyChartSection,
      elements.statsChartTooltip,
      pickedBar,
    );
  });
}

if (elements.statsHourChartSection && elements.statsHourChartBars && elements.statsHourChartTooltip) {
  bindStatsChartSection(
    elements.statsHourChartSection,
    elements.statsHourChartBars,
    elements.statsHourChartTooltip,
  );
}

if (elements.statsHourChartToggle && elements.statsHourChartSection) {
  elements.statsHourChartToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    clearSelectedHourDate();
  });
}

if (elements.statsHourChartCollapse && elements.statsHourChartSection) {
  elements.statsHourChartCollapse.addEventListener("click", (event) => {
    event.stopPropagation();
    clearSelectedHourDate();
  });
}

document.addEventListener("click", (event) => {
  const onDailyBar = event.target.closest("#statsDailyChartBars .stats-chart-bar-wrap");
  const onHourBar = event.target.closest("#statsHourChartBars .stats-chart-bar-wrap");
  const onHourCollapse = event.target.closest("#statsHourChartCollapse, #statsHourChartToggle");

  // Clicks on bars / collapse controls are handled above.
  if (onDailyBar || onHourBar || onHourCollapse) {
    return;
  }

  // Blank area: dismiss duration tip and hide the hour chart.
  hideStatsChartTooltip();
  clearSelectedHourDate();
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

Promise.all([loadReadingStats(), loadChallenge(), loadHourlyReading(), loadWereadBooks()])
  .then(() => scheduleBookReviewsLoad())
  .catch((error) => {
    console.error(error);
  });
