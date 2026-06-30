# AGENTS.md

## Cursor Cloud specific instructions

### What this project is
A static reading-records website (开卷纪 / 阅读记录): vanilla HTML/CSS/JS (`index.html`, `app.js`, `styles.css`) with **no build step**. It reads data directly from a hosted Supabase Postgres instance via PostgREST. The Supabase URL and a public (read-only) publishable key are hardcoded at the top of `app.js`, so the site renders real data with no secrets configured.

### Services and how to run them
- **Frontend (the product):** static server, no install/build. Run `python3 -m http.server 4173` from the repo root, then open `http://localhost:4173`. The page fetches books/highlights/stats from the hosted Supabase backend over the network.
- **Cloudflare Worker cron (`workers/reading-records-cron/`, optional):** npm project. Deps install via the update script. Typecheck with `npx tsc --noEmit`. `npm run dev` runs `wrangler dev` but requires Cloudflare auth / a `GITHUB_TOKEN` secret to actually dispatch, so it is not needed to run/test the website.
- **WeRead sync (`scripts/sync-weread.mjs`, optional):** pure Node ≥18 (uses global `fetch`, no npm deps). Populates Supabase from the WeRead API; requires a `WEREAD_API_KEY` (`wrk-...`) and reaches the external `i.weread.qq.com` API. Not needed to view the site — the DB already contains data.

### Non-obvious notes
- There is **no root `package.json`** and **no local database** — the backend is hosted Supabase, reachable over the network. Do not try to provision a local DB or docker-compose.
- The only dependency install in the whole repo is inside `workers/reading-records-cron/`.
- There is no lint config and no test suite. "Tests" for the worker = `npx tsc --noEmit`; verification for the frontend = loading the page and confirming book cards / stats render and the "查看全部划线" highlights modal opens.
