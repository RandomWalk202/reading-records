/**
 * Estimate per-hour reading by snapshotting overall totalReadTime.
 * A run at 11:05 attributes the delta since the last snapshot across
 * finished Shanghai-hour buckets (preferring the hour that just ended).
 *
 * Storage reuses weread_challenge row id=weread-hourly-v1 (no new table):
 * - target_seconds: last overall total
 * - daily_read_seconds: { "2026-07-22T10:00:00+08:00": seconds, ... }
 * - synced_at: last snapshot time
 */

export const HOURLY_STATE_ID = "weread-hourly-v1";

const SHANGHAI_TZ = "Asia/Shanghai";
const HOUR_MS = 3600000;
const HOUR_START_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00:00\+08:00$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

function shanghaiParts(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    // Force 0–23. Some runtimes with hour12:false still emit 24 at midnight (h24),
    // which produced invalid keys like 2026-07-23T24:00:00+08:00 and spilled
    // delta into future hour buckets.
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
}

function pickPart(parts, type) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getShanghaiHourStart(date = new Date()) {
  const parts = shanghaiParts(date);
  let year = Number(pickPart(parts, "year"));
  let month = Number(pickPart(parts, "month"));
  let day = Number(pickPart(parts, "day"));
  let hour = Number(pickPart(parts, "hour"));

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(hour)) {
    throw new Error(`Invalid Shanghai parts for ${date.toISOString()}`);
  }

  // Defense: if a runtime still emits 24, treat as 00:00 of the next calendar day.
  if (hour === 24) {
    const noon = new Date(`${year}-${pad2(month)}-${pad2(day)}T12:00:00+08:00`);
    return getShanghaiHourStart(new Date(noon.getTime() + 12 * HOUR_MS));
  }

  if (hour < 0 || hour > 23) {
    throw new Error(`Unexpected Shanghai hour ${hour} for ${date.toISOString()}`);
  }

  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:00:00+08:00`;
}

/** Hour bucket that just ended when sync runs (e.g. 11:05 sync → 10:00–11:00). */
export function getPreviousShanghaiHourStart(date = new Date()) {
  const currentHourStartMs = new Date(getShanghaiHourStart(date)).getTime();
  return getShanghaiHourStart(new Date(currentHourStartMs - HOUR_MS));
}

export function isValidShanghaiHourStart(hourStart) {
  const match = HOUR_START_RE.exec(String(hourStart || ""));
  if (!match) {
    return false;
  }
  const hour = Number(match[4]);
  return hour >= 0 && hour <= 23;
}

/** Drop illegal T24 keys and any buckets after the latest finished Shanghai hour. */
export function sanitizeHourlyBuckets(hourly, now = new Date()) {
  const endHourStart = getPreviousShanghaiHourStart(now);
  const endHourStartMs = new Date(endHourStart).getTime();
  const cleaned = {};

  for (const [hourStart, seconds] of Object.entries(hourly || {})) {
    if (!isValidShanghaiHourStart(hourStart)) {
      continue;
    }
    const startMs = new Date(hourStart).getTime();
    if (!Number.isFinite(startMs) || startMs > endHourStartMs) {
      continue;
    }
    const value = Math.max(0, Number(seconds || 0));
    if (value > 0) {
      cleaned[hourStart] = value;
    }
  }

  return cleaned;
}

function distributeDelta(lastSyncedAt, now, delta) {
  if (delta <= 0) {
    return [];
  }

  const endHourStart = getPreviousShanghaiHourStart(now);
  const endHourStartMs = new Date(endHourStart).getTime();
  let firstHourStartMs = new Date(getShanghaiHourStart(new Date(lastSyncedAt))).getTime();

  if (!Number.isFinite(firstHourStartMs) || !Number.isFinite(endHourStartMs)) {
    return [{ hourStart: endHourStart, seconds: delta }];
  }

  // If the last snapshot is already past the finished hour, keep delta in that bucket.
  if (firstHourStartMs > endHourStartMs) {
    firstHourStartMs = endHourStartMs;
  }

  const hourStarts = [];
  let cursorMs = firstHourStartMs;
  while (cursorMs <= endHourStartMs) {
    const hourStart = getShanghaiHourStart(new Date(cursorMs));
    if (isValidShanghaiHourStart(hourStart)) {
      hourStarts.push(hourStart);
    }
    cursorMs += HOUR_MS;
  }

  if (!hourStarts.length) {
    hourStarts.push(endHourStart);
  }

  const perHour = Math.floor(delta / hourStarts.length);
  let remainder = delta - perHour * hourStarts.length;

  return hourStarts.map((hourStart) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }
    return { hourStart, seconds: perHour + extra };
  });
}

async function loadHourlyState(supabaseRequest) {
  const rows = await supabaseRequest("weread_challenge", {
    query: {
      select: "synced_at,target_seconds,daily_read_seconds",
      id: `eq.${HOURLY_STATE_ID}`,
    },
  });
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function saveHourlyState(supabaseRequest, { syncedAt, totalReadSeconds, hourly }) {
  await supabaseRequest("weread_challenge", {
    method: "POST",
    query: { on_conflict: "id" },
    body: [
      {
        id: HOURLY_STATE_ID,
        start_date: "2000-01-01",
        end_date: "2099-12-31",
        target_days: 1,
        target_seconds: totalReadSeconds,
        baseline_through_date: null,
        daily_read_seconds: hourly,
        synced_at: syncedAt.toISOString(),
      },
    ],
  });
}

export async function recordHourlyReading({
  totalReadSeconds,
  supabaseRequest,
  syncedAt = new Date(),
  log = console.log,
}) {
  const total = Math.max(0, Number(totalReadSeconds || 0));
  const last = await loadHourlyState(supabaseRequest);
  const beforeCount = Object.keys(last?.daily_read_seconds || {}).length;
  const hourly = sanitizeHourlyBuckets(last?.daily_read_seconds || {}, syncedAt);
  const removed = beforeCount - Object.keys(hourly).length;
  if (removed > 0) {
    log(`Hourly sanitize: removed ${removed} invalid/future bucket(s).`);
  }

  if (!last) {
    await saveHourlyState(supabaseRequest, {
      syncedAt,
      totalReadSeconds: total,
      hourly,
    });
    log(`Hourly baseline: ${total}s total (first snapshot, no delta yet).`);
    return { delta: 0, total, buckets: 0 };
  }

  const previousTotal = Math.max(0, Number(last.target_seconds || 0));
  const delta = Math.max(0, total - previousTotal);
  const allocations = distributeDelta(last.synced_at, syncedAt, delta);

  for (const { hourStart, seconds } of allocations) {
    if (seconds <= 0 || !isValidShanghaiHourStart(hourStart)) {
      continue;
    }
    hourly[hourStart] = Math.max(0, Number(hourly[hourStart] || 0)) + seconds;
  }

  const cleaned = sanitizeHourlyBuckets(hourly, syncedAt);

  await saveHourlyState(supabaseRequest, {
    syncedAt,
    totalReadSeconds: total,
    hourly: cleaned,
  });

  if (delta > 0) {
    const bucketLabels = allocations.map(({ hourStart }) => hourStart).join(", ");
    log(`Hourly reading: +${delta}s → ${allocations.length} bucket(s): ${bucketLabels}`);
  } else {
    log(`Hourly reading: no change (${total}s total).`);
  }

  return { delta, total, buckets: allocations.length };
}
