interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  WORKFLOW_FILE: string;
  // 任意。設定すると dispatch 失敗時に Discord へ通知する
  DISCORD_WEBHOOK_URL?: string;
}

async function notifyDispatchFailure(env: Env, detail: string): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `⚠️ **cron-trigger: workflow_dispatch 失敗**\n\`\`\`\n${detail.slice(0, 1800)}\n\`\`\`\nGITHUB_TOKEN の期限切れの可能性があります。新しい PAT を発行して \`wrangler secret put GITHUB_TOKEN\` で更新してください。`,
      }),
    });
  } catch (e) {
    console.error("Failed to send Discord notification:", e);
  }
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
          const detail = `${res.status} ${await res.text()}`;
          console.error(`workflow_dispatch failed: ${detail}`);
          await notifyDispatchFailure(env, detail);
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
