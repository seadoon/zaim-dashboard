interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  WORKFLOW_FILE: string;
}

async function isJapaneseHoliday(date: Date): Promise<boolean> {
  const ymd = date.toISOString().slice(0, 10);
  const year = ymd.slice(0, 4);
  try {
    const res = await fetch(`https://holidays-jp.github.io/api/v1/${year}/date.json`, {
      cf: { cacheTtl: 3600 },
    });
    if (!res.ok) return false;
    const holidays = (await res.json()) as Record<string, string>;
    return ymd in holidays;
  } catch {
    return false;
  }
}

async function dispatchWorkflow(env: Env): Promise<Response> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "zaim-dashboard-cron-trigger",
    },
    body: JSON.stringify({ ref: "main" }),
  });
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
        if (await isJapaneseHoliday(nowJst)) {
          console.log(`Skipping: ${nowJst.toISOString().slice(0, 10)} is a Japanese holiday`);
          return;
        }
        const res = await dispatchWorkflow(env);
        if (!res.ok) {
          console.error(`workflow_dispatch failed: ${res.status} ${await res.text()}`);
        } else {
          console.log("workflow_dispatch succeeded");
        }
      })(),
    );
  },

  async fetch(_req: Request, env: Env): Promise<Response> {
    const res = await dispatchWorkflow(env);
    if (!res.ok) return new Response(`failed: ${res.status} ${await res.text()}`, { status: 500 });
    return new Response("workflow_dispatch sent", { status: 200 });
  },
};
