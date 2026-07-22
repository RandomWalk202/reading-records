/**
 * Record reading duration for finished hour buckets by diffing overall totalReadTime.
 *
 * Usage:
 *   export WEREAD_API_KEY=wrk-...
 *   node scripts/record-reading-hour.mjs
 *
 * Schedule near each hour boundary (e.g. :05). A run at 11:05 attributes the
 * delta to finished Shanghai-hour buckets (typically 10:00–11:00).
 */

import { recordHourlyReading } from "./lib/record-hourly-reading.mjs";

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";
const WEREAD_MAX_ATTEMPTS = 4;
const WEREAD_RETRY_BASE_MS = 800;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const wereadApiKey = requireEnv("WEREAD_API_KEY");

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
        throw new Error(`WeRead API empty response: ${apiName} (HTTP ${response.status})`);
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

async function main() {
  console.log("Fetching overall reading total...");
  const payload = await weread("/readdata/detail", { mode: "overall" });
  const totalReadSeconds = Number(payload.totalReadTime || 0);

  await recordHourlyReading({
    totalReadSeconds,
    supabaseRequest,
    log: console.log,
  });
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
