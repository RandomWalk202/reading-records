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

function shanghaiParts(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
}

function pickPart(parts, type) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getShanghaiHourStart(date = new Date()) {
  const parts = shanghaiParts(date);
  const hour = pickPart(parts, "hour").padStart(2, "0");
  return `${pickPart(parts, "year")}-${pickPart(parts, "month")}-${pickPart(parts, "day")}T${hour}:00:00+08:00`;
}

/** Hour bucket that just ended when sync runs (e.g. 11:05 sync → 10:00–11:00). */
export function getPreviousShanghaiHourStart(date = new Date()) {
  const currentHourStartMs = new Date(getShanghaiHourStart(date)).getTime();
  return getShanghaiHourStart(new Date(currentHourStartMs - HOUR_MS));
}

function distributeDelta(lastSyncedAt, now, delta) {
  if (delta <= 0) {
    return [];
  }

  const endHourStart = getPreviousShanghaiHourStart(now);
  const endHourStartMs = new Date(endHourStart).getTime();
  const firstHourStartMs = new Date(getShanghaiHourStart(new Date(lastSyncedAt))).getTime();

  const hourStarts = [];
  let cursorMs = firstHourStartMs;
  while (cursorMs <= endHourStartMs) {
    hourStarts.push(getShanghaiHourStart(new Date(cursorMs)));
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
  const hourly = { ...(last?.daily_read_seconds || {}) };

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
    if (seconds <= 0) {
      continue;
    }
    hourly[hourStart] = Math.max(0, Number(hourly[hourStart] || 0)) + seconds;
  }

  await saveHourlyState(supabaseRequest, {
    syncedAt,
    totalReadSeconds: total,
    hourly,
  });

  if (delta > 0) {
    const bucketLabels = allocations.map(({ hourStart }) => hourStart).join(", ");
    log(`Hourly reading: +${delta}s → ${allocations.length} bucket(s): ${bucketLabels}`);
  } else {
    log(`Hourly reading: no change (${total}s total).`);
  }

  return { delta, total, buckets: allocations.length };
}
