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

export function getShanghaiHour(date = new Date()) {
  return Number(pickPart(shanghaiParts(date), "hour"));
}

/** Hour bucket that just ended when sync runs (e.g. 11:00 sync → 10:00–11:00). */
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

async function getLastSnapshot(supabaseRequest) {
  const rows = await supabaseRequest("weread_reading_snapshots", {
    query: {
      select: "synced_at,total_read_seconds",
      order: "synced_at.desc",
      limit: "1",
    },
  });

  return rows?.[0] ?? null;
}

async function insertSnapshot(supabaseRequest, syncedAt, totalReadSeconds) {
  await supabaseRequest("weread_reading_snapshots", {
    method: "POST",
    body: [
      {
        synced_at: syncedAt.toISOString(),
        total_read_seconds: totalReadSeconds,
      },
    ],
  });
}

async function incrementHourlyReading(supabaseRequest, hourStart, addSeconds) {
  if (addSeconds <= 0) {
    return;
  }

  const filter = encodeURIComponent(`eq.${hourStart}`);
  const existing = await supabaseRequest(`weread_hourly_reading?hour_start=${filter}&select=read_seconds`);
  const current = Number(existing?.[0]?.read_seconds || 0);

  await supabaseRequest("weread_hourly_reading", {
    method: "POST",
    query: { on_conflict: "hour_start" },
    body: [
      {
        hour_start: hourStart,
        read_seconds: current + addSeconds,
        updated_at: new Date().toISOString(),
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
  const last = await getLastSnapshot(supabaseRequest);

  if (!last) {
    await insertSnapshot(supabaseRequest, syncedAt, total);
    log(`Hourly baseline: ${total}s total (first snapshot, no delta yet).`);
    return { delta: 0, total, buckets: 0 };
  }

  const delta = Math.max(0, total - Number(last.total_read_seconds || 0));
  const allocations = distributeDelta(last.synced_at, syncedAt, delta);

  for (const { hourStart, seconds } of allocations) {
    await incrementHourlyReading(supabaseRequest, hourStart, seconds);
  }

  await insertSnapshot(supabaseRequest, syncedAt, total);

  if (delta > 0) {
    const bucketLabels = allocations.map(({ hourStart }) => hourStart).join(", ");
    log(`Hourly reading: +${delta}s → ${allocations.length} bucket(s): ${bucketLabels}`);
  } else {
    log(`Hourly reading: no change (${total}s total).`);
  }

  return { delta, total, buckets: allocations.length };
}
