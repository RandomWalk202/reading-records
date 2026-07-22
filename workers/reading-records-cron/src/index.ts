export interface Env {
  GITHUB_TOKEN: string;
}

const OWNER = "RandomWalk202";
const REPO = "reading-records";
const BRANCH = "main";

const HOURLY_CRON = "5 * * * *";
const FULL_SYNC_CRONS = new Set([
  "10 0 * * *", // Beijing 08:10
  "10 6 * * *", // Beijing 14:10
  "10 13 * * *", // Beijing 21:10
]);

const WORKFLOWS = {
  hourly: "record-reading-hour.yml",
  fullSync: "sync-weread.yml",
} as const;

async function dispatchWorkflow(workflow: string, token: string) {
  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/dispatches`,
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
    throw new Error(`Failed to dispatch ${workflow}: ${response.status} ${body}`);
  }

  console.log(`Dispatched ${workflow}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (event.cron === HOURLY_CRON) {
      ctx.waitUntil(dispatchWorkflow(WORKFLOWS.hourly, env.GITHUB_TOKEN));
      return;
    }

    if (FULL_SYNC_CRONS.has(event.cron)) {
      ctx.waitUntil(dispatchWorkflow(WORKFLOWS.fullSync, env.GITHUB_TOKEN));
      return;
    }

    console.log(`Unhandled cron trigger: ${event.cron}`);
  },

  async fetch() {
    return new Response("reading-records cron worker ok");
  },
};
