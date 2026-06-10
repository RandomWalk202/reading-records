/**
 * Record reading duration for the current hour by diffing overall totalReadTime.
 *
 * Usage:
 *   export WEREAD_API_KEY=wrk-...
 *   node scripts/record-reading-hour.mjs
 *
 * Schedule hourly via GitHub Actions or scripts/install-hourly-sync.sh (macOS).
 */

import { recordHourlyReading } from "./lib/record-hourly-reading.mjs";

const WEREAD_GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = "1.0.3";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://jsbppxnrnzsxoqfworjj.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_zLmaAY6WoAl8-fKy0WYMYw_RkvoueHC";

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
