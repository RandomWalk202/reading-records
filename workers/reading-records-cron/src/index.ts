export interface Env {
  GITHUB_TOKEN: string;
}

const OWNER = "RandomWalk202";
const REPO = "reading-records";
const BRANCH = "main";

const SYNC_CRONS = new Set([
  "0 0 * * *", // Beijing 08:00
  "0 4 * * *", // Beijing 12:00
  "0 13 * * *", // Beijing 21:00
]);

const SYNC_WORKFLOW = "sync-weread.yml";

async function dispatchWorkflow(token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${SYNC_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "reading-records-cloudflare-cron",
      },
      body: JSON.stringify({ ref: BRANCH }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to dispatch ${SYNC_WORKFLOW}: ${response.status} ${body}`);
  }

  console.log(`Dispatched ${SYNC_WORKFLOW}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (SYNC_CRONS.has(event.cron)) {
      ctx.waitUntil(dispatchWorkflow(env.GITHUB_TOKEN));
      return;
    }

    console.log(`Unhandled cron trigger: ${event.cron}`);
  },

  async fetch() {
    return new Response("reading-records cron worker ok");
  },
};
